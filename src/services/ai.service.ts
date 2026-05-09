import Groq from "groq-sdk";
import {
  upsertCustomer,
  saveMessage,
  getRecentMessages,
  clearMessages,
  saveBooking,
} from "./conversation.repository";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

// ─── System prompt: Desert Safari persona ────────────────────────────────────
const SYSTEM_PROMPT = `You are Zara, a professional booking assistant for "Share Desert Safari".

Your role is to:
- Provide accurate info about packages, pricing, and bookings.
- Assist users in booking a safari efficiently.
- Acknowledge if a user has booked with us before based on history.

STRICT COMMUNICATION RULES:
- Keep responses VERY SHORT (1–2 sentences max).
- Do NOT use emotional phrases (e.g., "Happy to help", "Glad to hear").
- Do NOT use unnecessary emojis (max 1).
- Be direct and professional.
- Ask ONE question at a time during booking.

OUR PACKAGES:

Evening Desert Safari:
- Shared: AED 150/person
- VIP: AED 200/person
- Private: AED 600 per car (up to 6 people)
- Timing: 3:00 PM – 9:00 PM
- Includes: Pickup/drop, dune bashing, sandboarding, BBQ dinner, shows.

Evening Safari with Quad Bike:
- AED 250/person (Includes 30 mins quad bike)

Evening Safari with Dune Buggy:
- AED 600–1000 (Based on buggy type)

Morning Desert Safari:
- Shared: AED 120/person (6:00 AM – 10:00 AM)
- Private: AED 500 per car

Overnight Safari:
- AED 350/person (Includes stay & breakfast)

Key info:
- Pickup: Free from Dubai & Sharjah hotels.
- Discounts: 10% for 5+ people. Under 3: Free. 3–12: 50% off.
- Contact: +92-349-9038984.

BOOKING FLOW:
Collect these details one by one:
1. Full name
2. Safari date (Accept any format: e.g., "Tomorrow", "Next Friday", or "12 May")
3. Number of adults
4. Number of children and ages
5. Package choice
6. Hotel name/location

After ALL details are confirmed, output:
BOOKING_COMPLETE:{"name":"<n>","date":"<date>","adults":<number>,"children":<number>,"package":"<package>","hotel":"<hotel>"}

If unsure, respond: "Contact support at +92-349-9038984."
Respond in the user's language (Arabic or English).`;

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
  await upsertCustomer(userPhone);
  await saveMessage(userPhone, "user", userMessage);

  // Load history for context
  const history = await getRecentMessages(userPhone, 25);
  const priorHistoryRaw = history.slice(0, -1); // exclude the message we just saved

  // Build Groq-compatible messages array (OpenAI format)
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...priorHistoryRaw.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // or "mixtral-8x7b-32768", "gemma2-9b-it"
      messages,
      max_tokens: 300,
      temperature: 0.5,
    });

    const rawReply = response.choices[0]?.message?.content ?? "";
    const { cleanText, booking } = extractBooking(rawReply);

    await saveMessage(userPhone, "assistant", cleanText);

    if (booking) {
      const fullBooking: BookingDetails = { ...booking, phone: userPhone };
      await saveBooking(fullBooking);
      console.log("🎉 Booking saved. History retained for context.");
      return { message: cleanText, booking: fullBooking };
    }

    return { message: cleanText, booking: null };

  } catch (error: any) {
    console.error("❌ AI Service error:", error.message);
    return {
      message: "Sorry, our assistant is temporarily unavailable. Please call +92-349-9038984.",
      booking: null,
    };
  }
}

// ─── Clear conversation on demand (e.g. admin reset endpoint) ─────────────────
export async function clearConversation(userPhone: string): Promise<void> {
  await clearMessages(userPhone);
}