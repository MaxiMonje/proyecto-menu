import { Request, Response, NextFunction } from "express";
import * as menuService from "../services/menuService";

/**
 * Obtener todos los menús del tenant actual
 */
export const getAllMenus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const menus = await menuService.getAllMenus(req.tenant!.id);
    res.json(menus);
  } catch (e) {
    next(e);
  }
};

/**
 * Obtener un menú por ID (dentro del tenant)
 */
export const getMenuById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const menu = await menuService.getMenuById(req.tenant!.id, Number(req.params.id));
    res.json(menu);
  } catch (e) {
    next(e);
  }
};

/**
 * Crear un nuevo menú dentro del tenant actual
 */
export const createMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await menuService.createMenu(req.tenant!.id, req.body);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
};

/**
 * Actualizar un menú existente dentro del tenant
 */
export const updateMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await menuService.updateMenu(req.tenant!.id, Number(req.params.id), req.body);
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

/**
 * Eliminar (baja lógica) un menú del tenant actual
 */
export const deleteMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await menuService.deleteMenu(req.tenant!.id, Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};
