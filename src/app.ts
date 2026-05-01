import dotenv from "dotenv";
import cors from "cors";
dotenv.config();

import whatsappRoutes from './routes/whatsapp.routes';
import adminRoutes from './routes/Admin.routes';
import express, { Request, Response } from 'express';

const app = express();

app.use(express.json());

// ✅ FIXED CORS
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://safari-chatbot-dashboar.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// ✅ VERY IMPORTANT: handle preflight globally
app.options('*', cors());

app.get('/', (req: Request, res: Response) => {
  res.send('🐪 Share Desert Safari WhatsApp Bot is running!');
});

app.use('/api', whatsappRoutes);
app.use('/api/admin', adminRoutes);

export default app;