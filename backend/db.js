const mysql = require("mysql2");
require("dotenv").config();

// ✅ Shared configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// ✅ Create a connection pool (callback + promise compatible)
const pool = mysql.createPool(dbConfig);
const promisePool = pool.promise();

// ✅ Test connection once at startup
(async () => {
  try {
    const conn = await promisePool.getConnection();
    console.log("✅ Connected to MySQL database!");
    conn.release();
  } catch (err) {
    console.error("❌ MySQL connection error:", err.message);
  }
})();

// ✅ Export a unified interface
module.exports = {
  // For EMS-style routes (callback syntax)
  query: pool.query.bind(pool),
  execute: pool.execute.bind(pool),

  // For Event Booking and async/await style
  promise: promisePool,

  // For server startup connection verification
  getConnection: () => promisePool.getConnection(),

  // Optionally export the raw pool
  pool,
};
