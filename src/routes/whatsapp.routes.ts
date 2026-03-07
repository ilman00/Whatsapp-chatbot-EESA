import { Router } from 'express';
import {
  verifyWebhook,
  receiveMessage,
  sendMessage,
  sendTemplate,
} from '../controllers/whatsapp.controller';

const router = Router();

// Webhook routes (Meta)
router.get('/webhook', verifyWebhook);       // Meta webhook verification
router.post('/webhook', receiveMessage);      // Incoming messages

// Manual sending routes
router.post('/send-message', sendMessage);    // Send text message
router.post('/send-template', sendTemplate);  // Send template message

export default router;