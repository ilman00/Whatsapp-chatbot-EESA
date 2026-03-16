import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  upsertCustomer,
  saveMessage,
  getRecentMessages,
  clearMessages,
  saveBooking,
} from "./conversation.repository";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

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
- Booking: Via WhatsApp, website, or call +92-349-9038984

If the customer wants to BOOK, collect ALL of these details one by one:
1. Full name
2. Safari date (DD/MM/YYYY)
3. Number of adults
4. Number of children (if any) and their ages
5. Package choice (Morning / Evening / Overnight / Private)
6. Hotel name and location for pickup

IMPORTANT — When you have collected ALL booking details, end your reply with this exact JSON block on a new line:
BOOKING_COMPLETE:{"name":"<n>","date":"<date>","adults":<number>,"children":<number>,"package":"<package>","hotel":"<hotel>"}

Example:
BOOKING_COMPLETE:{"name":"Ahmed Ali","date":"20/03/2025","adults":2,"children":1,"package":"Evening Safari","hotel":"Atlantis The Palm"}

Do NOT include BOOKING_COMPLETE until every single field is confirmed by the user.
If you can't answer something, say: "Let me connect you with our team! Please call +92-349-9038984 or visit our website."

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

// ─── Extract BOOKING_COMPLETE from AI reply ───────────────────────────────────
function extractBooking(
  text: string
): { cleanText: string; booking: Omit<BookingDetails, "phone"> | null } {
  const marker = "BOOKING_COMPLETE:";
  const idx = text.indexOf(marker);

  if (idx === -1) return { cleanText: text.trim(), booking: null };

  const cleanText = text.slice(0, idx).trim();
  const jsonStr = text.slice(idx + marker.length).trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return { cleanText, booking: parsed };
  } catch {
    console.error("❌ Failed to parse booking JSON:", jsonStr);
    return { cleanText: text.trim(), booking: null };
  }
}

// ─── Main function ────────────────────────────────────────────────────────────
export async function getAIReply(
  userPhone: string,
  userMessage: string
): Promise<AIReply> {
  // 1️⃣ Ensure customer exists in DB (upsert on every message)
  await upsertCustomer(userPhone);

  // 2️⃣ Persist the incoming user message
  await saveMessage(userPhone, "user", userMessage);

  // 3️⃣ Load recent history from DB to rebuild Gemini context
  const history = await getRecentMessages(userPhone, 20);

  // The last message in history is the one we just saved (the current user msg).
  // Gemini's startChat() takes prior history; the current message is sent via sendMessage().
  // So we exclude the last item from history and send it separately.
  const priorHistory = history.slice(0, -1);

  try {
    const chat = model.startChat({
      systemInstruction: {
        role: "system",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      history: priorHistory.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
    });

    const result = await chat.sendMessage(userMessage);
    const rawReply = result.response.text();

    const { cleanText, booking } = extractBooking(rawReply);

    // 4️⃣ Persist the assistant reply (clean, without BOOKING_COMPLETE marker)
    await saveMessage(userPhone, "assistant", cleanText);

    if (booking) {
      const fullBooking: BookingDetails = { ...booking, phone: userPhone };

      // 5️⃣ Persist the booking record + increment customer counter
      await saveBooking(fullBooking);

      // 6️⃣ Clear messages so next conversation starts fresh
      await clearMessages(userPhone);

      console.log("🎉 Booking saved to DB:", fullBooking);

      return { message: cleanText, booking: fullBooking };
    }

    return { message: cleanText, booking: null };

  } catch (error: any) {
    console.error("❌ AI Service error:", error.message);
    return {
      message:
        "Sorry, our assistant is temporarily unavailable. Please call us at +92-349-9038984 🙏",
      booking: null,
    };
  }
}

// ─── Clear conversation on demand (e.g. admin reset endpoint) ─────────────────
export async function clearConversation(userPhone: string): Promise<void> {
  await clearMessages(userPhone);
}