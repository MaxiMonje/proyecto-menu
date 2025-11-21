import { z } from "zod";
import { emptyToNull, zOptionalString } from "./emptyspaces"; // ajustá el path si hace falta

// Subdominio OPCIONAL:
// - trim
// - "" o "   " -> null
// - si viene valor, valida largo + regex
const subdomain = z.preprocess(
  emptyToNull,
  z
    .string()
    .min(3, "El subdominio debe tener al menos 3 caracteres")
    .max(63, "El subdominio no puede superar 63 caracteres")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Usá minúsculas, números y guiones (sin espacios)"
    )
    .nullable()
    .optional()
);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  lastName: z.string().trim().min(1, "El apellido es obligatorio"),
  email: z.string().email("Email inválido"),

  // cel opcional: "" -> null
  cel: zOptionalString(50),

  roleId: z.coerce.number({ invalid_type_error: "roleId debe ser numérico" }),

  // password requerida, trim
  password: z.string().trim().min(8).max(16),

  // subdomain opcional
  subdomain,
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),

    // cel opcional y normalizado
    cel: zOptionalString(50),

    roleId: z.coerce.number({ invalid_type_error: "roleId debe ser numérico" }).optional(),

    password: z.string().trim().min(8).max(16).optional(),

    // también permitimos actualizar subdomain opcionalmente
    subdomain,
  })
  .strict();

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  resetUrl: z.string().url().optional(),
});

export const restorePasswordSchema = z
  .object({
    password: z.string().trim().min(8).max(16),
    confirmationPassword: z.string().trim().min(8).max(16),
  })
  .refine((v) => v.password === v.confirmationPassword, {
    path: ["confirmationPassword"],
    message: "Passwords do not match",
  });

export type RestorePasswordDto = z.infer<typeof restorePasswordSchema>;
