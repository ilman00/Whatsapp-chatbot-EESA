import pool from "../config/db"; // your existing MySQL pool — adjust path as needed
import { RowDataPacket, OkPacket } from "mysql2";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConversationSummary {
  phone_number: string;
  name: string | null;
  last_message: string;
  last_message_role: "user" | "assistant";
  last_message_at: string;
  total_messages: number;
}

export interface MessageRow {
  id: number;
  phone_number: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface BookingRow {
  id: number;
  phone_number: string;
  name: string | null;
  package: string | null;
  safari_date: string | null;
  adults: number | null;
  children: number | null;
  hotel: string | null;
  created_at: string;
}

export interface CustomerRow {
  id: number;
  phone_number: string;
  name: string | null;
  preferred_language: "en" | "ar";
  total_bookings: number;
  created_at: string;
}

export interface StatsResult {
  bookings_today: number;
  bookings_this_week: number;
  bookings_this_month: number;
  total_customers: number;
  active_conversations_24h: number;
  top_package: string | null;
  bookings_per_day: { date: string; count: number }[];
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(): Promise<StatsResult> {
  const [today] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM bookings WHERE DATE(created_at) = CURDATE()`
  );

  const [thisWeek] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM bookings
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
  );

  const [thisMonth] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM bookings
     WHERE MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())`
  );

  const [totalCustomers] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt FROM customers`
  );

  const [activeConvos] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT phone_number) AS cnt FROM messages
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
  );

  const [topPackage] = await pool.query<RowDataPacket[]>(
    `SELECT package, COUNT(*) AS cnt FROM bookings
     WHERE package IS NOT NULL
     GROUP BY package ORDER BY cnt DESC LIMIT 1`
  );

  const [perDay] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM bookings
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );

  return {
    bookings_today: today[0].cnt,
    bookings_this_week: thisWeek[0].cnt,
    bookings_this_month: thisMonth[0].cnt,
    total_customers: totalCustomers[0].cnt,
    active_conversations_24h: activeConvos[0].cnt,
    top_package: topPackage[0]?.package ?? null,
    bookings_per_day: (perDay as RowDataPacket[]).map((r) => ({
      date: r.date,
      count: r.count,
    })),
  };
}

// ─── Conversations ─────────────────────────────────────────────────────────────

export async function getConversations(): Promise<ConversationSummary[]> {
  // One row per phone: latest message content + customer name
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       m.phone_number,
       c.name,
       m.content        AS last_message,
       m.role           AS last_message_role,
       m.created_at     AS last_message_at,
       cnt.total        AS total_messages
     FROM messages m
     -- subquery: only the latest message per phone
     INNER JOIN (
       SELECT phone_number, MAX(id) AS max_id
       FROM messages
       GROUP BY phone_number
     ) latest ON m.id = latest.max_id
     -- subquery: message count per phone
     INNER JOIN (
       SELECT phone_number, COUNT(*) AS total
       FROM messages
       GROUP BY phone_number
     ) cnt ON m.phone_number = cnt.phone_number
     LEFT JOIN customers c ON c.phone_number = m.phone_number
     ORDER BY m.created_at DESC`
  );

  return rows as ConversationSummary[];
}

export async function getMessageThread(phone: string): Promise<MessageRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, phone_number, role, content, created_at
     FROM messages
     WHERE phone_number = ?
     ORDER BY created_at ASC`,
    [phone]
  );
  return rows as MessageRow[];
}

// ─── Bookings ──────────────────────────────────────────────────────────────────

export interface BookingFilters {
  from?: string;   // YYYY-MM-DD
  to?: string;     // YYYY-MM-DD
  package?: string;
}

export async function getBookings(filters: BookingFilters): Promise<BookingRow[]> {
  const conditions: string[] = [];
  const params: (string)[] = [];

  if (filters.from) {
    conditions.push("DATE(created_at) >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("DATE(created_at) <= ?");
    params.push(filters.to);
  }
  if (filters.package) {
    conditions.push("package = ?");
    params.push(filters.package);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, phone_number, name, package, safari_date,
            adults, children, hotel, created_at
     FROM bookings
     ${where}
     ORDER BY created_at DESC`,
    params
  );

  return rows as BookingRow[];
}

// ─── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<CustomerRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, phone_number, name, preferred_language, total_bookings, created_at
     FROM customers
     ORDER BY created_at DESC`
  );
  return rows as CustomerRow[];
}

export async function getCustomerBookings(phone: string): Promise<BookingRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, phone_number, name, package, safari_date,
            adults, children, hotel, created_at
     FROM bookings
     WHERE phone_number = ?
     ORDER BY created_at DESC`,
    [phone]
  );
  return rows as BookingRow[];
}