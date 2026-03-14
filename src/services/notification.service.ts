import nodemailer from "nodemailer";
import { BookingDetails } from "./ai.service";
import whatsappService from "./whatsapp.service";

// ─── Owner contact info (set in .env) ────────────────────────────────────────
const OWNER_PHONE = process.env.OWNER_WHATSAPP_PHONE!; // e.g. "971501234567"
const OWNER_EMAIL = process.env.OWNER_EMAIL!;

// ─── Nodemailer transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail", // or use SMTP settings
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // use App Password for Gmail
  },
});

// ─── Format booking for WhatsApp ─────────────────────────────────────────────
function formatWhatsAppNotification(booking: BookingDetails): string {
  return (
    `🏜️ *NEW BOOKING ALERT — Share Desert Safari*\n\n` +
    `👤 *Name:* ${booking.name}\n` +
    `📅 *Date:* ${booking.date}\n` +
    `👥 *Adults:* ${booking.adults}\n` +
    `🧒 *Children:* ${booking.children}\n` +
    `📦 *Package:* ${booking.package}\n` +
    `🏨 *Hotel:* ${booking.hotel}\n` +
    `📞 *Customer WhatsApp:* +${booking.phone}\n\n` +
    `Reply to the customer: https://wa.me/${booking.phone}`
  );
}

// ─── Format booking for Email ─────────────────────────────────────────────────
function formatEmailNotification(booking: BookingDetails): string {
  return `
    <h2>🏜️ New Safari Booking — Share Desert Safari</h2>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
      <tr><td><b>Customer Name</b></td><td>${booking.name}</td></tr>
      <tr><td><b>Safari Date</b></td><td>${booking.date}</td></tr>
      <tr><td><b>Adults</b></td><td>${booking.adults}</td></tr>
      <tr><td><b>Children</b></td><td>${booking.children}</td></tr>
      <tr><td><b>Package</b></td><td>${booking.package}</td></tr>
      <tr><td><b>Hotel / Pickup</b></td><td>${booking.hotel}</td></tr>
      <tr><td><b>Customer WhatsApp</b></td><td>+${booking.phone}</td></tr>
    </table>
    <br/>
    <a href="https://wa.me/${booking.phone}" style="padding:10px 20px;background:#25D366;color:white;text-decoration:none;border-radius:5px;">
      💬 Reply on WhatsApp
    </a>
  `;
}

// ─── Main notification function ───────────────────────────────────────────────
export async function notifyOwner(booking: BookingDetails): Promise<void> {
  const results = await Promise.allSettled([
    notifyViaWhatsApp(booking),
    notifyViaEmail(booking),
  ]);

  results.forEach((result, i) => {
    const channel = i === 0 ? "WhatsApp" : "Email";
    if (result.status === "rejected") {
      console.error(`❌ Owner ${channel} notification failed:`, result.reason);
    } else {
      console.log(`✅ Owner notified via ${channel}`);
    }
  });
}

async function notifyViaWhatsApp(booking: BookingDetails): Promise<void> {
  const message = formatWhatsAppNotification(booking);
  await whatsappService.sendText({ to: OWNER_PHONE, message });
}

async function notifyViaEmail(booking: BookingDetails): Promise<void> {
  await transporter.sendMail({
    from: `"Share Desert Safari Bot" <${process.env.EMAIL_USER}>`,
    to: OWNER_EMAIL,
    subject: `🏜️ New Booking: ${booking.name} — ${booking.package} on ${booking.date}`,
    html: formatEmailNotification(booking),
  });
}