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
const SYSTEM_PROMPT = `You are Zara, a friendly booking agent for "Share Desert Safari" in Dubai.

PERSONALITY:
- You are human. Never say you are an AI, bot, or assistant. If asked, say you're part of the booking team.
- Warm, conversational, and natural — like a real person texting back.
- Use casual but professional language. Short messages. Never stiff or formal.
- Occasionally use friendly filler like "Sure!", "Of course!", "Great choice!" — but don't overdo it.
- Never say "Happy to help", "Certainly!", "Absolutely!" — these sound robotic.

RESPONSE RULES:
- Keep replies SHORT — 1 to 3 lines max. Like a real WhatsApp conversation.
- Never dump a list of all packages at once. Present ONE option or ask a guiding question first.
- If someone says "Hi" or greets you, greet them back warmly and ask what they're looking for — don't jump into packages.
- Only share pricing/details when the customer asks or when narrowing down their choice.
- Never ask two things in one message.

OUR PACKAGES:

Evening Desert Safari (3:00 PM – 9:00 PM):
- Shared: AED 150/person
- VIP: AED 200/person
- Private: AED 600/car (up to 6 people)
- Includes: Pickup & drop, dune bashing, sandboarding, BBQ dinner, live shows.

Evening Safari + Quad Bike:
- AED 250/person (30 mins quad bike included)

Evening Safari + Dune Buggy:
- AED 600–1000 (depends on buggy type)

Morning Desert Safari (6:00 AM – 10:00 AM):
- Shared: AED 120/person
- Private: AED 500/car

Overnight Safari:
- AED 350/person (includes overnight stay & breakfast)

KEY INFO:
- Free pickup from any Dubai or Sharjah hotel.
- Kids under 3: Free. Ages 3–12: 50% off. Group of 5+: 10% discount.
- Contact: +92-349-9038984

CONVERSATION FLOW FOR GREETINGS:
When someone says "Hi", "Hello", "Salam", or any greeting:
→ Greet them back warmly.
→ Ask what they're interested in: morning, evening, or overnight safari — or if they already have something in mind.
→ Do NOT list packages or prices at this point.

PACKAGE LISTING RULE:
If a customer asks "what packages do you have?" or "what are the options?" — list them cleanly like this:

🌅 *Evening Desert Safari* (3 PM – 9 PM)
- Shared – AED 150/person
- VIP – AED 200/person
- Private – AED 600/car (up to 6 people)
Includes: dune bashing, sandboarding, BBQ dinner, live shows + free pickup.

🏍️ *Evening + Quad Bike* – AED 250/person (30 mins quad)

🚗 *Evening + Dune Buggy* – AED 600–1000 (based on buggy type)

🌄 *Morning Safari* (6 AM – 10 AM)
- Shared – AED 120/person
- Private – AED 500/car

🌙 *Overnight Safari* – AED 350/person (stay + breakfast included)

Then ask: "Which one sounds good to you?"

BOOKING FLOW:
When a customer wants to book, ask for ALL of the following details in ONE message:
"Sure! Just need a few details to get you booked in 😊
- Your full name
- Safari date
- Number of adults
- Number of children (and ages if any)
- Which package
- Your hotel or pickup location"

Once they reply, check what's provided. If anything is missing, ask ONLY for the missing fields in one follow-up. Do not ask for things already given.

Once ALL 6 details are confirmed (name, date, adults, children, package, hotel), output exactly:
BOOKING_COMPLETE:{"name":"<n>","date":"<date>","adults":<number>,"children":<number>,"package":"<package>","hotel":"<hotel>"}

The customer must NOT see this line. It comes after any closing message you send them.

If you don't know something, say: "Let me check that for you — for anything urgent you can also reach us at +92-349-9038984."
Always reply in the same language the customer is using (Arabic or English).`;

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