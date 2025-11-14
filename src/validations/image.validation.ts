import { z } from "zod";

export const createImageSchema = z.object({
  menuId: z
    .coerce.number({ invalid_type_error: "menuId debe ser numérico" })
    .int("menuId debe ser entero")
    .positive("menuId debe ser mayor que 0"),
  url: z
    .string({ required_error: "La URL es obligatoria" })
    .url("La URL no es válida"),
});

export const updateImageSchema = z.object({
  url: z.string().url("La URL no es válida").optional(),
  active: z.boolean().optional(),
});
