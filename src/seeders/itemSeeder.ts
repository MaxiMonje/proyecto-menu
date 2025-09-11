import { Item } from "../models/Item";

const seedItems = async () => {
  await Item.bulkCreate([
    { categoryId: 1, imageId: 1, title: "Muzzarella", description: "Clásica pizza de muzza", price: 7500.00, active: true },
    { categoryId: 1, imageId: 2, title: "Napolitana", description: "Con tomate y ajo", price: 8300.00, active: true },
    { categoryId: 2, imageId: null, title: "Empanada de carne", description: "Cortada a cuchillo", price: 1300.00, active: true },
    { categoryId: 3, imageId: 3, title: "Café latte", description: "Leche vaporizada", price: 2500.00, active: true },
    { categoryId: 4, imageId: 4, title: "Cheesecake", description: "Con frutos rojos", price: 4200.00, active: true }
  ]);
};

export default seedItems;