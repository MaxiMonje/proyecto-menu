import { Transaction } from "sequelize";
import { Item as ItemM, ItemCreationAttributes } from "../models/Item";
import ItemImage from "../models/ItemImage";
import { CreateItemDto, UpdateItemDto } from "../dtos/item.dto";
import { ApiError as Err3 } from "../utils/ApiError";
import sequelize from "../utils/databaseService";

/** ⬇️ NUEVO: helper mínimo para convertir URL externa → URL S3/CDN */
import { toS3UrlFromExternal } from "../utils/s3urlUtils";

/* ===========================
 * Helpers genéricos
 * =========================== */

async function withTx<T>(fn: (t: Transaction) => Promise<T>) {
  return sequelize.transaction(fn);
}

function has<K extends string>(obj: any, key: K): obj is Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function imageBasePatch(img: any) {
  const patch: any = {};
  if (has(img, "alt"))       patch.alt = img.alt;        // puede ser null a propósito
  if (has(img, "sortOrder")) patch.sortOrder = img.sortOrder;
  if (has(img, "active"))    patch.active = img.active;  // opcional
  return patch;
}

/* ===========================
 * Lecturas (sin soft delete)
 * =========================== */

export const getAllItems = async () =>
  ItemM.findAll({
    order: [["id", "ASC"]],
    include: [{
      model: ItemImage,
      as: "images",
      required: false,
      separate: true,
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
    }],
  });

export const getItemById = async (id: number, t?: Transaction) => {
  const it = await ItemM.findOne({
    where: { id },
    include: [{
      model: ItemImage,
      as: "images",
      required: false,
      separate: true,
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
    }],
    transaction: t,
  });
  if (!it) throw new Err3("Item not found", 404);
  return it;
};

/* ===========================
 * Creación
 * =========================== */

export const createItem = async (data: CreateItemDto) =>
  withTx(async (t) => {
    const { images = [], ...rest } = data;
    const it = await ItemM.create(rest as ItemCreationAttributes, { transaction: t });

    // ⬇️ Cambio mínimo: subimos cada URL a S3 y guardamos la URL final en el mismo campo `url`
    if (images.length) {
      const rows = await Promise.all(
        images.map(async (img, idx) => {
          const finalUrl = await toS3UrlFromExternal(img.url, `items/${it.id}`);
          return {
            itemId: it.id,
            url: finalUrl,                    // antes: img.url
            alt: img.alt ?? null,
            sortOrder: img.sortOrder ?? idx,
            active: img.active ?? true,
          };
        })
      );
      await ItemImage.bulkCreate(rows, { transaction: t });
    }

    await it.reload({
      include: [{
        model: ItemImage,
        as: "images",
        required: false,
        separate: true,
        order: [["sortOrder", "ASC"], ["id", "ASC"]],
      }],
      transaction: t,
    });
    return it;
  });

/* ===========================
 * Update — versión modular (con HARD delete de imágenes)
 * =========================== */

export const updateItem = async (id: number, data: UpdateItemDto) =>
  withTx(async (t) => {
    const it = await ItemM.findByPk(id, { transaction: t });
    if (!it) throw new Err3("Item not found", 404);

    const { images, ...rest } = data;
    if (rest && Object.keys(rest).length) {
      await it.update(rest, { transaction: t });
    }

    if (Array.isArray(images)) {
      await upsertItemImages(id, images, t);
    }

    await it.reload({
      include: [{
        model: ItemImage,
        as: "images",
        required: false,
        separate: true,
        order: [["sortOrder", "ASC"], ["id", "ASC"]],
      }],
      transaction: t,
    });
    return it;
  });

/* ===========================
 * Helpers específicos de imágenes
 * =========================== */

async function upsertItemImages(itemId: number, images: any[], t: Transaction) {
  for (const img of images) {
    if (img._delete) {
      await hardDeleteImage(itemId, img, t);
      continue;
    }
    if (img.id) {
      await updateImagePartial(itemId, img, t);
    } else {
      await createImage(itemId, img, t);
    }
  }
}

async function hardDeleteImage(itemId: number, img: any, t: Transaction) {
  if (!img.id) throw new Err3("Para borrar una imagen debe enviarse su id", 400);
  await ItemImage.destroy({ where: { id: img.id, itemId }, transaction: t });
}

async function updateImagePartial(itemId: number, img: any, t: Transaction) {
  // ⬇️ Si viene una URL nueva, la convertimos a S3 antes de actualizar
  const patch: any = imageBasePatch(img);
  if (has(img, "url") && typeof img.url === "string") {
    const finalUrl = await toS3UrlFromExternal(img.url, `items/${itemId}`);
    patch.url = finalUrl;
  }
  if (Object.keys(patch).length === 0) return; // nada que actualizar
  await ItemImage.update(patch, {
    where: { id: img.id, itemId },
    transaction: t,
  });
}

async function createImage(itemId: number, img: any, t: Transaction) {
  // ⬇️ En creación también subimos la URL externa a S3 y guardamos la final
  const finalUrl = await toS3UrlFromExternal(img.url, `items/${itemId}`);
  await ItemImage.create(
    {
      itemId,
      url: finalUrl,                    // antes: img.url
      alt: img.alt ?? null,
      sortOrder: img.sortOrder ?? 0,
      active: img.active ?? true,
    },
    { transaction: t }
  );
}

/* ===========================
 * Eliminación de Item — HARD delete (con cascade)
 * =========================== */

export const deleteItem = async (id: number) =>
  withTx(async (t) => {
    const it = await ItemM.findByPk(id, { transaction: t });
    if (!it) throw new Err3("Item not found", 404);
    await it.destroy({ transaction: t }); // 🔥 borra físicamente
  });
