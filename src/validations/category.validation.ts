import { z } from "zod";

/* ===========================
 * Category (flat)
 * =========================== */
export const createCategorySchema = z.object({
  menuId: z
    .coerce.number({ invalid_type_error: "menuId debe ser numérico" })
    .int("menuId debe ser entero")
    .positive("menuId debe ser mayor que 0"),
  title: z
    .string({ required_error: "El título de la categoría es obligatorio" })
    .min(1, "El título de la categoría es obligatorio")
    .max(120, "El título de la categoría no puede superar 120 caracteres"),
  active: z.boolean().optional(),
});

export const updateCategorySchema = z.object({
  title: z.string().min(1).max(120).optional(),
  active: z.boolean().optional(),
});
