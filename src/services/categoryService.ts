import { Category as CategoryM, CategoryCreationAttributes } from "../models/Category";
import { Menu as MenuM } from "../models/Menu";
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

/* ===========================
 * CRUD base con tenant
 * =========================== */

export const getAllCategories = async (userId: number) => {
  try {
    return await CategoryM.findAll({
      where: { active: true },
      include: [
        {
          model: MenuM,
          as: "menu",       // <-- asegurate de tener Category.belongsTo(Menu, { as: "menu", foreignKey: "menuId" })
          where: { userId }, // solo menús del usuario actual
        },
      ],
      order: [["id", "ASC"]],
    });
  } catch (e: any) {
    throw new ApiError("Error al obtener categorías", 500, undefined, e);
  }
};

export const getCategoryById = async (userId: number, id: number) => {
  if (!id) throw new ApiError("ID de categoría inválido", 400);

  const it = await CategoryM.findOne({
    where: { id, active: true },
    include: [
      {
        model: MenuM,
        as: "menu",
        where: { userId },
      },
    ],
  });

  if (!it) throw new ApiError("Categoría no encontrada", 404);
  return it;
};

export const createCategory = async (userId: number, data: CreateCategoryDto) => {
  if (!data.title || !data.menuId) {
    throw new ApiError("Datos incompletos para crear categoría", 400);
  }

  // 🛡 aseguramos que el menú sea del usuario actual
  await assertMenuBelongsToUser(data.menuId, userId);

  try {
    return await CategoryM.create(data as CategoryCreationAttributes);
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
    // 👇 Ahora buscamos la categoría por ID SIN filtrar por active
    const it = await CategoryM.findOne({
      where: { id },
      include: [
        {
          model: MenuM,
          as: "menu",
          where: { userId }, // validamos multi-tenant
        },
      ],
    });

    if (!it) {
      throw new ApiError("Category not found", 404, { userId, id });
    }

    // Aplicar patch (acepta active true o false)
    await it.update(data);

    return it;
  } catch (e: any) {
    throw new ApiError("Error al actualizar categoría", 500, undefined, e);
  }
};

export const deleteCategory = async (userId: number, id: number) => {
  const it = await getCategoryById(userId, id);
  try {
    await it.destroy();
  } catch (e: any) {
    throw new ApiError("Error al eliminar categoría", 500, undefined, e);
  }
};
