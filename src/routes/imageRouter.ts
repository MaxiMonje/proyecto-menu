import { Router as R2 } from "express";
import { validate as v2 } from "../middlewares/validate";
import { createImageSchema, updateImageSchema } from "../validations/image.validation";
import { getAllImages, getImageById, createImage, updateImage, deleteImage, upsertItemImagesController } from "../controllers/imageController";
import multer from "multer";


const imageRouter = R2();
const upload = multer();

imageRouter.get("/", getAllImages);
imageRouter.get("/:id", getImageById);
imageRouter.post("/", v2(createImageSchema), createImage);
imageRouter.put("/:id", v2(updateImageSchema), updateImage);
imageRouter.delete("/:id", deleteImage);

imageRouter.put(
    "/items/:itemId",
    upload.any(),               // para recibir archivos (Multer)
    upsertItemImagesController  // controller que definimos abajo
);

export default imageRouter;