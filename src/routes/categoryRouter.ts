import { Router as R3 } from "express";
import { validate as v3, validate } from "../middlewares/validate";
import {  createCategoryWithChildrenBodySchema, updateCategorySchema, updateCategoryWithChildrenBodySchema } from "../validations/category.validation";
import { getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController";


const categoryRouter = R3();
categoryRouter.get("/", getAllCategories);
categoryRouter.get("/:id", getCategoryById);
categoryRouter.post("/", validate(createCategoryWithChildrenBodySchema), createCategory);
categoryRouter.put("/:id", validate(updateCategoryWithChildrenBodySchema ), updateCategory);
categoryRouter.delete("/:id", deleteCategory);
export default categoryRouter;