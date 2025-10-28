import { ZodError, ZodTypeAny } from "zod";
import { Request, Response, NextFunction } from "express";

const formatZod = (err: ZodError) => ({
  message: "Datos inválidos",
  errors: err.errors.map(e => ({
    path: e.path.join("."),
    code: e.code,
    message: e.message,
  })),
});

// Acepta ANY esquema de Zod (Object, Effects, Union, etc.)
export const validate = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1) Intento con wrapper { body, params, query } (si tu schema lo usa)
    let parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
      headers: req.headers,
    });

    if (parsed.success) {
      const data: any = parsed.data;
      if (data.body)   req.body = data.body;
      if (data.params) req.params = data.params;
      if (data.query)  req.query = data.query;
      return next();
    }

    // 2) Si no, intento body-only (si tu schema valida el body directo)
    parsed = schema.safeParse(req.body);
    if (parsed.success) {
      req.body = parsed.data as any;
      return next();
    }

    return res.status(400).json(formatZod(parsed.error));
  };
};
