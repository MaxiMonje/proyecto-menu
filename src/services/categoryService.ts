import { Category as CategoryM, CategoryCreationAttributes, Category } from "../models/Category";
import { CreateCategoryDto, UpdateCategoryDto } from "../dtos/category.dto";
import { ApiError } from "../utils/ApiError";
import { Menu } from "../models/Menu";
import { Item } from "../models/Item";
import ItemImage from "../models/ItemImage";
import sequelize from "../utils/databaseService";
import { Op, Transaction } from "sequelize";
import { ImageS3Service } from "../s3-image-module";

/* ===========================
 * Tipado local
 * =========================== */
type NewImage = { url?: string; fileField?: string; alt?: string | null; sortOrder?: number };
type NewItem = { title: string; description?: string | null; price: number; active?: boolean; images?: NewImage[] };
type NewCategoryPayload = { menuId: number; title: string; description?: string | null; active?: boolean; items?: NewItem[] };

type UpdateImage = { id?: number; url?: string; fileField?: string; alt?: string | null; sortOrder?: number; active?: boolean };
type UpdateItem = { id?: number; title?: string; description?: string | null; price?: number; active?: boolean; images?: UpdateImage[] };
type UpdateCategoryPayload = {
  title?: string;
  active?: boolean;
  items?: UpdateItem[];
  removeMissingItems?: boolean;
  removeMissingImages?: boolean;
};

type ItemWithImages = Item & { images?: ItemImage[] };

/* ===========================
 * Helpers locales
 * =========================== */

function pickFile(files: Express.Multer.File[] | undefined, field?: string) {
  if (!files || !field) return null;
  return files.find(f => f.fieldname === field) ?? null;
}

const normalizeDescription = (desc?: string | null) =>
  desc && desc.trim() !== "" ? desc : null;

/**
 * Sube a S3 o devuelve una URL válida para una imagen.
 * ⚠️ El mensaje que se expone al cliente es genérico;
 *     el error real va en `cause` (para logs/servidor).
 */
async function resolveImageUrl(
  img: { url?: string; fileField?: string },
  folder: string,
  files?: Express.Multer.File[]
): Promise<string> {
  try {
    const file = pickFile(files, img.fileField);
    if (file) {
      const up = await ImageS3Service.uploadImage(file as any, folder, {
        maxWidth: 1600,
        maxHeight: 1600,
      });
      if (!up?.url) {
        throw new ApiError("Error al subir imagen a S3", 500);
      }
      return up.url;
    }

    if (img.url) return img.url;

    // si no hay ni archivo ni url → error de input
    throw new ApiError("Imagen inválida: debe tener url o fileField", 400);
  } catch (err: any) {
    // mensaje genérico para el cliente, info técnica solo en logs
    throw new ApiError(
      "Error procesando imagen",
      500,
      {
        field: img.fileField ?? null,
        hasUrl: !!img.url,
      },
      err
    );
  }
}

/* ===========================
 * CRUD base
 * =========================== */

export const getAllCategories = async () => {
  try {
    return await CategoryM.findAll({ where: { active: true }, order: [["id", "ASC"]] });
  } catch (e: any) {
    throw new ApiError("Error al obtener categorías", 500, undefined, e);
  }
};

export const getCategoryById = async (id: number) => {
  if (!id) throw new ApiError("ID de categoría inválido", 400);
  const it = await CategoryM.findOne({ where: { id, active: true } });
  if (!it) throw new ApiError("Categoría no encontrada", 404);
  return it;
};

export const createCategory = async (data: CreateCategoryDto) => {
  if (!data.title || !data.menuId) {
    throw new ApiError("Datos incompletos para crear categoría", 400);
  }
  try {
    return await CategoryM.create(data as CategoryCreationAttributes);
  } catch (e: any) {
    throw new ApiError("Error al crear categoría", 500, undefined, e);
  }
};

export const updateCategory = async (id: number, data: UpdateCategoryDto) => {
  const it = await getCategoryById(id);
  try {
    await it.update(data);
    return it;
  } catch (e: any) {
    throw new ApiError("Error al actualizar categoría", 500, undefined, e);
  }
};

