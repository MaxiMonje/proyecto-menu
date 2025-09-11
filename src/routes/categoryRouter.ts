import { Router as R3 } from "express";
import { validate as v3 } from "../middlewares/validate";
import { createCategorySchema, updateCategorySchema } from "../validations/category.validation";
import { getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController";


const categoryRouter = R3();
categoryRouter.get("/", getAllCategories);
categoryRouter.get("/:id", getCategoryById);
categoryRouter.post("/", v3(createCategorySchema), createCategory);
categoryRouter.put("/:id", v3(updateCategorySchema), updateCategory);
categoryRouter.delete("/:id", deleteCategory);
export default categoryRouter;