import { z } from "zod";

export const createCategorySchema = z.object({
 menuId: z.number().int().positive(), title: z.string().min(1).max(120) });

export const updateCategorySchema = z.object({
 title: z.string().min(1).max(120).optional(), active: z.boolean().optional()
});