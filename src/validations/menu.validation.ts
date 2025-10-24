import { z } from "zod";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Usá HEX #RRGGBB");

export const createMenuSchema = z.object({
    //userId: z.number().int().positive(),
    title: z.string().min(1).max(120),
    logo: z.string().url().max(255).optional(),
    backgroundImage: z.string().url().max(255).optional(),
    color: z.object({
        primary: hex,
        secondary: hex,
        }).optional(),
    pos: z.string().max(255).optional(),
});
export const updateMenuSchema = z.object({
    title: z.string().min(1).max(120).optional(),
    active: z.boolean().optional(),
    logo: z.string().url().max(255).optional(),
    backgroundImage: z.string().url().max(255).optional(),
    color: z.object({
        primary: hex,
        secondary: hex,
        }).optional(),
    pos: z.string().max(255).optional(),    
params: z.object({ id: z.string().regex(/^\d+$/) }),
});