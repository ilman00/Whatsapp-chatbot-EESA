import mysql from "mysql2/promise";

// ─── RDS Connection Pool ──────────────────────────────────────────────────────
const pool = mysql.createPool({
  host: process.env.DB_HOST,         // RDS endpoint, e.g. mydb.xxxx.us-east-1.rds.amazonaws.com
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "desert_safari",
  waitForConnections: true,
  connectionLimit: 10,               // max simultaneous connections
  queueLimit: 0,                     // unlimited queue
  connectTimeout: 10_000,            // 10s timeout
  timezone: "+00:00",                // store UTC in DB
});

// ─── Verify connection on startup ─────────────────────────────────────────────
pool.getConnection()
  .then((conn) => {
    console.log("✅ MySQL RDS connected successfully");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ MySQL RDS connection failed:", err.message);
    process.exit(1); // crash fast so EC2/PM2 restarts and alerts you
  });

export default pool;