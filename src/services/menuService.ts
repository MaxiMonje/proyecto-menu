import { Menu as MenuM, MenuCreationAttributes } from "../models/Menu";
import { CreateMenuDto, UpdateMenuDto } from "../dtos/menu.dto";
import { ApiError } from "../utils/ApiError";


export const getAllMenus = async () => MenuM.findAll({ where: { active: true }, order: [["id", "ASC"]] });

export const getMenuById = async (id: number) => {
    const menu = await MenuM.findOne({ where: { id, active: true } });
    if (!menu) throw new ApiError("Menu not found", 404);
return menu;
};

export const createMenu = async (data: CreateMenuDto) => MenuM.create(data as MenuCreationAttributes);

export const updateMenu = async (id: number, data: UpdateMenuDto) => {
    const menu = await getMenuById(id);
    await menu.update(data);
return menu;
};

export const deleteMenu = async (id: number) => {
    const menu = await getMenuById(id);
    await menu.update({ active: false });
};