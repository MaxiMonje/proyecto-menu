import { z } from "zod";
import {
  zRequiredString,
  zOptionalString,
  zBooleanLoose,
} from "./emptyspaces"; // ajustá el path según tu estructura

export const createItemSchema = z.object({
  categoryId: z
    .coerce.number({ invalid_type_error: "categoryId debe ser numérico" })
    .int("categoryId debe ser entero")
    .positive("categoryId debe ser mayor que 0"),

  // NO permite "   " ni "" – aplica trim
  title: zRequiredString("El título del ítem", 160),

  // "" o "   " -> null; respeta máximo 10_000 chars
  description: zOptionalString(10_000),

  // tolerante a "123.45" como string
  price: z
    .coerce.number({ invalid_type_error: "price debe ser numérico" })
    .nonnegative("price no puede ser negativo"),

  // acepta true/false/"true"/"false"
  active: zBooleanLoose,

  // 👉 Nada de images acá: las imágenes se manejan en /images/items/:itemId
});

export const updateItemSchema = z.object({
  // opcional, pero si viene NO puede ser vacío
  title: zRequiredString("El título del ítem", 160).optional(),

  // opcional, "" -> null
  description: zOptionalString(10_000),

  price: z
    .coerce.number({ invalid_type_error: "price debe ser numérico" })
    .nonnegative("price no puede ser negativo")
    .optional(),

  active: zBooleanLoose,

  // 👉 Tampoco images acá
});
