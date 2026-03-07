import { Request, Response } from 'express';
import { config } from '../config/env';
import { sendTextMessage, sendTemplateMessage } from '../services/whatsapp.service';

// Webhook verification (Meta requires this)
export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ message: 'Forbidden' });
  }
};

// Receive incoming messages from Meta
export const receiveMessage = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const message = changes?.value?.messages?.[0];

      if (message) {
        const from = message.from;
        const text = message.text?.body?.toLowerCase();

        console.log(`📩 Message from ${from}: ${text}`);

        // Auto reply logic
        if (text.includes('hello') || text.includes('hi')) {
          await sendTextMessage(from, '🐪 Welcome to Share Desert Safari! How can we help you today?');
        } else if (text.includes('book') || text.includes('safari')) {
          await sendTemplateMessage(from, 'desert_safari_booking');
        } else {
          await sendTextMessage(from, '🌟 Thank you for contacting Share Desert Safari! Our team will get back to you shortly.');
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Error receiving message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Send a text message manually
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;
    const result = await sendTextMessage(to, message);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Send a template message manually
export const sendTemplate = async (req: Request, res: Response) => {
  try {
    const { to, templateName, languageCode } = req.body;
    const result = await sendTemplateMessage(to, templateName, languageCode);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Error sending template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};