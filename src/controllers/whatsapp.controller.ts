import { Request, Response } from "express";
import whatsappService from "../services/whatsapp.service";
import { WebhookPayload } from "../types/whatsapp.types";
import { getAIReply } from "../services/ai.service";
import { notifyOwner } from "../services/notification.service";

class WhatsAppController {
  // POST /whatsapp/send-text
  sendText = async (req: Request, res: Response): Promise<void> => {
    try {
      const { to, message } = req.body;
      if (!to || !message) {
        res.status(400).json({ success: false, error: "'to' and 'message' are required" });
        return;
      }
      const result = await whatsappService.sendText({ to, message });
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.response?.data || error.message });
    }
  };

  // POST /whatsapp/send-template
  sendTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { to, templateName, languageCode } = req.body;
      if (!to || !templateName) {
        res.status(400).json({ success: false, error: "'to' and 'templateName' are required" });
        return;
      }
      const result = await whatsappService.sendTemplate({ to, templateName, languageCode });
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.response?.data || error.message });
    }
  };

  // POST /whatsapp/send-image
  sendImage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { to, imageUrl, caption } = req.body;
      if (!to || !imageUrl) {
        res.status(400).json({ success: false, error: "'to' and 'imageUrl' are required" });
        return;
      }
      const result = await whatsappService.sendImage({ to, imageUrl, caption });
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.response?.data || error.message });
    }
  };

  // POST /whatsapp/send-buttons
  sendButtons = async (req: Request, res: Response): Promise<void> => {
    try {
      const { to, bodyText, buttons } = req.body;
      if (!to || !bodyText || !buttons?.length) {
        res.status(400).json({ success: false, error: "'to', 'bodyText', and 'buttons' are required" });
        return;
      }
      const result = await whatsappService.sendButtons({ to, bodyText, buttons });
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.response?.data || error.message });
    }
  };

  // GET /whatsapp/webhook — Meta verification handshake
  verifyWebhook = (req: Request, res: Response): void => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log("✅ Webhook verified by Meta");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  };

  // POST /whatsapp/webhook — Incoming messages from Meta
  receiveWebhook = async (req: Request, res: Response): Promise<void> => {
    const body: WebhookPayload = req.body;

    // Always return 200 to Meta immediately
    res.sendStatus(200);

    if (body.object !== "whatsapp_business_account") return;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value?.messages;
        if (!messages) continue;

        for (const msg of messages) {
          console.log("📩 Message received:", {
            from: msg.from,
            type: msg.type,
            text: msg.text?.body,
          });

          if (msg.type !== "text" || !msg.text?.body) continue;

          // ai.service handles: DB history load, message persistence, booking save
          const { message, booking } = await getAIReply(msg.from, msg.text.body);

          // Send AI reply back to customer
          await whatsappService.sendText({ to: msg.from, message });

          // Booking is already saved to DB inside ai.service.
          // notifyOwner is purely for external notifications (WhatsApp + Email).
          if (booking) {
            console.log("🎉 Booking completed for:", booking.name, "| Package:", booking.package);

            notifyOwner(booking).catch((err) =>
              console.error("❌ notifyOwner failed:", err)
            );
          }
        }
      }
    }
  };
}

export default new WhatsAppController();