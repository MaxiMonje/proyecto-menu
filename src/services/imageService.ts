import { Image as ImageM, ImageCreationAttributes } from "../models/Image";
import { CreateImageDto, UpdateImageDto } from "../dtos/image.dto";
import { ApiError as Err } from "../utils/ApiError";


export const getAllImages = async () => ImageM.findAll({ where: { active: true }, order: [["id", "ASC"]] });
export const getImageById = async (id: number) => {
const it = await ImageM.findOne({ where: { id, active: true } });
if (!it) throw new Err("Image not found", 404);
return it;
};
export const createImage = async (data: CreateImageDto) => ImageM.create(data as ImageCreationAttributes);
export const updateImage = async (id: number, data: UpdateImageDto) => {
const it = await getImageById(id);
await it.update(data);
return it;
};
export const deleteImage = async (id: number) => { const it = await getImageById(id); await it.update({ active: false }); };