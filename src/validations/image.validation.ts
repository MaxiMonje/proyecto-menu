import { z } from "zod";

export const createImageSchema = z.object({
body: z.object({
menuId: z.number().int().positive(),
url: z.string().url().max(1024),
}),
});
export const updateImageSchema = z.object({
body: z.object({ url: z.string().url().max(1024).optional(), active: z.boolean().optional() }),
params: z.object({ id: z.string().regex(/^\d+$/) }),
});