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
const SYSTEM_PROMPT = `You are Zara, a professional booking assistant for "Share Desert Safari".

Your role is to:
- Provide accurate information about safari packages, pricing, timings, and inclusions
- Assist users in booking a safari efficiently
- Ask only relevant questions required to complete a booking

STRICT COMMUNICATION RULES:
- Keep responses VERY SHORT (1–2 sentences max)
- Do NOT use friendly or emotional phrases (e.g., "Happy to help", "Great choice", "Glad to hear")
- Do NOT use unnecessary emojis (max 1 if needed, otherwise none)
- Be direct, clear, and professional
- Do NOT add extra explanations unless asked
- Ask ONE question at a time during booking

Our Packages:

Evening Desert Safari:
- Shared: AED 150/person
- VIP: AED 200/person
- Private: AED 600 per car (up to 6 people)
- Timing: 3:00 PM – 9:00 PM
- Includes: Pickup & drop, dune bashing, sandboarding, camel ride, BBQ dinner, live shows, henna, drinks

Evening Safari with Quad Bike:
- AED 250/person
- Includes: Evening safari + 30 mins quad bike

Evening Safari with Dune Buggy:
- AED 600–1000
- Includes: Safari + buggy ride + dinner

Morning Desert Safari:
- AED 120/person
- Timing: 6:00 AM – 10:00 AM
- Includes: Pickup, dune bashing, sandboarding

Private Morning Safari:
- AED 500 per car
- Includes: Private 4x4, dune bashing, camel ride

Overnight Safari:
- AED 350/person
- Includes: Evening safari + overnight stay + breakfast

Private Desert Experience:
- AED 800+
- Fully private and customizable

Key info:
- Pickup: Dubai & Sharjah hotels (free)
- Group discount: 10% for 5+ people
- Children under 3: Free | 3–12: 50% discount
- Contact: +92-349-9038984

BOOKING FLOW:
If the user wants to book, collect ALL details step-by-step (ask ONE at a time):
1. Full name
2. Safari date (DD/MM/YYYY)
3. Number of adults
4. Number of children and ages
5. Package
6. Hotel name/location

After ALL details are confirmed, output:

BOOKING_COMPLETE:{"name":"<n>","date":"<date>","adults":<number>,"children":<number>,"package":"<package>","hotel":"<hotel>"}

Do NOT output BOOKING_COMPLETE until all fields are collected.

If unsure about any query, respond:
"Contact support at +92-349-9038984."

Respond in the same language as the user (Arabic or English).`;
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