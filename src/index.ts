import express from 'express';
import { config } from './config/env';
import whatsappRoutes from './routes/whatsapp.routes';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.send('🐪 Share Desert Safari WhatsApp Bot is running!');
});

app.use('/api/whatsapp', whatsappRoutes);

app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
});

export default app;