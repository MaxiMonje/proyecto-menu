import { z } from "zod";

const itemImageSchema = z.object({
  url: z.string().url("URL inválida").max(1024),
  alt: z.string().trim().max(255).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export const createItemSchema = z.object({
  categoryId: z.number().int().positive(),
  title: z.string().min(1).max(160),
  description: z.string().max(10_000).nullable().optional(),
  price: z.number().nonnegative(),
  active: z.boolean().optional(),
  images: z.array(itemImageSchema).max(20).optional(),
});

export const updateItemSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(10_000).nullable().optional(),
  price: z.number().nonnegative().optional(),
  active: z.boolean().optional(),
  images: z.array(
    z.object({
      id: z.number().int().positive().optional(),
      url: z.string().url("URL inválida").max(1024).optional(),
      alt: z.string().trim().max(255).optional(),
      sortOrder: z.number().int().min(0).max(999).optional(),
      active: z.boolean().optional(),
      _delete: z.boolean().optional(),
    })
    // ✅ Si NO hay id y NO es delete ⇒ es creación ⇒ requiere url
    .refine((img) => img.id || img._delete || !!img.url, {
      message: "URL requerida al crear una imagen nueva",
      path: ["url"],
    })
    // ✅ Si es delete ⇒ debe venir id
    .refine((img) => !img._delete || !!img.id, {
      message: "Para borrar una imagen debe enviarse su id",
      path: ["id"],
    })
  ).max(30).optional(),
});
