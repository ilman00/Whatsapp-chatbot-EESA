import { Router } from "express";
import whatsappController from "../controllers/whatsapp.controller";

const router = Router();

// Outbound messages
router.post("/send-text",     whatsappController.sendText);
router.post("/send-template", whatsappController.sendTemplate);
router.post("/send-image",    whatsappController.sendImage);
router.post("/send-buttons",  whatsappController.sendButtons);

// Webhook (Meta calls these)
router.get("/webhook",  whatsappController.verifyWebhook);
router.post("/webhook", whatsappController.receiveWebhook);

export default router;