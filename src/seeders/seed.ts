import sequelize from "../utils/databaseService";
import seedRoles from "./roleSeeder";
import seedUsers from "./userSeeder";

import seedMenus from "./menuSeeder";
import seedCategories from "./categorySeeder";
import seedImages from "./imageSeeder";
import seedItems from "./itemSeeder";

const seed = async () => {
  try {
    // Limpia y vuelve a crear las tablas
    await sequelize.sync({ force: true });

    // Orden recomendado por FK
    await seedRoles();
    await seedUsers();

    await seedMenus();
    await seedCategories();
    await seedImages();
    await seedItems();

    console.log("✅ Seed completado exitosamente");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error al ejecutar seed:", (error as Error).message);
    process.exit(1);
  }
};

export default seed;

// Ejecutar si se llama directamente
seed();
