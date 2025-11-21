import { Request, Response, NextFunction } from "express";
import * as menuService from "../services/menuService";

/* ===========================
 * Controladores
 * =========================== */

export const getAllMenus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const menus = await menuService.getAllMenus(req.tenant!.id);
    res.json(menus);
  } catch (e) {
    next(e);
  }
};

export const getMenuById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const menu = await menuService.getMenuById(req.tenant!.id, Number(req.params.id));
    res.json(menu);
  } catch (e) {
    next(e);
  }
};

export const createMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.tenant!.id;
    const files = (req.files ?? []) as Express.Multer.File[];

    // 💡 req.body YA viene validado y normalizado por Zod (createMenuSchema)
    const data = req.body as any;

    const created = await menuService.createMenu(userId, data, files);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
};

export const updateMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.tenant!.id;
    const files = (req.files ?? []) as Express.Multer.File[];

    // 💡 req.body YA viene validado y normalizado por Zod (updateMenuSchema)
    const data = req.body as any;

    const updated = await menuService.updateMenu(
      userId,
      Number(req.params.id),
      data,
      files
    );

    res.json(updated);
  } catch (e) {
    next(e);
  }
};

export const deleteMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await menuService.deleteMenu(req.tenant!.id, Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};
