import { Transaction } from "sequelize";
import sequelize from "../utils/databaseService";

import { Item as ItemM, ItemCreationAttributes } from "../models/Item";
import { Category as CategoryM } from "../models/Category";
import { Menu as MenuM } from "../models/Menu";
import ItemImage from "../models/ItemImage";
import { URL } from "url";
import { ImageS3Service } from "../s3-image-module";

import { CreateItemDto, UpdateItemDto } from "../dtos/item.dto";
import { ApiError } from "../utils/ApiError";

/* ===========================
 * Helper genérico de TX
 * =========================== */
async function withTx<T>(fn: (t: Transaction) => Promise<T>) {
  return sequelize.transaction(fn);
}

/* ===========================
 * Helpers de tenant
 * =========================== */

/**
 * Verifica que la categoría pertenezca a un menú del usuario (tenant).
 * Si no es así, tira 403.
 */
async function assertCategoryBelongsToUser(categoryId: number, userId: number) {
  const category = await CategoryM.findOne({
    where: { id: categoryId, active: true },
    include: [
      {
        model: MenuM,
        as: "menu",
        where: { userId, active: true },
      },
    ],
  });

  if (!category) {
    throw new ApiError("No tenés permiso para usar esta categoría", 403);
  }
}

/**
 * Busca un ítem por ID asegurando que pertenezca al usuario (tenant),
 * navegando Item -> Category -> Menu.userId.
 */
async function findItemForUser(userId: number, itemId: number) {
  if (!itemId) throw new ApiError("ID de ítem inválido", 400);

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
      {
        model: ItemImage,
        as: "images",
        separate: true,
        order: [["sortOrder", "ASC"]],
      },
    ],
  });

  if (!item) {
    throw new ApiError("Ítem no encontrado", 404);
  }

  return item;
}

function formatItemResponse(item: ItemM) {
  const plain = item.get({ plain: true }) as any;
  delete plain.category;
  return plain;
}

function extractS3Key(imageUrl?: string | null) {
  if (!imageUrl) return null;
  try {
    const parsed = new URL(imageUrl);
    const key = parsed.pathname.replace(/^\/+/, "");
    return key || null;
  } catch {
    return null;
  }
}

async function deleteImageFromS3(imageUrl?: string | null) {
  const key = extractS3Key(imageUrl);
  if (!key) return;
  await ImageS3Service.deleteImage(key);
}

async function deleteItemImagesFromS3(images?: ItemImage[]) {
  if (!Array.isArray(images)) return;
  for (const image of images) {
    await deleteImageFromS3(image?.url);
  }
}

/* ===========================
 * CRUD con tenant
 * =========================== */

export const getAllItems = async (userId: number) => {
  try {
    const items = await ItemM.findAll({
      where: { active: true },
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
        {
          model: ItemImage,
          as: "images",
          separate: true,
          order: [["sortOrder", "ASC"]],
        },
      ],
      order: [["id", "ASC"]],
    });

    return items.map(formatItemResponse);
  } catch (e: any) {
    throw new ApiError("Error al obtener ítems", 500, undefined, e);
  }
};

export const getItemById = async (userId: number, id: number) => {
  const item = await findItemForUser(userId, id);
  return formatItemResponse(item);
};

export const createItem = async (userId: number, data: CreateItemDto) => {
  if (!data.categoryId || !data.title) {
    throw new ApiError("Datos incompletos para crear ítem", 400);
  }

  // 🛡 chequeamos que la categoría cuelgue de un menú del usuario actual
  await assertCategoryBelongsToUser(data.categoryId, userId);

  try {
    return await withTx(async (t) => {
      const created = await ItemM.create(data as ItemCreationAttributes, { transaction: t });
      return formatItemResponse(created);
    });
  } catch (e: any) {
    throw new ApiError("Error al crear ítem", 500, undefined, e);
  }
};

export const updateItem = async (
  userId: number,
  id: number,
  data: UpdateItemDto
) => {
  if (!userId) throw new ApiError("ID de usuario (tenant) inválido", 400);
  if (!id) throw new ApiError("ID de ítem inválido", 400);

  try {
    // 🛡 Buscamos el item SIN filtrar por active, pero validando tenant por la cadena Item -> Category -> Menu -> User
    const item = await ItemM.findOne({
      where: { id },
      include: [
        {
          model: CategoryM,
          as: "category",
          include: [
            {
              model: MenuM,
              as: "menu",
              where: { userId },
            },
          ],
        },
      ],
    });

    if (!item) {
      throw new ApiError("Item not found", 404, { userId, id });
    }

    // Si permitís cambiar de categoría, validamos que la nueva también sea del mismo user
    if (data.categoryId) {
      await assertCategoryBelongsToUser(data.categoryId as any, userId);
    }

    await item.update(data);
    return formatItemResponse(item);
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Error al actualizar ítem", 500, undefined, e);
  }
};

export const deleteItem = async (userId: number, id: number) => {
  const item = await findItemForUser(userId, id);

  try {
    await deleteItemImagesFromS3(((item as any).images ?? []) as ItemImage[]);
    await withTx(async (t) => {
      // si querés borrar también las imágenes relacionadas:
      await ItemImage.destroy({ where: { itemId: item.id }, transaction: t });
      await item.destroy({ transaction: t });
    });
  } catch (e: any) {
    throw new ApiError("Error al eliminar ítem", 500, undefined, e);
  }
};
