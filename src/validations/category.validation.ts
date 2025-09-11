import { z } from "zod";

export const createCategorySchema = z.object({
body: z.object({ menuId: z.number().int().positive(), title: z.string().min(1).max(120) }),
});
export const updateCategorySchema = z.object({
body: z.object({ title: z.string().min(1).max(120).optional(), active: z.boolean().optional() }),
params: z.object({ id: z.string().regex(/^\d+$/) }),
});