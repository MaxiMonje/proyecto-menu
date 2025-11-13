import { Transaction } from "sequelize";
import { Item as ItemM, ItemCreationAttributes } from "../models/Item";
import ItemImage from "../models/ItemImage";
import { CreateItemDto, UpdateItemDto } from "../dtos/item.dto";
import { ApiError as Err3 } from "../utils/ApiError";
import sequelize from "../utils/databaseService";
import { ImageS3Service } from "../s3-image-module";

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
  if (has(img, "alt")) patch.alt = img.alt;              // puede ser null a propósito
  if (has(img, "sortOrder")) patch.sortOrder = img.sortOrder;
  if (has(img, "active")) patch.active = img.active;
  return patch;
}

/* ===========================
 * Helpers archivos / URL
 * =========================== */

function pickFile(files: Express.Multer.File[] | undefined, field?: string) {
  if (!files || !field) return null;
  return files.find((f) => f.fieldname === field) ?? null;
}

/**
 * Resuelve la URL final:
 * - Si llega `fileField` y existe ese archivo en `files`, sube a S3 y devuelve la URL S3/CDN.
 * - Si llega `url`, devuelve esa URL (compatibilidad).
 * - Si no llega ninguno, error.
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
        throw new Err3("Error al subir imagen a S3", 500, { folder, fileField: img.fileField });
      }

      return up.url;
    }

    if (img.url) {
      // Mantenemos compatibilidad con URL directa
      return img.url;
    }

    throw new Err3("Debe venir url o fileField en la imagen", 400);
  } catch (err: any) {
    // No filtramos nada sensible al cliente, el detalle real queda en `cause`
    throw new Err3(
      "Error procesando imagen del ítem",
      500,
      { folder, fileField: img.fileField, url: img.url },
      err
    );
  }
}

/* ===========================
 * Lecturas (sin soft delete)
 * =========================== */

export const getAllItems = async () => {
  try {
    return await ItemM.findAll({
      order: [["id", "ASC"]],
      include: [
        {
          model: ItemImage,
          as: "images",
          required: false,
          separate: true,
          order: [
            ["sortOrder", "ASC"],
            ["id", "ASC"],
          ],
        },
      ],
    });
  } catch (err: any) {
    throw new Err3("Error al obtener ítems", 500, undefined, err);
  }
};

export const getItemById = async (id: number, t?: Transaction) => {
  if (!id) throw new Err3("ID de ítem inválido", 400);

  try {
    const it = await ItemM.findOne({
      where: { id },
      include: [
        {
          model: ItemImage,
          as: "images",
          required: false,
          separate: true,
          order: [
            ["sortOrder", "ASC"],
            ["id", "ASC"],
          ],
        },
      ],
      transaction: t,
    });

    if (!it) throw new Err3("Item no encontrado", 404, { id });

    return it;
  } catch (err: any) {
    if (err instanceof Err3) throw err;
    throw new Err3("Error al obtener el ítem", 500, { id }, err);
  }
};

/* ===========================
 * Creación (ahora con archivos)
 * =========================== */

export const createItem = async (
  data: CreateItemDto,
  files?: Express.Multer.File[]
) => {
  // Validaciones mínimas
  const anyData: any = data;
  if (!anyData?.title) {
    throw new Err3("El título del ítem es obligatorio", 400);
  }
  if (typeof anyData.price !== "number") {
    throw new Err3("El precio del ítem es obligatorio y debe ser numérico", 400);
  }
  if (!anyData.categoryId) {
    throw new Err3("categoryId es obligatorio para crear un ítem", 400);
  }

  try {
    return await withTx(async (t) => {
      const { images = [], ...rest } = anyData;
      const it = await ItemM.create(rest as ItemCreationAttributes, { transaction: t });

      if (images.length) {
        const rows = await Promise.all(
          images.map(async (img: any, idx: number) => {
            const finalUrl = await resolveImageUrl(img, `items/${it.id}`, files);
            return {
              itemId: it.id,
              url: finalUrl,
              alt: img.alt ?? null,
              sortOrder: img.sortOrder ?? idx,
              active: img.active ?? true,
            };
          })
        );
        await ItemImage.bulkCreate(rows, { transaction: t });
      }

      await it.reload({
        include: [
          {
            model: ItemImage,
            as: "images",
            required: false,
            separate: true,
            order: [
              ["sortOrder", "ASC"],
              ["id", "ASC"],
            ],
          },
        ],
        transaction: t,
      });

      return it;
    });
  } catch (err: any) {
    if (err instanceof Err3) throw err;
    throw new Err3("Error al crear ítem", 500, undefined, err);
  }
};

