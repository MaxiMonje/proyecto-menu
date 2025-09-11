import { Request as RC, Response as SC, NextFunction as NC } from "express";
import * as categoryService from "../services/categoryService";
export const getAllCategories = async (_: RC, res: SC, next: NC) => { try { res.json(await categoryService.getAllCategories()); } catch (e) { next(e); } };
export const getCategoryById = async (req: RC, res: SC, next: NC) => { try { res.json(await categoryService.getCategoryById(Number(req.params.id))); } catch (e) { next(e); } };
export const createCategory = async (req: RC, res: SC, next: NC) => { try { const created = await categoryService.createCategory(req.body); res.status(201).json(created); } catch (e) { next(e); } };
export const updateCategory = async (req: RC, res: SC, next: NC) => { try { const updated = await categoryService.updateCategory(Number(req.params.id), req.body); res.json(updated); } catch (e) { next(e); } };
export const deleteCategory = async (req: RC, res: SC, next: NC) => { try { await categoryService.deleteCategory(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); } };