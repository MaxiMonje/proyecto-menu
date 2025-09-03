import { Router } from "express";
import { login } from "../controllers/authController";
import { validate } from "../middlewares/validate";
import { loginSchema } from "../validations/auth.validation";

import { googleSync } from '../controllers/authController';

const router = Router();

router.post('/google-sync', googleSync);
router.post("/login", validate(loginSchema), login);

export default router