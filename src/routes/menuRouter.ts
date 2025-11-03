import { Router } from "express";
import { validate } from "../middlewares/validate";
import { createMenuSchema, updateMenuSchema } from "../validations/menu.validation";
import { getAllMenus, getMenuById, createMenu, updateMenu, deleteMenu } from "../controllers/menuController";
import { uploadMiddleware } from "../s3-image-module";


const menuRouter = Router();

menuRouter.get("/", getAllMenus);
menuRouter.get("/:id", getMenuById);
menuRouter.post("/", uploadMiddleware.any(), validate(createMenuSchema), createMenu);
menuRouter.put("/:id", uploadMiddleware.any(), validate(updateMenuSchema), updateMenu);
menuRouter.delete("/:id", deleteMenu);
export default menuRouter;