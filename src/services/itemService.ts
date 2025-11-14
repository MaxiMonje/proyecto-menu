import { Transaction } from "sequelize";
import sequelize from "../utils/databaseService";

import { Item as ItemM, ItemCreationAttributes } from "../models/Item";
import { Category as CategoryM } from "../models/Category";
import { Menu as MenuM } from "../models/Menu";
import ItemImage from "../models/ItemImage";

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

/* ===========================
 * CRUD con tenant
 * =========================== */

export const getAllItems = async (userId: number) => {
  try {
    return await ItemM.findAll({
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
  } catch (e: any) {
    throw new ApiError("Error al obtener ítems", 500, undefined, e);
  }
};

export const getItemById = async (userId: number, id: number) => {
  return findItemForUser(userId, id);
};

export const createItem = async (userId: number, data: CreateItemDto) => {
  if (!data.categoryId || !data.title || typeof data.price !== "number") {
    throw new ApiError("Datos incompletos para crear ítem", 400);
  }

  // 🛡 chequeamos que la categoría cuelgue de un menú del usuario actual
  await assertCategoryBelongsToUser(data.categoryId, userId);

  try {
    return await withTx(async (t) => {
      const created = await ItemM.create(data as ItemCreationAttributes, { transaction: t });
      return created;
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
  // 🛡 aseguramos que el ítem sea del usuario actual
  const item = await findItemForUser(userId, id);

  // si en algún momento permitís cambiar de categoría, habría que validar la nueva:
  if (data.categoryId) {
    await assertCategoryBelongsToUser(data.categoryId as any, userId);
  }

  try {
    await item.update(data);
    return item;
  } catch (e: any) {
    throw new ApiError("Error al actualizar ítem", 500, undefined, e);
  }
};

export const deleteItem = async (userId: number, id: number) => {
  const item = await findItemForUser(userId, id);

  try {
    await withTx(async (t) => {
      // si querés borrar también las imágenes relacionadas:
      await ItemImage.destroy({ where: { itemId: item.id }, transaction: t });
      await item.destroy({ transaction: t });
    });
  } catch (e: any) {
    throw new ApiError("Error al eliminar ítem", 500, undefined, e);
  }
};
