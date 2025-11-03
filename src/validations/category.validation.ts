import { z } from "zod";

/* ===========================
 * Category (flat)
 * =========================== */
export const createCategorySchema = z.object({
  menuId: z.number().int().positive(),
  title: z.string().min(1).max(120),
});

export const updateCategorySchema = z.object({
  title: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
});

/* ===========================
 * Helpers
 * =========================== */
const priceCoerce = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
  z
    .number({ invalid_type_error: "El precio debe ser numérico" })
    .min(0, "El precio no puede ser negativo")
);

/* ===========================
 * Imagen (CREATE)
 * - Acepta url o fileField (al menos uno)
 * - .passthrough() antes de la validación adicional
 * =========================== */
export const imageSchema = z
  .object({
    url: z.string().url("La URL de la imagen no es válida").optional(),
    fileField: z.string().min(1, "fileField no puede ser vacío").optional(),
    alt: z.string().max(255, "El alt no puede superar 255 caracteres").optional(),
    sortOrder: z
      .coerce.number()
      .int("sortOrder debe ser entero")
      .min(0, "sortOrder no puede ser negativo")
      .optional(),
  })
  .passthrough()
  .superRefine((v, ctx) => {
    if (!v.url && !v.fileField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe venir url o fileField",
        path: ["url"],
      });
    }
  });

/* ===========================
 * Imagen (UPDATE)
 * - Si viene id, puede actualizar alt/sortOrder/active sin url/fileField
 * - Si NO viene id, exige url o fileField
 * =========================== */
export const updateImageSchema = z
  .object({
    id: z.number().int().positive().optional(),
    url: z.string().url().optional(),
    fileField: z.string().min(1).optional(),
    alt: z.string().max(255).nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    active: z.boolean().optional(),
  })
  .passthrough()
  .superRefine((v, ctx) => {
    if (!v.id && !v.url && !v.fileField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe venir url o fileField",
        path: ["url"],
      });
    }
  });

/* ===========================
 * Item (CREATE / UPDATE)
 * =========================== */
export const itemSchema = z
  .object({
    title: z
      .string({ required_error: "El título del ítem es obligatorio" })
      .min(1, "El título del ítem es obligatorio")
      .max(120, "El título del ítem no puede superar 120 caracteres"),
    // Si tu Item NO tiene description, podés borrar esta línea:
    description: z.string().max(500, "La descripción del ítem no puede superar 500 caracteres").optional(),
    price: priceCoerce,
    active: z.boolean().optional(),
    images: z.array(imageSchema, { invalid_type_error: "images debe ser una lista de imágenes" }).optional(),
  })
  .passthrough();

export const updateItemSchema = z
  .object({
    id: z.number().int().positive().optional(), // si viene => update, si no => create
    title: z.string().min(1).max(120).optional(),
    // Si tu Item NO tiene description, borrá esta línea:
    description: z.string().max(500).nullable().optional(),
    price: priceCoerce.optional(),
    active: z.boolean().optional(),
    images: z.array(updateImageSchema).optional(),
  })
  .passthrough();

/* ===========================
 * Category (DEEP) CREATE / UPDATE
 * =========================== */
export const createCategoryWithChildrenBodySchema = z
  .object({
    menuId: z
      .coerce.number({ invalid_type_error: "menuId debe ser numérico" })
      .int("menuId debe ser entero")
      .positive("menuId debe ser mayor que 0"),
    title: z
      .string({ required_error: "El título de la categoría es obligatorio" })
      .min(1, "El título de la categoría es obligatorio")
      .max(120, "El título de la categoría no puede superar 120 caracteres"),
    active: z.boolean().optional(),
    items: z.array(itemSchema).optional(),
  })
  .passthrough();

export const updateCategoryWithChildrenBodySchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    active: z.boolean().optional(),
    items: z.array(updateItemSchema).optional(),
    // flags opcionales de limpieza
    removeMissingItems: z.boolean().optional(), // default false
    removeMissingImages: z.boolean().optional(), // default false
  })
  .passthrough();
