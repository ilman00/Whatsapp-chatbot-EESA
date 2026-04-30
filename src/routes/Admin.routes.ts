import { Router } from "express";
import adminController from "../controllers/Admin.controller";
import { verifyAdminToken } from "../middlewares/Auth.middleware";

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────
// No token needed — this is how the token is obtained
router.post("/login", adminController.login);

// ─── Protected — all routes below require a valid JWT ─────────────────────────
router.use(verifyAdminToken);

// Stats
router.get("/stats", adminController.getStats);

// Conversations
router.get("/conversations", adminController.getConversations);
router.get("/conversations/:phone", adminController.getMessageThread);

// Bookings
router.get("/bookings", adminController.getBookings);

// Customers
router.get("/customers", adminController.getCustomers);
router.get("/customers/:phone/bookings", adminController.getCustomerBookings);

// Manual WhatsApp messaging
router.post("/send-message", adminController.sendMessage);
router.post("/send-template", adminController.sendTemplate);

export default router;