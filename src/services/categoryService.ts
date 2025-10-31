import { Category as CategoryM, CategoryCreationAttributes, Category } from "../models/Category";
import { CreateCategoryDto, UpdateCategoryDto } from "../dtos/category.dto";
import { ApiError, ApiError as Err2 } from "../utils/ApiError";
import { Menu } from "../models/Menu";
import { Item } from "../models/Item";
import ItemImage from "../models/ItemImage";
import sequelize from "../utils/databaseService";
import { toS3UrlFromExternal } from "../utils/s3urlUtils";
import { Op, Transaction } from "sequelize";

type NewImage = { url: string; alt?: string | null; sortOrder?: number; };
type NewItem = { title: string; description?: string | null; price: number; active?: boolean; images?: NewImage[]; };
type NewCategoryPayload = { menuId: number; title: string; description?: string | null; active?: boolean; items?: NewItem[]; };

type UpdateImage = { id?: number; url?: string; alt?: string | null; sortOrder?: number; active?: boolean; };
type UpdateItem  = { id?: number; title?: string; description?: string | null; price?: number; active?: boolean; images?: UpdateImage[]; };
type UpdateCategoryPayload = {
  title?: string;
  active?: boolean;
  items?: UpdateItem[];
  removeMissingItems?: boolean;
  removeMissingImages?: boolean;
};

type ItemWithImages = Item & { images?: ItemImage[] };

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
    const it = await getCategoryById(id); await it.update({ active: false }); 
};


export const createCategoryDeep = async (userId: number, body: NewCategoryPayload) => {
    
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
          { categoryId: category.id, title: it.title, price: it.price, active: it.active ?? true },
          { transaction: t }
        );
        if (it.images?.length) {
          const rows = await Promise.all(
           it.images.map(async (img) => {
              // Subimos la URL externa a S3 y guardamos la URL S3/CDN en el mismo campo `url`
              const finalUrl = await toS3UrlFromExternal(img.url, `items/${item.id}`);
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
    console.log("[service] items length:", body.items?.length);

    await t.commit(); // ✅ ahora sí

    // consulta fuera de transacción
    if (!body.items?.length) return await Category.findByPk(category.id);

    return await Category.findOne({
      where: { id: category.id },
      include: [
        { model: Item, as: "items", required: false,
          include: [{ model: ItemImage, as: "images", required: false }] },
      ],
    });
  } catch (e) {
    await t.rollback();
    throw e;
  }
};


export const updateCategoryDeep = async (userId: number, categoryId: number, body: UpdateCategoryPayload) => {
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
          { model: Item, as: "items", required: false,
            include: [{ model: ItemImage, as: "images", required: false }] },
        ],
      });
    }

    // 4) Upsert de items
    const removeMissingItems = !!body.removeMissingItems;
    const removeMissingImages = !!body.removeMissingImages;

    // IDs existentes (para limpieza si corresponde)
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
        if (typeof it.description !== "undefined") itemPatch.description = it.description; // si tu modelo no tiene, sacá esta línea

        if (Object.keys(itemPatch).length) {
          await item.update(itemPatch, { transaction: t });
        }
        seenItemIds.add(item.id);

        // Upsert de imágenes de ese item (si vinieron)
        if (it.images) {
            

          const existingImages = (item as ItemWithImages).images ?? [];
          const existingImgById = new Map<number, typeof existingImages[number]>();
          for (const im of existingImages) existingImgById.set(im.id, im);

          const seenImageIds = new Set<number>();

          for (const im of it.images) {
            if (im.id) {
              const found = existingImgById.get(im.id);
              if (!found) throw new ApiError(`Image ${im.id} not found in item ${item.id}`, 404);

                const imgPatch: any = {};
                if (typeof im.url === "string") {
                  // Si la request trae una URL nueva, la subimos a S3 y guardamos la S3/CDN
                  const finalUrl = await toS3UrlFromExternal(im.url, `items/${item.id}`);
                  imgPatch.url = finalUrl;
                }

             
              if (typeof im.url === "string") imgPatch.url = im.url;
              if (typeof im.alt !== "undefined") imgPatch.alt = im.alt;
              if (typeof im.sortOrder === "number") imgPatch.sortOrder = im.sortOrder;
              if (typeof im.active === "boolean") imgPatch.active = im.active;

              if (Object.keys(imgPatch).length) {
                await found.update(imgPatch, { transaction: t });
              }
              seenImageIds.add(found.id);
            } else {
                // create image (subiendo primero a S3)
                const finalUrl = await toS3UrlFromExternal(im.url!, `items/${item.id}`);
                await ItemImage.create({
                  itemId: item.id,
                  url: finalUrl,
                  alt: typeof im.alt === "undefined" ? null : im.alt,
                  sortOrder: im.sortOrder ?? 0,
                  active: typeof im.active === "boolean" ? im.active : true,
                }, { transaction: t });
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
        const newItem = await Item.create({
          categoryId: category.id,
          title: it.title!,
          price: it.price!,                         // si tu DECIMAL es string: String(it.price)
          active: typeof it.active === "boolean" ? it.active : true,
          // description: it.description ?? null,   // si tu modelo NO tiene, comentá esto
        }, { transaction: t });

       if (it.images?.length) {
          const rows = await Promise.all(
            it.images.map(async (im) => {
              const finalUrl = await toS3UrlFromExternal(im.url!, `items/${newItem.id}`);
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
        // primero imágenes de esos items
        await ItemImage.destroy({ where: { itemId: { [Op.in]: toDelete } }, transaction: t });
        // luego items
        await Item.destroy({ where: { id: { [Op.in]: toDelete } }, transaction: t });
      }
    }

    // 6) Devolver categoría completa con hijos
    return await Category.findOne({
      where: { id: category.id },
      transaction: t,
      include: [
        { model: Item, as: "items", required: false,
          include: [{ model: ItemImage, as: "images", required: false }] },
      ],
    });
  });
};