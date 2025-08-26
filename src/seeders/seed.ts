import sequelize from "../utils/DatabaseService";



const seed = async () => {
  try {
    await sequelize.sync({ force: true }); // Limpia y vuelve a crear las tablas

   
    console.log("✅ Seed completado exitosamente");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error al ejecutar seed:", error);
    process.exit(1);
  }
};

seed();