import axios, { AxiosInstance } from "axios";
import { SendTextDto, SendTemplateDto, SendImageDto, SendButtonDto } from "../types/whatsapp.types";

class WhatsAppService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`,
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
  }

  async sendText({ to, message }: SendTextDto) {
    const { data } = await this.client.post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    });
    return data;
  }

  async sendTemplate({ to, templateName, languageCode = "en_US" }: SendTemplateDto) {
    const { data } = await this.client.post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    });
    return data;
  }

  async sendImage({ to, imageUrl, caption }: SendImageDto) {
    const { data } = await this.client.post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    });
    return data;
  }

  async sendButtons({ to, bodyText, buttons }: SendButtonDto) {
    const { data } = await this.client.post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply",
            reply: { id: btn.id, title: btn.title },
          })),
        },
      },
    });
    return data;
  }
}

export default new WhatsAppService();