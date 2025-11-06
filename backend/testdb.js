// test-db.js
const db = require("./db");

(async () => {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");
    console.log("✅ DB Test OK:", rows);
    process.exit(0);
  } catch (err) {
    console.error("❌ DB Test Failed:", err);
    process.exit(1);
  }
})();
