import { Request as R, Response as S, NextFunction as N } from "express";
import * as imageService from "../services/imageService";
import { getItemById } from "../services/itemService";
import { ApiError } from "../utils/ApiError";

/* ============================================================
   CRUD genérico de tabla IMAGES
   ============================================================ */

export const getAllImages = async (_: R, res: S, next: N) => {
  try {
    res.json(await imageService.getAllImages());
  } catch (e) {
    next(e);
  }
};

export const getImageById = async (req: R, res: S, next: N) => {
  try {
    res.json(await imageService.getImageById(Number(req.params.id)));
  } catch (e) {
    next(e);
  }
};

export const createImage = async (req: R, res: S, next: N) => {
  try {
    const created = await imageService.createImage(req.body);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
};

export const updateImage = async (req: R, res: S, next: N) => {
  try {
    const updated = await imageService.updateImage(
      Number(req.params.id),
      req.body
    );
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

export const deleteImage = async (req: R, res: S, next: N) => {
  try {
    await imageService.deleteImage(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};

/* ============================================================
   NUEVO — Upsert ItemImages (subir archivos a S3)
   ============================================================ */

export const upsertItemImagesController = async (
  req: R,
  res: S,
  next: N
) => {
  try {
    const itemId = Number(req.params.itemId);
    if (!itemId) throw new ApiError("ID de ítem inválido", 400);

    let images = (req.body as any).images;

    if (!images) {
      throw new ApiError("El campo 'images' es obligatorio", 400);
    }

    // Si viene como string (form-data)
    if (typeof images === "string") {
      try {
        images = JSON.parse(images);
      } catch {
        throw new ApiError("El campo 'images' debe ser JSON válido", 400);
      }
    }

    if (!Array.isArray(images)) {
      throw new ApiError("'images' debe ser un array", 400);
    }

    // Ejecuta el upsert en S3 + DB
    await imageService.upsertItemImages(
      itemId,
      images,
      req.files as Express.Multer.File[]
    );

    // Devolver el item actualizado con las imágenes nuevas
    const item = await getItemById(itemId);
    res.json(item);
  } catch (e) {
    next(e);
  }
};
