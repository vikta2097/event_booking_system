// db.js
const { Pool } = require("pg");
require("dotenv").config();

// ✅ Shared configuration
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

// ✅ Test connection once at startup
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to PostgreSQL database!");
    client.release();
  } catch (err) {
    console.error("❌ PostgreSQL connection error:", err.message);
  }
})();

// ✅ Export a unified interface
module.exports = {
  // For query execution with async/await
  query: (text, params) => pool.query(text, params),

  // For getting a raw client if needed (transaction support)
  getClient: () => pool.connect(),

  // Optionally export the raw pool
  pool,
};