export const deleteCategory = async (id: number) => {
  const it = await getCategoryById(id);
  try {
    await it.destroy();
  } catch (e: any) {
    throw new ApiError("Error al eliminar categoría", 500, undefined, e);
  }
};

/* ===========================
 * Create Deep (con archivos)
 * =========================== */

export const createCategoryDeep = async (
  userId: number,
  body: NewCategoryPayload,
  files: Express.Multer.File[]
) => {
  const t = await sequelize.transaction();
  try {
    if (!body.menuId) throw new ApiError("menuId es requerido", 400);
    if (!body.title) throw new ApiError("El título de la categoría es obligatorio", 400);

    const menu = await Menu.findOne({
      where: { id: body.menuId, userId, active: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new ApiError("Menú no encontrado para el tenant actual", 404);

    const category = await Category.create(
      { menuId: body.menuId, title: body.title, active: body.active ?? true },
      { transaction: t }
    );

    if (body.items?.length) {
      for (const it of body.items) {
        if (!it.title || typeof it.price !== "number") {
          throw new ApiError("Cada ítem debe tener título y precio", 400);
        }

        const item = await Item.create(
          {
            categoryId: category.id,
            title: it.title,
            description: normalizeDescription(it.description),
            price: it.price,
            active: it.active ?? true,
          },
          { transaction: t }
        );

        if (it.images?.length) {
          const rows = await Promise.all(
            it.images.map(async (img) => {
              const finalUrl = await resolveImageUrl(img, `items/${item.id}`, files);
              return {
                itemId: item.id,
                url: finalUrl,
                alt: img.alt ?? null,
                sortOrder: img.sortOrder ?? 0,
                active: true,
              };
            })
          );
          await ItemImage.bulkCreate(rows, { transaction: t });
        }
      }
    }

    await t.commit();

    if (!body.items?.length) {
      return await Category.findByPk(category.id);
    }

    return await Category.findOne({
      where: { id: category.id },
      include: [
        {
          model: Item,
          as: "items",
          required: false,
          include: [{ model: ItemImage, as: "images", required: false }],
        },
      ],
    });
  } catch (e: any) {
    await t.rollback();
    // mensaje genérico hacia el cliente, error real va como cause
    throw new ApiError(
      "Error al crear categoría con ítems",
      e?.statusCode || 500,
      { menuId: body.menuId },
      e
    );
  }
};

/* ===========================
 * Update Deep (con archivos)
 * =========================== */

export const updateCategoryDeep = async (
  userId: number,
  categoryId: number,
  body: UpdateCategoryPayload,
  files: Express.Multer.File[]
) => {
  return await sequelize.transaction(async (t: Transaction) => {
    if (!categoryId) throw new ApiError("ID de categoría inválido", 400);

    const category = await Category.findByPk(categoryId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!category) throw new ApiError("Categoría no encontrada", 404);

    const menu = await Menu.findOne({
      where: { id: category.get("menuId"), userId, active: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new ApiError("Menú no encontrado para el tenant actual", 404);

    // Actualizar categoría
    const patchCategory: any = {};
    if (typeof body.title === "string") patchCategory.title = body.title;
    if (typeof body.active === "boolean") patchCategory.active = body.active;
    if (Object.keys(patchCategory).length) {
      await category.update(patchCategory, { transaction: t });
    }

    // Si no vienen items, devolvemos la categoría con hijos
    if (!body.items) {
      return await Category.findByPk(category.id, {
        transaction: t,
        include: [
          {
            model: Item,
            as: "items",
            required: false,
            include: [{ model: ItemImage, as: "images", required: false }],
          },
        ],
      });
    }

    const removeMissingItems = !!body.removeMissingItems;
    const removeMissingImages = !!body.removeMissingImages;

    const existingItems = await Item.findAll({
      where: { categoryId: category.id },
      transaction: t,
      include: [{ model: ItemImage, as: "images", required: false }],
      lock: t.LOCK.UPDATE,
    });

    const existingItemIds = new Set(existingItems.map(i => i.id));
    const seenItemIds = new Set<number>();

    for (const it of body.items) {
      if (it.id) {
        // UPDATE de item existente
        const item = existingItems.find(x => x.id === it.id && x.categoryId === category.id);
        if (!item) {
          throw new ApiError(`Ítem ${it.id} no encontrado en esta categoría`, 404);
        }

        const itemPatch: any = {};
        if (typeof it.title === "string") itemPatch.title = it.title;
        if (typeof it.price === "number") itemPatch.price = it.price;
        if (typeof it.active === "boolean") itemPatch.active = it.active;
        if (typeof it.description !== "undefined") {
          itemPatch.description = normalizeDescription(it.description);
        }

        if (Object.keys(itemPatch).length) {
          await item.update(itemPatch, { transaction: t });
        }
        seenItemIds.add(item.id);

        // Imágenes del ítem
        if (it.images) {
          const existingImages = (item as ItemWithImages).images ?? [];
          const existingImgById = new Map<number, typeof existingImages[number]>();
          for (const im of existingImages) existingImgById.set(im.id, im);

          const seenImageIds = new Set<number>();

          for (const im of it.images) {
            if (im.id) {
              const found = existingImgById.get(im.id);
              if (!found) {
                throw new ApiError(`Imagen ${im.id} no encontrada en item ${item.id}`, 404);
              }

              const imgPatch: any = {};

              if (typeof im.fileField === "string" || typeof im.url === "string") {
                const finalUrl = await resolveImageUrl(im, `items/${item.id}`, files);
                imgPatch.url = finalUrl;
              }
              if (typeof im.alt !== "undefined") imgPatch.alt = im.alt;
              if (typeof im.sortOrder === "number") imgPatch.sortOrder = im.sortOrder;
              if (typeof im.active === "boolean") imgPatch.active = im.active;

              if (Object.keys(imgPatch).length) {
                await found.update(imgPatch, { transaction: t });
              }
              seenImageIds.add(found.id);
            } else {
              // CREATE de imagen nueva
              const finalUrl = await resolveImageUrl(im, `items/${item.id}`, files);
              const created = await ItemImage.create(
                {
                  itemId: item.id,
                  url: finalUrl,
                  alt: typeof im.alt === "undefined" ? null : im.alt,
                  sortOrder: im.sortOrder ?? 0,
                  active: typeof im.active === "boolean" ? im.active : true,
                },
                { transaction: t }
              );
              seenImageIds.add(created.id);
            }
          }

          // borrar imágenes faltantes si así se pide
          if (removeMissingImages) {
            const toDelete = existingImages
              .filter(x => !seenImageIds.has(x.id))
              .map(x => x.id);
            if (toDelete.length) {
              await ItemImage.destroy({
                where: { id: { [Op.in]: toDelete } },
                transaction: t,
              });
            }
          }
        }
      } else {
        // CREATE de item nuevo
        if (!it.title || typeof it.price !== "number") {
          throw new ApiError("Cada nuevo ítem debe tener título y precio", 400);
        }

        const newItem = await Item.create(
          {
            categoryId: category.id,
            title: it.title,
            description: normalizeDescription(it.description),
            price: it.price,
            active: typeof it.active === "boolean" ? it.active : true,
          },
          { transaction: t }
        );

        if (it.images?.length) {
          const rows = await Promise.all(
            it.images.map(async (im) => {
              const finalUrl = await resolveImageUrl(im, `items/${newItem.id}`, files);
              return {
                itemId: newItem.id,
                url: finalUrl,
                alt: typeof im.alt === "undefined" ? null : im.alt,
                sortOrder: im.sortOrder ?? 0,
                active: typeof im.active === "boolean" ? im.active : true,
              };
            })
          );
          await ItemImage.bulkCreate(rows, { transaction: t });
        }
        seenItemIds.add(newItem.id);
      }
    }

    // borrar ítems faltantes si se pide
    if (removeMissingItems) {
      const toDelete = [...existingItemIds].filter(id => !seenItemIds.has(id));
      if (toDelete.length) {
        await ItemImage.destroy({
          where: { itemId: { [Op.in]: toDelete } },
          transaction: t,
        });
        await Item.destroy({
          where: { id: { [Op.in]: toDelete } },
          transaction: t,
        });
      }
    }

    return await Category.findOne({
      where: { id: category.id },
      transaction: t,
      include: [
        {
          model: Item,
          as: "items",
          required: false,
          include: [{ model: ItemImage, as: "images", required: false }],
        },
      ],
    });
  });
};
