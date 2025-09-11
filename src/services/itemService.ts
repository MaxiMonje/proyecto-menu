import { Item as ItemM, ItemCreationAttributes } from "../models/Item";
import { CreateItemDto, UpdateItemDto } from "../dtos/item.dto";
import { ApiError as Err3 } from "../utils/ApiError";


export const getAllItems = async () => ItemM.findAll({ where: { active: true }, order: [["id", "ASC"]] });
export const getItemById = async (id: number) => {
const it = await ItemM.findOne({ where: { id, active: true } });
if (!it) throw new Err3("Item not found", 404);
return it;
};
export const createItem = async (data: CreateItemDto) => ItemM.create(data as ItemCreationAttributes);
export const updateItem = async (id: number, data: UpdateItemDto) => {
const it = await getItemById(id);
await it.update(data);
return it;
};
export const deleteItem = async (id: number) => { const it = await getItemById(id); await it.update({ active: false }); };