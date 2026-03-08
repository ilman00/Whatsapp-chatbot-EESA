import dotenv from "dotenv";
dotenv.config();

import whatsappRoutes from './routes/whatsapp.routes';
import express, { Request, Response } from 'express';

const app = express();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.send('🐪 Share Desert Safari WhatsApp Bot is running!');
});

app.use('/api', whatsappRoutes);

export default app;