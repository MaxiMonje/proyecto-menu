import { Request as RI, Response as SI, NextFunction as NI } from "express";
import * as itemService from "../services/itemService";
export const getAllItems = async (_: RI, res: SI, next: NI) => { try { res.json(await itemService.getAllItems()); } catch (e) { next(e); } };
export const getItemById = async (req: RI, res: SI, next: NI) => { try { res.json(await itemService.getItemById(Number(req.params.id))); } catch (e) { next(e); } };
export const createItem = async (req: RI, res: SI, next: NI) => { try { const created = await itemService.createItem(req.body); res.status(201).json(created); } catch (e) { next(e); } };
export const updateItem = async (req: RI, res: SI, next: NI) => { try { const updated = await itemService.updateItem(Number(req.params.id), req.body); res.json(updated); } catch (e) { next(e); } };
export const deleteItem = async (req: RI, res: SI, next: NI) => { try { await itemService.deleteItem(Number(req.params.id)); res.status(204).send(); } catch (e) { next(e); } };