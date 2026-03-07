import axios from 'axios';
import { config } from '../config/env';

const BASE_URL = `https://graph.facebook.com/${config.meta.apiVersion}/${config.meta.phoneNumberId}`;

const headers = {
  Authorization: `Bearer ${config.meta.accessToken}`,
  'Content-Type': 'application/json',
};

// Send a simple text message
export const sendTextMessage = async (to: string, message: string) => {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message },
  };

  const response = await axios.post(`${BASE_URL}/messages`, payload, { headers });
  return response.data;
};

// Send a template message
export const sendTemplateMessage = async (to: string, templateName: string, languageCode: string = 'en_US') => {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  const response = await axios.post(`${BASE_URL}/messages`, payload, { headers });
  return response.data;
};