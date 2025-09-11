import { Menu } from "../models/Menu";

const seedMenus = async () => {
  await Menu.bulkCreate([
    { userId: 1, title: "Pizzería Don Pepe", active: true },
    { userId: 1, title: "Cafetería La Plaza", active: true }
  ]);
};

export default seedMenus;