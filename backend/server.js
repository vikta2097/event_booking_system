// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("./db"); 


// Auth middleware
const { verifyToken } = require("./auth");

// Routes
const authRoutes = require("./routes/authentification");
const adminRoutes = require("./routes/admins");
const bookingsRouter = require('./routes/bookings');
const userRoutes = require('./routes/users');



const app = express();
const server = http.createServer(app);

// ✅ Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use('/api/bookings', bookingsRouter);
app.use('/api/users', userRoutes);

// ✅ Token validation
app.get("/api/validate-token", verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ Auth service running...");
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// ✅ Ensure default admin account exists
const ensureDefaultAdmin = async () => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM usercredentials WHERE role = 'admin' LIMIT 1"
    );

    if (!rows || rows.length === 0) {
      console.log("⚠️ No admin found — creating default admin account...");

      const hashedPassword = await bcrypt.hash("Admin@123", 10);
      await db.query(
        "INSERT INTO usercredentials (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        ["System Admin", "admin@system.com", hashedPassword, "admin"]
      );

      console.log("✅ Default admin created successfully:");
      console.log("   Email: admin@system.com");
      console.log("   Password: Admin@123");
    } else {
      console.log("✅ Admin account already exists, skipping creation.");
    }
  } catch (error) {
    console.error("❌ Error ensuring default admin:", error);
  }
};

// ✅ Start server only after DB connection check
const startServer = async () => {
  try {
    const conn = await db.getConnection();
    conn.release();
    console.log("✅ Database connection verified.");

    const PORT = process.env.PORT || 3300;
    server.listen(PORT, async () => {
      console.log(`🚀 Server running on port ${PORT}`);
      await ensureDefaultAdmin();
    });
  } catch (err) {
    console.error("❌ Failed to connect to the database:", err.message);
    process.exit(1); // Stop server if DB fails
  }
};

startServer();
