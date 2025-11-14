import { Request as RI, Response as SI, NextFunction as NI } from "express";
import * as itemService from "../services/itemService";

export const getAllItems = async (_: RI, res: SI, next: NI) => {
  try {
    const items = await itemService.getAllItems();
    res.json(items);
  } catch (e) {
    next(e);
  }
};

export const getItemById = async (req: RI, res: SI, next: NI) => {
  try {
    const id = Number(req.params.id);
    const item = await itemService.getItemById(id);
    res.json(item);
  } catch (e) {
    next(e);
  }
};

export const createItem = async (req: RI, res: SI, next: NI) => {
  try {
    const created = await itemService.createItem(req.body);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
};

export const updateItem = async (req: RI, res: SI, next: NI) => {
  try {
    const id = Number(req.params.id);
    const updated = await itemService.updateItem(id, req.body);
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

export const deleteItem = async (req: RI, res: SI, next: NI) => {
  try {
    const id = Number(req.params.id);
    await itemService.deleteItem(id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
};
