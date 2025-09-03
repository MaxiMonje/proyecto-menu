import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("invalid email"),
  password: z.string().min(8, "password must be at least 8 chars").max(16, "password must be at most 16 chars"),
});