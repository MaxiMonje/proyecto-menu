import { z } from "zod";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Usá HEX #RRGGBB");
const colorObj = z.object({
  primary: hex,
  secondary: hex,
});

/* ===========================
 * Preprocesamiento tolerante
 * =========================== */
function normalizeBody(input: unknown) {
  const body = (input ?? {}) as any;

  // payload como string JSON
  if (typeof body.payload === "string") {
    try {
      const parsed = JSON.parse(body.payload);
      Object.assign(body, parsed);
    } catch { /* ignore */ }
    delete body.payload;
  }

  // payload como objeto (algunos front lo mandan así)
  if (body.payload && typeof body.payload === "object") {
    Object.assign(body, body.payload);
    delete body.payload;
  }

  // active como string -> boolean
  if (typeof body.active === "string") {
    body.active = body.active === "true";
  }

  // Unificar color desde planos o anidados
  const colorPrimary = body.colorPrimary ?? body.color?.primary;
  const colorSecondary = body.colorSecondary ?? body.color?.secondary;
  if (colorPrimary || colorSecondary) {
    body.color = {
      primary: colorPrimary ?? body.color?.primary ?? "#000000",
      secondary: colorSecondary ?? body.color?.secondary ?? "#FFFFFF",
    };
  }
  delete body.colorPrimary;
  delete body.colorSecondary;

  return body;
}

/* ===========================
 * Bases alineadas al modelo
 * =========================== */
// create: title requerido; active opcional; logo/bg/color pueden ser null o ausentes
const createBase = z.object({
  title: z.string().min(1).max(120),
  active: z.boolean().optional(),
  // Si vienen como URL (no archivo), validar; si no vienen, OK; si vienen null, OK (modelo acepta null)
  logo: z.union([z.string().url().max(255), z.null()]).optional(),
  backgroundImage: z.union([z.string().url().max(255), z.null()]).optional(),
  color: z.union([colorObj, z.null()]).optional(),
  pos: z.union([z.string().max(255), z.null()]).optional(),
});

// update: todos opcionales; mismo criterio de nullables
const updateBase = z.object({
  title: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
  logo: z.union([z.string().url().max(255), z.null()]).optional(),
  backgroundImage: z.union([z.string().url().max(255), z.null()]).optional(),
  color: z.union([colorObj, z.null()]).optional(),
  pos: z.union([z.string().max(255), z.null()]).optional(),
});

/* ===========================
 * Schemas públicos
 * =========================== */
export const createMenuSchema = z.preprocess(normalizeBody, createBase);
export const updateMenuSchema = z.preprocess(normalizeBody, updateBase);
