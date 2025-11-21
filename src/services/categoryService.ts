import { Category as CategoryM, CategoryCreationAttributes } from "../models/Category";
import { Menu as MenuM } from "../models/Menu";
import { Item as ItemM } from "../models/Item";
import ItemImage from "../models/ItemImage";
import { Transaction } from "sequelize";
import sequelize from "../utils/databaseService";
import { URL } from "url";
import { ImageS3Service } from "../s3-image-module";
import { CreateCategoryDto, UpdateCategoryDto } from "../dtos/category.dto";
import { ApiError } from "../utils/ApiError";

/* ===========================
 * Helpers de tenant
 * =========================== */

/**
 * Verifica que el menú pertenezca al usuario (tenant).
 * Tira 403 si el menú no existe o no es del usuario.
 */
async function assertMenuBelongsToUser(menuId: number, userId: number) {
  const menu = await MenuM.findOne({
    where: {
      id: menuId,
      userId,
      active: true,
    },
  });

  if (!menu) {
    throw new ApiError("No tenés permiso para usar este menú", 403);
  }
}

interface FindCategoryOptions {
  includeItems?: boolean;
  activeOnly?: boolean;
}

function buildItemsInclude() {
  return {
    model: ItemM,
    as: "items",
    required: false,
    include: [
      {
        model: ItemImage,
        as: "images",
        required: false,
      },
    ],
  };
}

async function findCategoryForUser(
  userId: number,
  id: number,
  options: FindCategoryOptions = {}
) {
  const { includeItems = false, activeOnly = false } = options;
  const include: any[] = [
    {
      model: MenuM,
      as: "menu",
      where: { userId },
      attributes: [],
    },
  ];

  if (includeItems) {
    include.push(buildItemsInclude());
  }

  const where: any = { id };
  if (activeOnly) where.active = true;

  const category = await CategoryM.findOne({
    where,
    include,
  });

  if (!category) {
    throw new ApiError("Categoría no encontrada", 404);
  }

  return category;
}

function formatCategoryResponse(category: CategoryM) {
  const plain = category.get({ plain: true }) as any;
  delete plain.menu;
  delete plain.items;
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

async function deleteItemImages(
  item: ItemM & { images?: ItemImage[] },
  t?: Transaction
) {
  if (!Array.isArray(item.images)) return;
  for (const image of item.images) {
    await deleteImageFromS3(image?.url);
    await image.destroy({ transaction: t });
  }
}

async function deleteItemsForCategory(
  category: CategoryM & { items?: ItemM[] },
  t?: Transaction
) {
  if (!Array.isArray(category.items)) return;
  for (const item of category.items) {
    await deleteItemImages(item as any, t);
    await item.destroy({ transaction: t });
  }
}

/* ===========================
 * CRUD base con tenant
 * =========================== */

export const getAllCategories = async (userId: number) => {
  try {
    const categories = await CategoryM.findAll({
      where: { active: true },
      include: [
        {
          model: MenuM,
          as: "menu",
          where: { userId },
          attributes: [],
        },
      ],
      order: [["id", "ASC"]],
    });
    return categories.map(formatCategoryResponse);
  } catch (e: any) {
    throw new ApiError("Error al obtener categorías", 500, undefined, e);
  }
};

export const getCategoryById = async (userId: number, id: number) => {
  if (!id) throw new ApiError("ID de categoría inválido", 400);

  const category = await findCategoryForUser(userId, id, { activeOnly: true });
  return formatCategoryResponse(category);
};

export const createCategory = async (userId: number, data: CreateCategoryDto) => {
  if (!data.title || !data.menuId) {
    throw new ApiError("Datos incompletos para crear categoría", 400);
  }

  // 🛡 aseguramos que el menú sea del usuario actual
  await assertMenuBelongsToUser(data.menuId, userId);

  try {
    const created = await CategoryM.create(data as CategoryCreationAttributes);
    return formatCategoryResponse(created);
  } catch (e: any) {
    throw new ApiError("Error al crear categoría", 500, undefined, e);
  }
};

export const updateCategory = async (
  userId: number,
  id: number,
  data: UpdateCategoryDto
) => {
  try {
    const it = await findCategoryForUser(userId, id, { activeOnly: false });

    // Aplicar patch (acepta active true o false)
    await it.update(data);

    return formatCategoryResponse(it);
  } catch (e: any) {
    throw new ApiError("Error al actualizar categoría", 500, undefined, e);
  }
};

export const deleteCategory = async (userId: number, id: number) => {
  const category = await findCategoryForUser(userId, id, {
    activeOnly: true,
    includeItems: true,
  });
  try {
    await sequelize.transaction(async (t) => {
      await deleteItemsForCategory(category as any, t);
      await category.destroy({ transaction: t });
    });
  } catch (e: any) {
    throw new ApiError("Error al eliminar categoría", 500, undefined, e);
  }
};
