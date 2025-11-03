import { Transaction } from "sequelize";
import { Menu as MenuM, MenuCreationAttributes } from "../models/Menu";
import { CreateMenuDto, UpdateMenuDto } from "../dtos/menu.dto";
import { ApiError } from "../utils/ApiError";
import sequelize from "../utils/databaseService";
import { ImageS3Service } from "../s3-image-module";

import { Category } from "../models/Category";
import { Item } from "../models/Item";
import ItemImage from "../models/ItemImage";

/* ===========================
 * Helpers comunes
 * =========================== */

function pickFile(files: Express.Multer.File[] | undefined, field?: string) {
  if (!files || !field) return null;
  return files.find(f => f.fieldname === field) ?? null;
}

async function resolveMenuImage(
  files: Express.Multer.File[] | undefined,
  fieldName: string,
  folder: string
): Promise<string | null> {
  const file = pickFile(files, fieldName);
  if (!file) return null;

  const up = await ImageS3Service.uploadImage(file as any, folder, {
    maxWidth: 1600,
    maxHeight: 1600,
  });
  return up.url;
}

/* ===========================
 * CRUD con subida a S3
 * =========================== */

/** Obtener todos los menús activos del tenant */
export const getAllMenus = async (userId: number) => {
  return MenuM.findAll({
    where: { active: true, userId },
    order: [["id", "ASC"]],
  });
};

/** Obtener un menú con toda su jerarquía */
export const getMenuById = async (userId: number, id: number, t?: Transaction) => {
  const menu = await MenuM.findOne({
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

/** Crear menú (con logo y background opcionales) */
export const createMenu = async (
  userId: number,
  data: CreateMenuDto,
  files?: Express.Multer.File[]
) => {
  return await sequelize.transaction(async (t: Transaction) => {
    const menu = await MenuM.create(
      {
        ...(data as MenuCreationAttributes),
        userId,
        active: data.active ?? true,
      },
      { transaction: t }
    );

    // Subir archivos si vinieron
    const logoUrl = await resolveMenuImage(files, "logo", `menus/${menu.id}`);
    const bgUrl = await resolveMenuImage(files, "backgroundImage", `menus/${menu.id}`);

    if (logoUrl || bgUrl) {
      await menu.update(
        {
          ...(logoUrl ? { logo: logoUrl } : {}),
          ...(bgUrl ? { backgroundImage: bgUrl } : {}),
        },
        { transaction: t }
      );
    }

    return menu;
  });
};

/** Actualizar menú existente */
export const updateMenu = async (
  userId: number,
  id: number,
  data: UpdateMenuDto,
  files?: Express.Multer.File[]
) => {
  return await sequelize.transaction(async (t: Transaction) => {
    const menu = await MenuM.findOne({ where: { id, userId }, transaction: t });
    if (!menu) throw new ApiError("Menu not found", 404);

    const patch: any = {};
    if (typeof data.title === "string") patch.title = data.title;
    if (typeof data.active === "boolean") patch.active = data.active;
    if (typeof data.pos === "string") patch.pos = data.pos;
    if (data.color) patch.color = data.color;

    // Subir imágenes nuevas
    const logoUrl = await resolveMenuImage(files, "logo", `menus/${menu.id}`);
    const bgUrl = await resolveMenuImage(files, "backgroundImage", `menus/${menu.id}`);

    if (logoUrl) patch.logo = logoUrl;
    if (bgUrl) patch.backgroundImage = bgUrl;

    if (Object.keys(patch).length > 0) {
      await menu.update(patch, { transaction: t });
    }

    return menu;
  });
};

/** Baja lógica */
export const deleteMenu = async (userId: number, id: number) => {
  const menu = await MenuM.findOne({ where: { id, userId } });
  if (!menu) throw new ApiError("Menu not found", 404);
  await menu.update({ active: false });
};
