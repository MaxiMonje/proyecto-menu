import { Router } from "express";
import { validate } from "../middlewares/validate";
import { tenantMiddleware } from "../middlewares/tenant";
import { createMenuSchema, updateMenuSchema } from "../validations/menu.validation";
import { getAllMenus, getMenuById, createMenu, updateMenu, deleteMenu } from "../controllers/menuController";


const menuRouter = Router();


//menuRouter.use(tenantMiddleware);

menuRouter.get("/", getAllMenus);
menuRouter.get("/:id", getMenuById);
menuRouter.post("/", validate(createMenuSchema), createMenu);
menuRouter.put("/:id", validate(updateMenuSchema), updateMenu);
menuRouter.delete("/:id", deleteMenu);
export default menuRouter;