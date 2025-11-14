import { z } from "zod";

export const createItemSchema = z.object({
  categoryId: z.number().int().positive(),
  title: z.string().min(1).max(160),
  description: z.string().max(10_000).nullable().optional(),
  price: z.number().nonnegative(),
  active: z.boolean().optional(),
  // 👉 Nada de images acá: las imágenes se manejan en /images/items/:itemId
});

export const updateItemSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(10_000).nullable().optional(),
  price: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  // 👉 Tampoco images acá
});
