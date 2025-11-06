import { z } from "zod";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Usá HEX #RRGGBB");
const colorObj = z.object({ primary: hex, secondary: hex });

// ---------- Helpers de normalización dentro del schema ----------
const normalizeFromFlatColor = <T extends { color?: any; colorPrimary?: string; colorSecondary?: string }>(data: T) => {
  const hasFlat = !!(data.colorPrimary || data.colorSecondary);
  const color = hasFlat
    ? {
        primary: data.colorPrimary ?? data.color?.primary ?? "#000000",
        secondary: data.colorSecondary ?? data.color?.secondary ?? "#FFFFFF",
      }
    : data.color;
  
  delete (data as any).colorPrimary;

  delete (data as any).colorSecondary;
  return { ...data, color };
};

// ---------- Bases “finales” (lo que tu service espera) ----------
const createBase = z.object({
  title: z.string().min(1).max(120),
  active: z.coerce.boolean().optional(),
  // Si mandan URL en vez de archivo, la validamos; si suben archivo, estos campos no vienen
  logo: z.string().url().max(255).optional(),
  backgroundImage: z.string().url().max(255).optional(),
  color: colorObj.optional(),
  pos: z.string().max(255).optional(),
});

const updateBase = z.object({
  title: z.string().min(1).max(120).optional(),
  active: z.coerce.boolean().optional(),
  logo: z.string().url().max(255).optional(),
  backgroundImage: z.string().url().max(255).optional(),
  color: colorObj.optional(),
  pos: z.string().max(255).optional(),
});

// ---------- Alternativa 1: payload como string JSON (multipart) ----------
const fromPayloadCreate = z
  .object({ payload: z.string() })
  .transform(({ payload }) => {
    const parsed = JSON.parse(payload);
    return normalizeFromFlatColor(parsed);
  })
  .pipe(createBase);

const fromPayloadUpdate = z
  .object({ payload: z.string() })
  .transform(({ payload }) => {
    const parsed = JSON.parse(payload);
    return normalizeFromFlatColor(parsed);
  })
  .pipe(updateBase);

// ---------- Alternativa 2: campos planos (sin payload) con colorPrimary/Secondary ----------
const fromFlatCreate = z
  .object({
    title: z.string().min(1).max(120),
    active: z.coerce.boolean().optional(),
    colorPrimary: hex.optional(),
    colorSecondary: hex.optional(),
    logo: z.string().url().max(255).optional(),
    backgroundImage: z.string().url().max(255).optional(),
    pos: z.string().max(255).optional(),
    // permitir también color anidado si lo mandan así
    color: colorObj.optional(),
  })
  .transform(normalizeFromFlatColor)
  .pipe(createBase);

const fromFlatUpdate = z
  .object({
    title: z.string().min(1).max(120).optional(),
    active: z.coerce.boolean().optional(),
    colorPrimary: hex.optional(),
    colorSecondary: hex.optional(),
    logo: z.string().url().max(255).optional(),
    backgroundImage: z.string().url().max(255).optional(),
    pos: z.string().max(255).optional(),
    color: colorObj.optional(),
  })
  .transform(normalizeFromFlatColor)
  .pipe(updateBase);

// ---------- Schemas públicos (aceptan todas las variantes) ----------
export const createMenuSchema = z.union([createBase, fromPayloadCreate, fromFlatCreate]);
export const updateMenuSchema = z.union([updateBase, fromPayloadUpdate, fromFlatUpdate]);
