import { RequestHandler } from "express";
import { ApiError } from "../utils/ApiError";

export const parseMultipartPayload: RequestHandler = (req, _res, next) => {
  // Si viene como multipart y el front manda el JSON en "payload", lo parseamos
  if (req.is("multipart/form-data") && typeof req.body?.payload === "string") {
    try {
      req.body = JSON.parse(req.body.payload);
    } catch (e) {
      return next(new ApiError("payload inválido: no es JSON", 400));
    }
  }
  next();
};
