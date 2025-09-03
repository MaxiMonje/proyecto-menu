import { Request, Response, NextFunction } from "express";
import * as userService from "../services/userService";
import { buildPagination } from "../utils/pagination";

const parseId = (req: Request) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw Object.assign(new Error("Invalid id"), { status: 400 });
  return id;
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Campos permitidos para ordenar en User
    const pg = buildPagination(req.query, ["id", "name", "lastName", "email", "createdAt"]);
    const result = await userService.getAllUsers(pg);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req);
    const user = await userService.getUserById(id);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.createUser(req.body); // password requerido en DTO
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req);
    const user = await userService.updateUser(id, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseId(req);
    const result = await userService.deleteUser(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, resetUrl } = req.body as { email: string; resetUrl?: string };
    const result = await userService.requestPasswordReset(email, resetUrl);
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
};

export const restorePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as { email: string; password: string; confirmationPassword: string };
    const result = await userService.restorePasswordByEmail(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};