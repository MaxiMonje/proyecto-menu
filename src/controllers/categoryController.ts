import { Request as RC, Response as SC, NextFunction as NC } from "express";
import * as categoryService from "../services/categoryService";

export const getAllCategories = async (_: RC, res: SC, next: NC) => {
  try {
    const cats = await categoryService.getAllCategories();
    res.json(cats);
  } catch (e) {
    next(e);
  }
};

export const getCategoryById = async (req: RC, res: SC, next: NC) => {
  try {
    const id = Number(req.params.id);
    const cat = await categoryService.getCategoryById(id);
    res.json(cat);
  } catch (e) {
    next(e);
  }
};

export const createCategory = async (req: RC, res: SC, next: NC) => {
  try {
    const created = await categoryService.createCategory(req.body);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
};

export const updateCategory = async (req: RC, res: SC, next: NC) => {
  try {
    const id = Number(req.params.id);
    const updated = await categoryService.updateCategory(id, req.body);
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

export const deleteCategory = async (req: RC, res: SC, next: NC) => {
  try {
    const id = Number(req.params.id);
    await categoryService.deleteCategory(id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};
