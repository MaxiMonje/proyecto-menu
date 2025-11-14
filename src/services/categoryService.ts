import { Category as CategoryM, CategoryCreationAttributes } from "../models/Category";
import { CreateCategoryDto, UpdateCategoryDto } from "../dtos/category.dto";
import { ApiError } from "../utils/ApiError";

/* ===========================
 * CRUD base
 * =========================== */

export const getAllCategories = async () => {
  try {
    return await CategoryM.findAll({ where: { active: true }, order: [["id", "ASC"]] });
  } catch (e: any) {
    throw new ApiError("Error al obtener categorías", 500, undefined, e);
  }
};

export const getCategoryById = async (id: number) => {
  if (!id) throw new ApiError("ID de categoría inválido", 400);
  const it = await CategoryM.findOne({ where: { id, active: true } });
  if (!it) throw new ApiError("Categoría no encontrada", 404);
  return it;
};

export const createCategory = async (data: CreateCategoryDto) => {
  if (!data.title || !data.menuId) {
    throw new ApiError("Datos incompletos para crear categoría", 400);
  }
  try {
    return await CategoryM.create(data as CategoryCreationAttributes);
  } catch (e: any) {
    throw new ApiError("Error al crear categoría", 500, undefined, e);
  }
};

export const updateCategory = async (id: number, data: UpdateCategoryDto) => {
  const it = await getCategoryById(id);
  try {
    await it.update(data);
    return it;
  } catch (e: any) {
    throw new ApiError("Error al actualizar categoría", 500, undefined, e);
  }
};

export const deleteCategory = async (id: number) => {
  const it = await getCategoryById(id);
  try {
    await it.destroy();
  } catch (e: any) {
    throw new ApiError("Error al eliminar categoría", 500, undefined, e);
  }
};

