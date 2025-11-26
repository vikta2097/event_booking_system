const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const db = require("./db");
const { verifyToken } = require("./auth");

// Routes
const authRoutes = require("./routes/authentification");
const adminRoutes = require("./routes/admins");
const bookingsRouter = require("./routes/bookings");
const userRoutes = require("./routes/users");
const eventsRouter = require("./routes/events");
const categoriesRouter = require("./routes/categories");
const ticketTypesRouter = require("./routes/ticketTypes");
const dashboardRouter = require("./routes/dashboard");
const paymentsRouter = require("./routes/payments");
const mpesaCallbackRoute = require("./routes/mpesaCallback"); // renamed for clarity
const reportsRouter = require("./routes/reports");
const supportRoutes = require("./routes/support");
const settingsRoutes = require("./routes/settings");
const ticketsRouter = require("./routes/tickets"); // unified tickets router
const contactRoutes = require('./routes/contact');

const app = express();
const server = http.createServer(app);

require("./eventScheduler");

// =======================
// ✅ CORS middleware
// =======================
const allowedOrigins = [
  "http://localhost:3000",
  "https://eventhyper.netlify.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Allow Postman/curl
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// =======================
// ✅ Body parser & static files
// =======================
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads/avatars", express.static(path.join(__dirname, "uploads/avatars")));

// =======================
// ✅ Routes
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingsRouter);
app.use("/api/users", userRoutes);
app.use("/api/events", eventsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api", ticketTypesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/payments", paymentsRouter);         
app.use("/api/payments/mpesa-callback", mpesaCallbackRoute); 
app.use("/api/reports", reportsRouter);
app.use("/api/support", supportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/tickets", ticketsRouter);           
app.use("/api/contact", contactRoutes);

// =======================
// ✅ Token validation
// =======================
app.get("/api/validate-token", verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// =======================
// ✅ Health check
// =======================
app.get("/", (req, res) => {
  res.send("✅ Event Booking System API running...");
});

// =======================
// 404 handler
// =======================
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// =======================
// Global error handler
// =======================
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// =======================
// ✅ Ensure default admin account exists
// =======================
const ensureDefaultAdmin = async () => {
  try {
    const result = await db.query(
      "SELECT * FROM usercredentials WHERE role = 'admin' LIMIT 1"
    );

    if (!result.rows || result.rows.length === 0) {
      console.log("⚠️ No admin found — creating default admin account...");

      const hashedPassword = await bcrypt.hash("Admin@123", 10);
      await db.query(
        "INSERT INTO usercredentials (fullname, email, password_hash, role) VALUES ($1, $2, $3, $4)",
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

// =======================
// ✅ Start server after DB connection check
// =======================
const startServer = async () => {
  try {
    const client = await db.pool.connect();
    client.release();
    console.log("✅ Database connection verified.");

    const PORT = process.env.PORT || 3300;
    server.listen(PORT, async () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 CORS enabled for: ${allowedOrigins.join(", ")}`);
      await ensureDefaultAdmin();
    });
  } catch (err) {
    console.error("❌ Failed to connect to the database:", err.message);
    process.exit(1);
  }
};

startServer();
