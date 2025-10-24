import { Menu as MenuM, MenuCreationAttributes } from "../models/Menu";
import { CreateMenuDto, UpdateMenuDto } from "../dtos/menu.dto";
import { ApiError } from "../utils/ApiError";

import { Transaction } from "sequelize";
import { Menu } from "../models/Menu";
import { Category } from "../models/Category";
import { Item } from "../models/Item";
import ItemImage from "../models/ItemImage";

/**
 * Obtener todos los menús activos de un tenant (por userId)
 */
export const getAllMenus = async (userId: number) => {
  return Menu.findAll({
    where: { active: true, userId },
    order: [["id", "ASC"]],
  });
};

/**
 * Obtener un menú simple (sin relaciones)
 */
export const jgetMenuById = async (id: number) => {
  const menu = await MenuM.findOne({ where: { id, active: true } });
  if (!menu) throw new ApiError("Menu not found", 404);
  return menu;
};

/**
 * Crear un menú dentro del tenant actual (userId)
 */
export const createMenu = async (userId: number, data: CreateMenuDto) => {
  return MenuM.create({ ...(data as MenuCreationAttributes), userId });
};

/**
 * Actualizar un menú existente (scope por tenant)
 */
export const updateMenu = async (userId: number, id: number, data: UpdateMenuDto) => {
  const menu = await getMenuById(userId, id);
  await menu.update(data);
  return menu;
};

/**
 * Baja lógica de un menú (scope por tenant)
 */
export const deleteMenu = async (userId: number, id: number) => {
  const menu = await getMenuById(userId, id);
  await menu.update({ active: false });
};

/**
 * Obtener un menú con toda su jerarquía (categorías, ítems e imágenes)
 */
export const getMenuById = async (userId: number, id: number, t?: Transaction) => {
  const menu = await Menu.findOne({
    where: { id, userId },
    include: [
      {
        model: Category,
        as: "categories",
        required: false,
        include: [
          {
            model: Item,
            as: "items",
            required: false,
            include: [
              {
                model: ItemImage,
                as: "images",
                required: false,
                separate: true,
                order: [["sortOrder", "ASC"], ["id", "ASC"]],
              },
            ],
            order: [["id", "ASC"]],
          },
        ],
        order: [["id", "ASC"]],
      },
    ],
    transaction: t,
    order: [[{ model: Category, as: "categories" }, "id", "ASC"]],
  });

  if (!menu) throw new ApiError("Menu not found", 404);
  return menu;
};