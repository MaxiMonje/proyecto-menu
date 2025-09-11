import { Category } from "../models/Category";

const seedCategories = async () => {
  await Category.bulkCreate([
    { menuId: 1, title: "Pizzas", active: true },
    { menuId: 1, title: "Empanadas", active: true },
    { menuId: 2, title: "Cafetería", active: true },
    { menuId: 2, title: "Pastelería", active: true }
  ]);
};

export default seedCategories;