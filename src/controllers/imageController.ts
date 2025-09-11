import { Request as R, Response as S, NextFunction as N } from "express";
import * as imageService from "../services/imageService";
export const getAllImages = async (_: R, res: S, next: N) => { try { res.json(await imageService.getAllImages()); } catch (e) { next(e); } };
export const getImageById = async (req: R, res: S, next: N) => { try { res.json(await imageService.getImageById(Number(req.params.id))); } catch (e) { next(e); } };
export const createImage = async (req: R, res: S, next: N) => { try { const created = await imageService.createImage(req.body); res.status(201).json(created); } catch (e) { next(e); } };
export const updateImage = async (req: R, res: S, next: N) => { try { const updated = await imageService.updateImage(Number(req.params.id), req.body); res.json(updated); } catch (e) { next(e); } };
export const deleteImage = async (req: R, res: S, next: N) => { try { await imageService.deleteImage(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); } };