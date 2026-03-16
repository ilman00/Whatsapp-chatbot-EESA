import pool from "../config/db";
import { BookingDetails } from "./ai.service";

// ─── Types ────────────────────────────────────────────────────────────────────
export type MessageRole = "user" | "assistant";

export interface DBMessage {
  role: MessageRole;
  content: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────
/**
 * Insert customer if new, update name if provided.
 * Called on every incoming message so the customer row always exists.
 */
export async function upsertCustomer(
  phone: string,
  name?: string
): Promise<void> {
  await pool.execute(
    `INSERT INTO customers (phone_number, name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       name        = IF(? IS NOT NULL AND ? != '', VALUES(name), name),
       updated_at  = NOW()`,
    [phone, name ?? null, name ?? null, name ?? null]
  );
}

// ─── Messages ─────────────────────────────────────────────────────────────────
/**
 * Persist a single message (user or assistant) to the DB.
 */
export async function saveMessage(
  phone: string,
  role: MessageRole,
  content: string
): Promise<void> {
  await pool.execute(
    `INSERT INTO messages (phone_number, role, content) VALUES (?, ?, ?)`,
    [phone, role, content]
  );
}

/**
 * Load the most recent N messages for a phone number, oldest-first,
 * so they can be fed directly into the Gemini chat history.
 */
export async function getRecentMessages(
  phone: string,
  limit: number = 20
): Promise<DBMessage[]> {
  // Inner query gets the LAST `limit` rows; outer query re-sorts oldest-first
  const [rows] = await pool.execute<any[]>(
    `SELECT role, content
     FROM (
       SELECT role, content, created_at
       FROM messages
       WHERE phone_number = ?
       ORDER BY created_at DESC
       LIMIT ?
     ) AS recent
     ORDER BY created_at ASC`,
    [phone, limit]
  );

  return rows as DBMessage[];
}

/**
 * Delete all messages for a phone number.
 * Called after a booking is completed so the next conversation starts fresh.
 */
export async function clearMessages(phone: string): Promise<void> {
  await pool.execute(
    `DELETE FROM messages WHERE phone_number = ?`,
    [phone]
  );
}

// ─── Bookings ─────────────────────────────────────────────────────────────────
/**
 * Persist a completed booking and increment the customer's booking counter.
 */
export async function saveBooking(booking: BookingDetails): Promise<void> {
  // Parse DD/MM/YYYY → YYYY-MM-DD for MySQL DATE column
  const [day, month, year] = booking.date.split("/");
  const mysqlDate = `${year}-${month}-${day}`;

  await pool.execute(
    `INSERT INTO bookings
       (phone_number, name, package, safari_date, adults, children, hotel)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      booking.phone,
      booking.name,
      booking.package,
      mysqlDate,
      booking.adults,
      booking.children,
      booking.hotel,
    ]
  );

  // Increment total_bookings on the customer profile
  await pool.execute(
    `UPDATE customers
     SET total_bookings = total_bookings + 1, updated_at = NOW()
     WHERE phone_number = ?`,
    [booking.phone]
  );
}