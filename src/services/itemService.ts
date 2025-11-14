import { Transaction } from "sequelize";
import { Item as ItemM, ItemCreationAttributes } from "../models/Item";
import ItemImage from "../models/ItemImage";
import { CreateItemDto, UpdateItemDto } from "../dtos/item.dto";
import { ApiError as Err3 } from "../utils/ApiError";
import sequelize from "../utils/databaseService";

/* ===========================
 * Helpers genéricos
 * =========================== */

async function withTx<T>(fn: (t: Transaction) => Promise<T>) {
  return sequelize.transaction(fn);
}

/* ===========================
 * Lecturas
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
 * Creación (SOLO ítem)
 * =========================== */

export const createItem = async (data: CreateItemDto) => {
  const anyData: any = data;
  if (!anyData?.title) {
    throw new Err3("El título del ítem es obligatorio", 400);
  }
  if (typeof anyData.price !== "number") {
    throw new Err3(
      "El precio del ítem es obligatorio y debe ser numérico",
      400
    );
  }
  if (!anyData.categoryId) {
    throw new Err3("categoryId es obligatorio para crear un ítem", 400);
  }

  try {
    return await withTx(async (t) => {
      const it = await ItemM.create(
        anyData as ItemCreationAttributes,
        { transaction: t }
      );

      // Opcional: recargar con imágenes asociadas (aunque no creemos ninguna acá)
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
 * Update (SOLO campos del ítem)
 * =========================== */

export const updateItem = async (id: number, data: UpdateItemDto) => {
  if (!id) throw new Err3("ID de ítem inválido", 400);

  try {
    return await withTx(async (t) => {
      const it = await ItemM.findByPk(id, { transaction: t });
      if (!it) throw new Err3("Item no encontrado", 404, { id });

      const anyData: any = data;
      const { images, ...rest } = anyData; // ignoramos images acá a propósito

      if (rest && Object.keys(rest).length) {
        await it.update(rest, { transaction: t });
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
 * Eliminación de Item
 * =========================== */

export const deleteItem = async (id: number) =>
  withTx(async (t) => {
    if (!id) throw new Err3("ID de ítem inválido", 400);

    const it = await ItemM.findByPk(id, { transaction: t });
    if (!it) throw new Err3("Item no encontrado", 404, { id });

    await it.destroy({ transaction: t });
  });
