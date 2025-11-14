import { Transaction } from "sequelize";
import { ApiError } from "../utils/ApiError";
import { Image as ImageM, ImageCreationAttributes } from "../models/Image";
import ItemImage from "../models/ItemImage";
import { Menu as MenuM } from "../models/Menu";
import { Item as ItemM } from "../models/Item";
import { Category as CategoryM } from "../models/Category";
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

async function withTx<T>(fn: (t: Transaction) => Promise<T>) {
  return sequelize.transaction(fn);
}

/* ============================================================
   Helpers de tenant
   ============================================================ */

/** Menú debe ser del usuario actual */
async function assertMenuBelongsToUser(menuId: number, userId: number) {
  const menu = await MenuM.findOne({
    where: { id: menuId, userId, active: true },
  });

  if (!menu) {
    throw new ApiError("No tenés permiso para usar este menú", 403);
  }
}

/** Item debe ser del usuario actual (Item -> Category -> Menu.userId) */
async function assertItemBelongsToUser(itemId: number, userId: number) {
  const item = await ItemM.findOne({
    where: { id: itemId, active: true },
    include: [
      {
        model: CategoryM,
        as: "category",
        include: [
          {
            model: MenuM,
            as: "menu",
            where: { userId, active: true },
          },
        ],
      },
    ],
  });

  if (!item) {
    throw new ApiError("Ítem no encontrado", 404);
  }

  return item;
}

/* ============================================================
   A) CRUD genérico → tabla IMAGES (por menú, multi-tenant)
   ============================================================ */

export const getAllImages = async (userId: number) => {
  return await ImageM.findAll({
    where: { active: true },
    include: [
      {
        model: MenuM,
        as: "menu",
        where: { userId, active: true },
      },
    ],
    order: [["id", "ASC"]],
  });
};

export const getImageById = async (userId: number, id: number) => {
  if (!id) throw new ApiError("ID de imagen inválido", 400);

  const it = await ImageM.findOne({
    where: { id, active: true },
    include: [
      {
        model: MenuM,
        as: "menu",
        where: { userId, active: true },
      },
    ],
  });

  if (!it) throw new ApiError("Imagen no encontrada", 404, { id });

  return it;
};

export const createImage = async (userId: number, data: CreateImageDto) => {
  if (!data.menuId || !data.url) {
    throw new ApiError("Datos incompletos para crear imagen", 400);
  }

  await assertMenuBelongsToUser(data.menuId, userId);

  return await ImageM.create(data as ImageCreationAttributes);
};

export const updateImage = async (
  userId: number,
  id: number,
  data: UpdateImageDto
) => {
  const it = await getImageById(userId, id);
  await it.update(data);
  return it;
};

export const deleteImage = async (userId: number, id: number) => {
  const it = await getImageById(userId, id);
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
   C) UPSERT para listas de imágenes dentro de un ítem (multi-tenant)
   ============================================================ */

export const upsertItemImages = async (
  userId: number,
  itemId: number,
  images: any[],
  files?: Express.Multer.File[]
) => {
  // 🛡 El ítem tiene que ser del usuario actual
  await assertItemBelongsToUser(itemId, userId);

  return await withTx(async (t) => {
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
  });
};