/* ===========================
 * Update — modular (HARD delete de imágenes nuevas con _delete)
 * =========================== */

export const updateItem = async (
  id: number,
  data: UpdateItemDto,
  files?: Express.Multer.File[]
) => {
  if (!id) throw new Err3("ID de ítem inválido", 400);

  try {
    return await withTx(async (t) => {
      const it = await ItemM.findByPk(id, { transaction: t });
      if (!it) throw new Err3("Item no encontrado", 404, { id });

      const anyData: any = data;
      const { images, ...rest } = anyData;

      if (rest && Object.keys(rest).length) {
        await it.update(rest, { transaction: t });
      }

      if (Array.isArray(images)) {
        await upsertItemImages(id, images, files, t);
      }

      await it.reload({
        include: [
          {
            model: ItemImage,
            as: "images",
            required: false,
            separate: true,
            order: [
              ["sortOrder", "ASC"],
              ["id", "ASC"],
            ],
          },
        ],
        transaction: t,
      });

      return it;
    });
  } catch (err: any) {
    if (err instanceof Err3) throw err;
    throw new Err3("Error al actualizar ítem", 500, { id }, err);
  }
};

/* ===========================
 * Helpers específicos de imágenes
 * =========================== */

async function upsertItemImages(
  itemId: number,
  images: any[],
  files: Express.Multer.File[] | undefined,
  t: Transaction
) {
  for (const img of images) {
    if (img._delete) {
      await hardDeleteImage(itemId, img, t);
      continue;
    }
    if (img.id) {
      await updateImagePartial(itemId, img, files, t);
    } else {
      await createImage(itemId, img, files, t);
    }
  }
}

async function hardDeleteImage(itemId: number, img: any, t: Transaction) {
  if (!img.id) throw new Err3("Para borrar una imagen debe enviarse su id", 400);
  await ItemImage.destroy({ where: { id: img.id, itemId }, transaction: t });
}

type ImgInput = { url?: string; fileField?: string };

async function updateImagePartial(
  itemId: number,
  img: ImgInput & Record<string, any>,
  files: Express.Multer.File[] | undefined,
  t: Transaction
) {
  const patch: any = imageBasePatch(img);

  // Si vino nueva imagen (fileField o url), resolvemos url final (S3 / URL)
  if (img.url || img.fileField) {
    const finalUrl = await resolveImageUrl(img, `items/${itemId}`, files);
    patch.url = finalUrl;
  }

  if (Object.keys(patch).length === 0) return; // nada que actualizar

  await ItemImage.update(patch, {
    where: { id: img.id, itemId },
    transaction: t,
  });
}

async function createImage(
  itemId: number,
  img: any,
  files: Express.Multer.File[] | undefined,
  t: Transaction
) {
  const finalUrl = await resolveImageUrl(img, `items/${itemId}`, files);
  await ItemImage.create(
    {
      itemId,
      url: finalUrl,
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
    if (!id) throw new Err3("ID de ítem inválido", 400);

    const it = await ItemM.findByPk(id, { transaction: t });
    if (!it) throw new Err3("Item no encontrado", 404, { id });

    await it.destroy({ transaction: t });
  });
