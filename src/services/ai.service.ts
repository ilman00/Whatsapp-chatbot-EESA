import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-lite" });

// ─── System prompt: Desert Safari persona ────────────────────────────────────
const SYSTEM_PROMPT = `You are Zara, a friendly and knowledgeable booking assistant for "Share Desert Safari" — a premium desert safari experience company.

Your role is to:
- Warmly greet new customers and understand their needs
- Answer questions about our safari packages, pricing, timings, and inclusions
- Help customers book a safari or connect them with a human agent if needed
- Keep responses SHORT (2–4 sentences max) since this is WhatsApp

Our Packages:
1. 🌅 Morning Safari – 6:00 AM to 10:00 AM | AED 150/person | Dune bashing, camel ride, sandboarding
2. 🌄 Evening Safari – 3:00 PM to 9:00 PM | AED 250/person | Dune bashing, BBQ dinner, belly dance show, camel ride, henna
3. 🌙 Overnight Safari – 6:00 PM to 6:00 AM | AED 450/person | All evening inclusions + overnight camp stay + breakfast
4. 🏜️ Private Safari – Custom timing | AED 800+ | Fully private 4x4, personal guide, customizable

Key info:
- Location: Dubai Desert Conservation Reserve, Dubai, UAE
- Pickup: Available from all Dubai & Sharjah hotels (free)
- Group discount: 10% off for 5+ people
- Children under 3: Free | Ages 3–12: 50% discount
- Booking: Via WhatsApp, website, or call +971-XX-XXX-XXXX

If the customer wants to BOOK, collect: name, date, number of adults/children, package, hotel name.
If you can't answer something, say: "Let me connect you with our team! Please call +971-XX-XXX-XXXX or visit our website."

Always respond in the same language the customer is writing in (Arabic or English).
Keep a warm, professional tone. Use 1–2 relevant emojis per message.`;

// ─── In-memory conversation store (per phone number) ─────────────────────────
interface Message {
    role: "user" | "assistant";
    content: string;
}

const conversationStore = new Map<string, Message[]>();

const MAX_HISTORY = 20; // keep last 20 messages per user

// ─── Main function ────────────────────────────────────────────────────────────
export async function getAIReply(
    userPhone: string,
    userMessage: string
): Promise<string> {
    // Get or create conversation history for this user
    if (!conversationStore.has(userPhone)) {
        conversationStore.set(userPhone, []);
    }

    const history = conversationStore.get(userPhone)!;

    // Add the new user message
    history.push({ role: "user", content: userMessage });
    try {
        // Gemini uses "model" and "parts" format, not "messages"
        // Add user message to local history store

        // Prepare history for Gemini (excluding the very last message we just added)
        // Define the system instruction as a simple object with parts
        const chat = model.startChat({
            systemInstruction: {
                role: "system", // This satisfies the TypeScript 'Content' interface
                parts: [{ text: SYSTEM_PROMPT }],
            },
            history: history.slice(0, -1).map((msg) => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            })),
        });

        const result = await chat.sendMessage(userMessage);

        const replyText = result.response.text();

        // Save assistant reply to history
        history.push({ role: "assistant", content: replyText });

        // Trim history if too long
        if (history.length > MAX_HISTORY) {
            history.splice(0, history.length - MAX_HISTORY);
        }

        return replyText;
    } catch (error: any) {
        console.error("❌ AI Service error:", error.message);
        return "Sorry, our assistant is temporarily unavailable. Please call us at +92-349-9038984 🙏";
    }
}

// Clear conversation (e.g., after booking or on demand)
export function clearConversation(userPhone: string): void {
    conversationStore.delete(userPhone);
}