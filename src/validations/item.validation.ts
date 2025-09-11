import { z } from "zod";

export const createItemSchema = z.object({
body: z.object({
categoryId: z.number().int().positive(),
imageId: z.number().int().positive().nullable().optional(),
title: z.string().min(1).max(160),
description: z.string().max(10_000).nullable().optional(),
price: z.number().nonnegative(),
}),
});
export const updateItemSchema = z.object({
body: z.object({
imageId: z.number().int().positive().nullable().optional(),
title: z.string().min(1).max(160).optional(),
description: z.string().max(10_000).nullable().optional(),
price: z.number().nonnegative().optional(),
active: z.boolean().optional(),
}),
params: z.object({ id: z.string().regex(/^\d+$/) }),
});