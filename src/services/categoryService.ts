import { Category as CategoryM, CategoryCreationAttributes, Category } from "../models/Category";
import { CreateCategoryDto, UpdateCategoryDto } from "../dtos/category.dto";
import { ApiError, ApiError as Err2 } from "../utils/ApiError";
import { Menu } from "../models/Menu";
import { Item } from "../models/Item";
import ItemImage from "../models/ItemImage";
import sequelize from "../utils/databaseService";
// ❌ ya no usamos toS3UrlFromExternal para este flujo basado en archivos
// import { toS3UrlFromExternal } from "../utils/s3urlUtils";
import { Op, Transaction } from "sequelize";
import { ImageS3Service } from "../s3-image-module";

/* ===========================
 * Tipado local (agrego fileField opcional)
 * =========================== */
type NewImage = { url?: string; fileField?: string; alt?: string | null; sortOrder?: number };
type NewItem = { title: string; description?: string | null; price: number; active?: boolean; images?: NewImage[] };
type NewCategoryPayload = { menuId: number; title: string; description?: string | null; active?: boolean; items?: NewItem[] };

type UpdateImage = { id?: number; url?: string; fileField?: string; alt?: string | null; sortOrder?: number; active?: boolean };
type UpdateItem  = { id?: number; title?: string; description?: string | null; price?: number; active?: boolean; images?: UpdateImage[] };
type UpdateCategoryPayload = {
  title?: string;
  active?: boolean;
  items?: UpdateItem[];
  removeMissingItems?: boolean;
  removeMissingImages?: boolean;
};

type ItemWithImages = Item & { images?: ItemImage[] };

/* ===========================
 * Helpers locales para archivos/URL
 * =========================== */

function pickFile(files: Express.Multer.File[] | undefined, field?: string) {
  if (!files || !field) return null;
  return files.find(f => f.fieldname === field) ?? null;
}

/**
 * Resuelve la URL final a guardar para una imagen:
 * - Si trae `fileField` y existe el archivo en `files`, sube a S3 con uploadImage y devuelve la URL S3/CDN.
 * - Si trae `url`, usa esa URL tal cual (compatibilidad).
 * - Si no trae nada, lanza error.
 */
async function resolveImageUrl(
  img: { url?: string; fileField?: string },
  folder: string,
  files?: Express.Multer.File[]
): Promise<string> {
  const file = pickFile(files, img.fileField);
  if (file) {
    const up = await ImageS3Service.uploadImage(file as any, folder, { maxWidth: 1600, maxHeight: 1600 });
    return up.url;
  }
  if (img.url) {
    // Si quisieras forzar que todo sea archivo, podrías tirar error si viene url.
    // Por ahora mantenemos compatibilidad con URL cruda:
    return img.url;
  }
  throw new ApiError("Imagen inválida: debe venir url o fileField", 400);
}

/* ===========================
 * Lecturas
 * =========================== */

export const getAllCategories = async () => CategoryM.findAll({ where: { active: true }, order: [["id", "ASC"]] });

export const getCategoryById = async (id: number) => {
  const it = await CategoryM.findOne({ where: { id, active: true } });
  if (!it) throw new Err2("Category not found", 404);
  return it;
};

export const createCategory = async (data: CreateCategoryDto) => CategoryM.create(data as CategoryCreationAttributes);

export const updateCategory = async (id: number, data: UpdateCategoryDto) => {
  const it = await getCategoryById(id);
  await it.update(data);
  return it;
};

export const deleteCategory = async (id: number) => {
  const it = await getCategoryById(id);
  await it.destroy();
};

/* ===========================
 * Create Deep (con archivos)
 * =========================== */

export const createCategoryDeep = async (userId: number, body: NewCategoryPayload, files: Express.Multer.File[]) => {
  const t = await sequelize.transaction();
  try {
    const menu = await Menu.findOne({
      where: { id: body.menuId, userId, active: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new ApiError("Menu not found for tenant", 404);

    const category = await Category.create(
      { menuId: body.menuId, title: body.title, active: body.active ?? true },
      { transaction: t }
    );

    if (body.items?.length) {
      for (const it of body.items) {
        const item = await Item.create(
          { categoryId: category.id, title: it.title, description: it.description ?? null , price: it.price, active: it.active ?? true },
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

    if (!body.items?.length) return await Category.findByPk(category.id);

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
  } catch (e) {
    await t.rollback();
    throw e;
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
    // 1) Traer categoría y chequear pertenencia al tenant
    const category = await Category.findByPk(categoryId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!category) throw new ApiError("Category not found", 404);

    const menu = await Menu.findOne({
      where: { id: category.get("menuId"), userId, active: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new ApiError("Menu not found for tenant", 404);

    // 2) Update de la categoría (si vienen campos)
    const patch: any = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.active === "boolean") patch.active = body.active;
    if (Object.keys(patch).length) {
      await category.update(patch, { transaction: t });
    }

    // 3) Si no vienen items, devolver categoría “plana”
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

    // 4) Upsert de items
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
        if (!item) throw new ApiError(`Item ${it.id} not found in this category`, 404);

        const itemPatch: any = {};
        if (typeof it.title === "string") itemPatch.title = it.title;
        if (typeof it.price === "number") itemPatch.price = it.price;
        if (typeof it.active === "boolean") itemPatch.active = it.active;
        if (typeof it.description !== "undefined") itemPatch.description = it.description;

        if (Object.keys(itemPatch).length) {
          await item.update(itemPatch, { transaction: t });
        }
        seenItemIds.add(item.id);

        // Upsert de imágenes del item (si vinieron)
        if (it.images) {
          const existingImages = (item as ItemWithImages).images ?? [];
          const existingImgById = new Map<number, typeof existingImages[number]>();
          for (const im of existingImages) existingImgById.set(im.id, im);

          const seenImageIds = new Set<number>();

          for (const im of it.images) {
            if (im.id) {
              // UPDATE de imagen existente
              const found = existingImgById.get(im.id);
              if (!found) throw new ApiError(`Image ${im.id} not found in item ${item.id}`, 404);

              const imgPatch: any = {};
              // Si viene archivo o URL, resolvemos la URL final
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
              // CREATE de imagen nueva (archivo o URL)
              const finalUrl = await resolveImageUrl(im, `items/${item.id}`, files);
              await ItemImage.create(
                {
                  itemId: item.id,
                  url: finalUrl,
                  alt: typeof im.alt === "undefined" ? null : im.alt,
                  sortOrder: im.sortOrder ?? 0,
                  active: typeof im.active === "boolean" ? im.active : true,
                },
                { transaction: t }
              );
            }
          }

          // limpiar imágenes faltantes si así se pide
          if (removeMissingImages) {
            const toDelete = existingImages.filter(x => !seenImageIds.has(x.id)).map(x => x.id);
            if (toDelete.length) {
              await ItemImage.destroy({ where: { id: { [Op.in]: toDelete } }, transaction: t });
            }
          }
        }
      } else {
        // CREATE de item nuevo
        const newItem = await Item.create(
          {
            categoryId: category.id,
            title: it.title!,
            description: it.description || null,
            price: it.price!,
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

    // 5) Limpiar items que no vinieron si se pidió
    if (removeMissingItems) {
      const toDelete = [...existingItemIds].filter(id => !seenItemIds.has(id));
      if (toDelete.length) {
        await ItemImage.destroy({ where: { itemId: { [Op.in]: toDelete } }, transaction: t });
        await Item.destroy({ where: { id: { [Op.in]: toDelete } }, transaction: t });
      }
    }

    // 6) Devolver categoría completa con hijos
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
