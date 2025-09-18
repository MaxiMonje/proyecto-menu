import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  cel: z.string().min(1),
  roleId: z.number(),
  password: z.string().trim().min(8).max(16),           // 👈 TRIM
});

export const updateUserSchema = z
  .object({
    name: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    cel: z.string().optional(),
    roleId: z.number().optional(),
    password: z.string().trim().min(8).max(16).optional(),
  })
  .strict(); 

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  resetUrl: z.string().url().optional()
});

export const restorePasswordSchema = z
  .object({
    
    password: z.string().trim().min(8).max(16),         // 👈 TRIM
    confirmationPassword: z.string().trim().min(8).max(16),
  })
  .refine(v => v.password === v.confirmationPassword, {
    path: ["confirmationPassword"],
    message: "Passwords do not match",
  });

export type RestorePasswordDto = z.infer<typeof restorePasswordSchema>;
