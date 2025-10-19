import {Item} from "../models/Item";
import ItemImage from "../models/ItemImage";

const seedItems = async () => {
  // 1️⃣ Crear los ítems (sin imageId)
  const items = await Item.bulkCreate([
    { categoryId: 1, title: "Muzzarella", description: "Clásica pizza de muzza", price: 7500.00, active: true },
    { categoryId: 1, title: "Napolitana", description: "Con tomate y ajo", price: 8300.00, active: true },
    { categoryId: 2, title: "Empanada de carne", description: "Cortada a cuchillo", price: 1300.00, active: true },
    { categoryId: 3, title: "Café latte", description: "Leche vaporizada", price: 2500.00, active: true },
    { categoryId: 4, title: "Cheesecake", description: "Con frutos rojos", price: 4200.00, active: true },
  ]);

  // 2️⃣ Crear las imágenes relacionadas (usamos item.id de lo recién creado)
  await ItemImage.bulkCreate([
    // Muzzarella
    { itemId: items[0].id, url: "https://picsum.photos/id/101/800/600", alt: "Pizza muzzarella", sortOrder: 0 },
    { itemId: items[0].id, url: "https://picsum.photos/id/104/800/600", alt: "Porción muzzarella", sortOrder: 1 },

    // Napolitana
    { itemId: items[1].id, url: "https://picsum.photos/id/101/800/600", alt: "Pizza napolitana", sortOrder: 0 },

    // Empanada
    { itemId: items[2].id, url: "https://picsum.photos/id/101/800/600", alt: "Empanada de carne", sortOrder: 0 },

    // Café latte
    { itemId: items[3].id, url: "https://picsum.photos/id/101/800/600", alt: "Café latte con espuma", sortOrder: 0 },

    // Cheesecake
    { itemId: items[4].id, url: "https://picsum.photos/id/101/800/600", alt: "Cheesecake con frutos rojos", sortOrder: 0 },
  ]);
};

export default seedItems;
