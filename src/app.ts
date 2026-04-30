import dotenv from "dotenv";
import cors from "cors";
dotenv.config();

import whatsappRoutes from './routes/whatsapp.routes';
import express, { Request, Response } from 'express';

const app = express();

app.use(express.json());


app.use(cors({
  origin: [
    "http://localhost:5173",           // Vite dev server
    "https://your-dashboard.vercel.app" // production React dashboard
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.get('/', (req: Request, res: Response) => {
    res.send('🐪 Share Desert Safari WhatsApp Bot is running!');
});

app.use('/api', whatsappRoutes);

export default app;