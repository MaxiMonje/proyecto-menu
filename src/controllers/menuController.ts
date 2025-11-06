import { Request, Response, NextFunction } from "express";
import * as menuService from "../services/menuService";

/* ===========================
 * Helpers
 * =========================== */

// Si viene multipart con 'payload' como string JSON, lo parsea.
// Si no, devuelve req.body plano.
function extractData<T = any>(body: any): T {
  if (body && typeof body.payload === "string") {
    try {
      const parsed = JSON.parse(body.payload);
      // Mergea ambos: prioriza payload, pero conserva campos planos
      return { ...body, ...parsed } as T;
    } catch {
      // Si falla el parseo, sigue con body plano
    }
  }
  return body as T;
}

// Unifica color desde colorPrimary/colorSecondary o color.primary/secondary
function normalizeMenuInput(data: any) {
  const out: any = { ...data };

  // Normaliza booleanos enviados como string (en multipart)
  if (typeof out.active === "string") {
    out.active = out.active === "true";
  }

  // Unifica color desde colorPrimary/colorSecondary o color.primary/secondary
  const cPrimary = out.colorPrimary ?? out.color?.primary;
  const cSecondary = out.colorSecondary ?? out.color?.secondary;

  if (cPrimary || cSecondary) {
    out.color = {
      primary: cPrimary ?? out.color?.primary ?? "#000000",
      secondary: cSecondary ?? out.color?.secondary ?? "#FFFFFF",
    };
  }

  // Limpieza de campos innecesarios
  delete out.payload;
  delete out.colorPrimary;
  delete out.colorSecondary;

  return out;
}

/* ===========================
 * Controladores
 * =========================== */

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
 * ✅ Soporta:
 *   - Campos simples (title, active, colorPrimary, colorSecondary)
 *   - payload={...} con color.primary/secondary
 *   - Archivos: logo, backgroundImage
 */
export const createMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.tenant!.id;
    const files = (req.files ?? []) as Express.Multer.File[];

    const raw = extractData(req.body);
    const data = normalizeMenuInput(raw);

    const created = await menuService.createMenu(userId, data, files);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
};

/**
 * Actualizar un menú existente dentro del tenant
 * ✅ Soporta los mismos dos formatos y archivos
 */
export const updateMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.tenant!.id;
    const files = (req.files ?? []) as Express.Multer.File[];

    const raw = extractData(req.body);
    const data = normalizeMenuInput(raw);

    const updated = await menuService.updateMenu(userId, Number(req.params.id), data, files);
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
