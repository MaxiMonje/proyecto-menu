import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  forgotPassword,
  restorePassword
} from "../controllers/userController";
import { isAuthenticated } from "../middlewares/isAuthenticated";
import { validate } from "../middlewares/validate";
import {
  createUserSchema,
  updateUserSchema,
  forgotPasswordSchema,
  restorePasswordSchema
} from "../validations/user.validation";

const router = Router();

router.get("/", isAuthenticated,getAllUsers);
router.get("/:id", isAuthenticated,getUserById);

router.post("/", validate(createUserSchema), createUser);
router.put("/:id",  validate(updateUserSchema), updateUser);
router.delete("/:id", isAuthenticated,deleteUser);


router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
router.post("/restore-password", validate(restorePasswordSchema), restorePassword);

export default router;