import express from 'express';
import { config } from './config/env';
import app from './app';

app.use(express.json());


app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
});
