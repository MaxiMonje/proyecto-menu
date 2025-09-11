import { z } from "zod";
export const createMenuSchema = z.object({
body: z.object({
userId: z.number().int().positive(),
title: z.string().min(1).max(120),
}),
});
export const updateMenuSchema = z.object({
body: z.object({
title: z.string().min(1).max(120).optional(),
active: z.boolean().optional(),
}),
params: z.object({ id: z.string().regex(/^\d+$/) }),
});