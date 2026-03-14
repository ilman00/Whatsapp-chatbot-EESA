import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

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

If the customer wants to BOOK, collect ALL of these details one by one:
1. Full name
2. Safari date (DD/MM/YYYY)
3. Number of adults
4. Number of children (if any) and their ages
5. Package choice (Morning / Evening / Overnight / Private)
6. Hotel name and location for pickup

IMPORTANT — When you have collected ALL booking details, end your reply with this exact JSON block on its own line:
BOOKING_COMPLETE:{"name":"<name>","date":"<date>","adults":<number>,"children":<number>,"package":"<package>","hotel":"<hotel>","phone":"<userPhone>"}

Example:
BOOKING_COMPLETE:{"name":"Ahmed Ali","date":"20/03/2025","adults":2,"children":1,"package":"Evening Safari","hotel":"Atlantis The Palm","phone":"971501234567"}

Do NOT include BOOKING_COMPLETE until every single field is collected and confirmed by the user.
If you can't answer something, say: "Let me connect you with our team! Please call +971-XX-XXX-XXXX or visit our website."

Always respond in the same language the customer is writing in (Arabic or English).
Keep a warm, professional tone. Use 1–2 relevant emojis per message.`;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BookingDetails {
  name: string;
  date: string;
  adults: number;
  children: number;
  package: string;
  hotel: string;
  phone: string;
}

export interface AIReply {
  message: string;
  booking: BookingDetails | null;
}

// ─── In-memory conversation store (per phone number) ─────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
}

const conversationStore = new Map<string, Message[]>();
const MAX_HISTORY = 20;

// ─── Parse booking from AI reply ─────────────────────────────────────────────
function extractBooking(text: string): { cleanText: string; booking: BookingDetails | null } {
  const marker = "BOOKING_COMPLETE:";
  const idx = text.indexOf(marker);

  if (idx === -1) return { cleanText: text, booking: null };

  const cleanText = text.slice(0, idx).trim();
  const jsonStr = text.slice(idx + marker.length).trim();

  try {
    const booking: BookingDetails = JSON.parse(jsonStr);
    return { cleanText, booking };
  } catch {
    console.error("❌ Failed to parse booking JSON:", jsonStr);
    return { cleanText: text, booking: null };
  }
}

// ─── Main function ────────────────────────────────────────────────────────────
export async function getAIReply(
  userPhone: string,
  userMessage: string
): Promise<AIReply> {
  if (!conversationStore.has(userPhone)) {
    conversationStore.set(userPhone, []);
  }

  const history = conversationStore.get(userPhone)!;
  history.push({ role: "user", content: userMessage });

  try {
    const chat = model.startChat({
      history: history.slice(0, -1).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      systemInstruction: {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }],
      },
    });

    const result = await chat.sendMessage(userMessage);
    const rawReply = result.response.text();

    const { cleanText, booking } = extractBooking(rawReply);

    // Save only the clean text (without BOOKING_COMPLETE JSON) to history
    history.push({ role: "assistant", content: cleanText });

    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    // Clear conversation after successful booking
    if (booking) {
      conversationStore.delete(userPhone);
    }

    return { message: cleanText, booking };
  } catch (error: any) {
    console.error("❌ AI Service error:", error.message);
    return {
      message: "Sorry, our assistant is temporarily unavailable. Please call us at +971-XX-XXX-XXXX 🙏",
      booking: null,
    };
  }
}

export function clearConversation(userPhone: string): void {
  conversationStore.delete(userPhone);
}