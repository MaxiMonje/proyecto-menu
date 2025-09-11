import { Router as R2 } from "express";
import { validate as v2 } from "../middlewares/validate";
import { createImageSchema, updateImageSchema } from "../validations/image.validation";
import { getAllImages, getImageById, createImage, updateImage, deleteImage } from "../controllers/imageController";


const imageRouter = R2();
imageRouter.get("/", getAllImages);
imageRouter.get("/:id", getImageById);
imageRouter.post("/", v2(createImageSchema), createImage);
imageRouter.put("/:id", v2(updateImageSchema), updateImage);
imageRouter.delete("/:id", deleteImage);
export default imageRouter;