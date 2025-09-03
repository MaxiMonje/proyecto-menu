import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from "./middlewares/errorHandler";
dotenv.config();
import { initDatabase } from './utils/databaseService';
import userRouter from "./routes/userRouter";
import { setupAssociations } from './models/associations';
import authRouter from "./routes/authRouter";
import roleRouter from "./routes/roleRouter";
import paymentRouter from "./routes/paymentRouter";
import { loadSchemaLimits } from "./utils/schemaLimits";
import { enableStrictMode } from "./utils/sqlStrictMode";


const app = express();
const port = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(errorHandler);

app.use("/api/users", userRouter);
app.use("/api/auth", authRouter);
app.use("/api/roles", roleRouter);
app.use("/api/payments", paymentRouter);



async function initServer() {
    try {
        await initDatabase();
        await enableStrictMode();    
        await loadSchemaLimits([
        "users",
        "payments",
        "roles"
        ]);

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