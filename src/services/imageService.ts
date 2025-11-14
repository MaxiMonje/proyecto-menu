import { Transaction } from "sequelize";
import { ApiError } from "../utils/ApiError";
import { Image as ImageM, ImageCreationAttributes } from "../models/Image";
import ItemImage from "../models/ItemImage";
import sequelize from "../utils/databaseService";
import { ImageS3Service } from "../s3-image-module";
import { CreateImageDto, UpdateImageDto } from "../dtos/image.dto";

/* ============================================================
   Helpers base
   ============================================================ */

function pickFile(files: Express.Multer.File[] | undefined, field?: string) {
  if (!files || !field) return null;
  return files.find((f) => f.fieldname === field) ?? null;
}

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

      if (!up?.url) throw new ApiError("Error al subir imagen a S3", 500);

      return up.url;
    }

    if (img.url) return img.url;

    throw new ApiError("Debe venir url o fileField", 400);
  } catch (err: any) {
    throw new ApiError(
      "Error procesando imagen",
      500,
      { fileField: img.fileField ?? null, url: img.url ?? null },
      err
    );
  }
}

function imageBasePatch(img: any) {
  const patch: any = {};
  if (img.alt !== undefined) patch.alt = img.alt;
  if (img.sortOrder !== undefined) patch.sortOrder = img.sortOrder;
  if (img.active !== undefined) patch.active = img.active;
  return patch;
}

/* ============================================================
   A) CRUD genérico → tabla IMAGES
   ============================================================ */

export const getAllImages = async () => {
  return await ImageM.findAll({
    where: { active: true },
    order: [["id", "ASC"]],
  });
};

export const getImageById = async (id: number) => {
  if (!id) throw new ApiError("ID de imagen inválido", 400);

  const it = await ImageM.findOne({
    where: { id, active: true },
  });

  if (!it) throw new ApiError("Imagen no encontrada", 404, { id });

  return it;
};

export const createImage = async (data: CreateImageDto) => {
  return await ImageM.create(data as ImageCreationAttributes);
};

export const updateImage = async (id: number, data: UpdateImageDto) => {
  if (!id) throw new ApiError("ID de imagen inválido", 400);

  const it = await getImageById(id);
  await it.update(data);
  return it;
};

export const deleteImage = async (id: number) => {
  if (!id) throw new ApiError("ID de imagen inválido", 400);

  const it = await getImageById(id);
  await it.update({ active: false });
};

/* ============================================================
   B) Funciones específicas para ITEM_IMAGE (S3 / upsert)
   ============================================================ */

export const createItemImage = async (
  itemId: number,
  img: any,
  files?: Express.Multer.File[],
  t?: Transaction
) => {
  const url = await resolveImageUrl(img, `items/${itemId}`, files);

  return await ItemImage.create(
    {
      itemId,
      url,
      alt: img.alt ?? null,
      sortOrder: img.sortOrder ?? 0,
      active: img.active ?? true,
    },
    { transaction: t }
  );
};

export const updateItemImage = async (
  itemId: number,
  img: any,
  files?: Express.Multer.File[],
  t?: Transaction
) => {
  if (!img.id) throw new ApiError("ID de imagen requerido", 400);

  const patch: any = imageBasePatch(img);

  // Si vino nueva imagen (url o file), la subimos
  if (img.url || img.fileField) {
    const url = await resolveImageUrl(img, `items/${itemId}`, files);
    patch.url = url;
  }

  if (Object.keys(patch).length === 0) return;

  await ItemImage.update(patch, {
    where: { id: img.id, itemId },
    transaction: t,
  });
};

export const deleteItemImage = async (
  itemId: number,
  imgId: number,
  t?: Transaction
) => {
  return await ItemImage.destroy({
    where: { id: imgId, itemId },
    transaction: t,
  });
};

/* ============================================================
   C) UPSERT para listas de imágenes dentro de un ítem
   ============================================================ */

export const upsertItemImages = async (
  itemId: number,
  images: any[],
  files?: Express.Multer.File[],
  t?: Transaction
) => {
  for (const img of images) {
    if (img._delete) {
      await deleteItemImage(itemId, img.id, t);
      continue;
    }

    if (img.id) {
      await updateItemImage(itemId, img, files, t);
    } else {
      await createItemImage(itemId, img, files, t);
    }
  }
};
