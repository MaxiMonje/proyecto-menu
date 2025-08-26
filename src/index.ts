import express from 'express';
import dotenv from 'dotenv';
import { errorHandler } from "./middlewares/errorHandler";
import { initDatabase } from './utils/DatabaseService';
import { setupAssociations } from './models/associations';
dotenv.config();



const app = express();
const port = process.env.PORT || 3000;


app.use(express.json());



async function initServer() {
    try {
        await initDatabase();
        setupAssociations();
        app.listen(port, () => {
            console.log(`⚡️[servidor]: Servidor corriendo en http://localhost:${port}`);
        });
    } catch (error) {
        console.error(`⚡️[servidor]: Error al iniciar el servidor: ${error}`);
    }
}
app.use(errorHandler);


initServer(); 