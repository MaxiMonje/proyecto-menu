import { Menu as MenuM, MenuCreationAttributes } from "../models/Menu";
import { CreateMenuDto, UpdateMenuDto } from "../dtos/menu.dto";
import { ApiError } from "../utils/ApiError";

import { Transaction } from "sequelize";
import { Menu } from "../models/Menu";
import { Category } from "../models/Category";
import { Item } from "../models/Item";
import ItemImage from "../models/ItemImage";


export const getAllMenus = async () => MenuM.findAll({ where: { active: true }, order: [["id", "ASC"]] });

export const jgetMenuById = async (id: number) => {
    const menu = await MenuM.findOne({ where: { id, active: true } });
    if (!menu) throw new ApiError("Menu not found", 404);
return menu;
};

export const createMenu = async (data: CreateMenuDto) => MenuM.create(data as MenuCreationAttributes);

export const updateMenu = async (id: number, data: UpdateMenuDto) => {
    const menu = await getMenuById(id);
    await menu.update(data);
return menu;
};

export const deleteMenu = async (id: number) => {
    const menu = await getMenuById(id);
    await menu.update({ active: false });
};


export const getMenuById = async (id: number, t?: Transaction) => {
  const menu = await Menu.findOne({
    where: { id },
    include: [
      {
        model: Category,
        as: "categories",
        required: false,               // trae el menú aunque no tenga categorías
        separate: false,
        // Si usás flags de visibilidad, podés filtrar:
        // where: { active: true },
        include: [
          {
            model: Item,
            as: "items",
            required: false,           // trae la categoría aunque no tenga items
            // where: { active: true }, // si usás active en items
            include: [
              {
                model: ItemImage,
                as: "images",
                required: false,       // items sin imágenes también aparecen
                // where: { active: true }, // si mantenés este flag
                separate: true,        // ordena por tabla hija sin inflar el JOIN
                order: [["sortOrder", "ASC"], ["id", "ASC"]],
              },
            ],
            order: [["id", "ASC"]],    // o [["sortOrder", "ASC"]], si tenés esa columna en items
          },
        ],
        order: [["id", "ASC"]],        // o [["sortOrder", "ASC"]] si tu Category tiene sort
      },
    ],
    transaction: t,
    order: [[{ model: Category, as: "categories" }, "id", "ASC"]], // orden de categorías a nivel raíz
  });

  if (!menu) throw new ApiError("Menu not found", 404);
  return menu;
};