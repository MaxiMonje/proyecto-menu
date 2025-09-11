import { Category as CategoryM, CategoryCreationAttributes } from "../models/Category";
import { CreateCategoryDto, UpdateCategoryDto } from "../dtos/category.dto";
import { ApiError as Err2 } from "../utils/ApiError";


export const getAllCategories = async () => CategoryM.findAll({ where: { active: true }, order: [["id", "ASC"]] });
export const getCategoryById = async (id: number) => {
const it = await CategoryM.findOne({ where: { id, active: true } });
if (!it) throw new Err2("Category not found", 404);
return it;
};
export const createCategory = async (data: CreateCategoryDto) => CategoryM.create(data as CategoryCreationAttributes);
export const updateCategory = async (id: number, data: UpdateCategoryDto) => {
const it = await getCategoryById(id);
await it.update(data);
return it;
};
export const deleteCategory = async (id: number) => { const it = await getCategoryById(id); await it.update({ active: false }); };