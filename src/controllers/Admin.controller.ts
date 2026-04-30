import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import whatsappService from "../services/whatsapp.service"; // your existing service
import {
    getStats,
    getConversations,
    getMessageThread,
    getBookings,
    getCustomers,
    getCustomerBookings,
} from "../services/Admin.service"; // your existing service

class AdminController {

    // ─── POST /admin/login ──────────────────────────────────────────────────────
    login = async (req: Request, res: Response): Promise<void> => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                res.status(400).json({ success: false, error: "Username and password are required" });
                return;
            }

            const validUsername = process.env.ADMIN_USERNAME;
            const hashedPassword = process.env.ADMIN_PASSWORD_HASH; // bcrypt hash stored in .env

            if (username !== validUsername) {
                res.status(401).json({ success: false, error: "Invalid credentials" });
                return;
            }

            const passwordMatch = await bcrypt.compare(password, hashedPassword!);
            if (!passwordMatch) {
                res.status(401).json({ success: false, error: "Invalid credentials" });
                return;
            }

            const token = jwt.sign(
                { username, role: "admin" },
                process.env.ADMIN_JWT_SECRET!,
                { expiresIn: "24h" }
            );

            res.status(200).json({ success: true, token });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ─── GET /admin/stats ───────────────────────────────────────────────────────
    getStats = async (req: Request, res: Response): Promise<void> => {
        try {
            const stats = await getStats();
            res.status(200).json({ success: true, data: stats });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ─── GET /admin/conversations ───────────────────────────────────────────────
    getConversations = async (req: Request, res: Response): Promise<void> => {
        try {
            const conversations = await getConversations();
            res.status(200).json({ success: true, data: conversations });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ─── GET /admin/conversations/:phone ───────────────────────────────────────
    getMessageThread = async (req: Request, res: Response): Promise<void> => {
        try {
            const { phone } = req.params;

            if (!phone || Array.isArray(phone)) {
                res.status(400).json({
                    success: false,
                    error: "Invalid phone number",
                });
                return;
            }

            const messages = await getMessageThread(phone);
            res.status(200).json({ success: true, data: messages });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };


    getBookings = async (req: Request, res: Response): Promise<void> => {
        try {
            const { from, to, package: pkg } = req.query as Record<string, string>;
            const bookings = await getBookings({ from, to, package: pkg });
            res.status(200).json({ success: true, data: bookings });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ─── GET /admin/customers ───────────────────────────────────────────────────
    getCustomers = async (req: Request, res: Response): Promise<void> => {
        try {
            const customers = await getCustomers();
            res.status(200).json({ success: true, data: customers });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ─── GET /admin/customers/:phone/bookings ───────────────────────────────────
    getCustomerBookings = async (req: Request, res: Response): Promise<void> => {
        try {
            const { phone } = req.params;
            if (!phone || Array.isArray(phone)) {
                res.status(400).json({
                    success: false,
                    error: "Invalid phone number",
                });
                return;
            }
            const bookings = await getCustomerBookings(phone);
            res.status(200).json({ success: true, data: bookings });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    };

    // ─── POST /admin/send-message ───────────────────────────────────────────────
    sendMessage = async (req: Request, res: Response): Promise<void> => {
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

    // ─── POST /admin/send-template ──────────────────────────────────────────────
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
}

export default new AdminController();