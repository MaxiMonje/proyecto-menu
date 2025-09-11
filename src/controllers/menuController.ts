import { Request, Response, NextFunction } from "express";
import * as menuService from "../services/menuService";


export const getAllMenus = async (_: Request, res: Response, next: NextFunction) => { try { res.json(await menuService.getAllMenus()); } catch (e) { next(e); } };
export const getMenuById = async (req: Request, res: Response, next: NextFunction) => { try { res.json(await menuService.getMenuById(Number(req.params.id))); } catch (e) { next(e); } };
export const createMenu = async (req: Request, res: Response, next: NextFunction) => { try { const created = await menuService.createMenu(req.body); res.status(201).json(created); } catch (e) { next(e); } };
export const updateMenu = async (req: Request, res: Response, next: NextFunction) => { try { const updated = await menuService.updateMenu(Number(req.params.id), req.body); res.json(updated); } catch (e) { next(e); } };
export const deleteMenu = async (req: Request, res: Response, next: NextFunction) => { try { await menuService.deleteMenu(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); } };