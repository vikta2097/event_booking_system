const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const db = require("./db");

// ===== AUTH MIDDLEWARE =====
const { verifyToken } = require("./auth");

// ===== SOCKET.IO SETUP =====
const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://eventhyper.netlify.app",
    ],
    credentials: true,
  },
});

// ===== ROUTES =====
const authRoutes = require("./routes/authentification");
const adminRoutes = require("./routes/admins");
const bookingsRouter = require("./routes/bookings");
const userRoutes = require("./routes/users");
const eventsRouter = require("./routes/events");
const categoriesRouter = require("./routes/categories");
const ticketTypesRouter = require("./routes/ticketTypes");
const dashboardRouter = require("./routes/dashboard");
const paymentsRouter = require("./routes/payments");
const reportsRouter = require("./routes/reports");
const supportRoutes = require("./routes/support");
const settingsRoutes = require("./routes/settings");
const ticketsRouter = require("./routes/tickets");
const contactRoutes = require("./routes/contact");
const testRoutes = require("./routes/test");
const chatbotRoutes = require("./routes/chatbot");
const tagsRouter = require('./routes/tags');

// Notifications
const {
  router: notificationRoutes,
  attachSocket,
} = require("./routes/notifications");

attachSocket(io);

// M-Pesa callback
const mpesaCallback = require("./routes/mpesaCallback");

// Event scheduler
require("./eventScheduler");

// ===== SOCKET IO LOGIC =====
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log(`✅ Socket connected: ${socket.id}`);

  socket.on("join_user_room", (userId) => {
    const room = `user_${userId}`;
    socket.join(room);
    connectedUsers.set(userId, socket.id);

    console.log(`👤 User ${userId} joined ${room}`);
    socket.emit("joined_room", { userId, room });
  });

  socket.on("leave_user_room", (userId) => {
    const room = `user_${userId}`;
    socket.leave(room);
    connectedUsers.delete(userId);
    console.log(`👋 User ${userId} left ${room}`);
  });

  socket.on("disconnect", () => {
    for (const [userId, id] of connectedUsers.entries()) {
      if (id === socket.id) {
        connectedUsers.delete(userId);
        console.log(`❌ User ${userId} disconnected`);
        break;
      }
    }
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });

  socket.on("ping", () => socket.emit("pong"));
});

global.io = io;

// ===== CORS CONFIG =====
const allowedOrigins = [
  "http://localhost:3000",
  "https://eventhyper.netlify.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      callback(new Error("CORS not allowed for: " + origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ===== BODY PARSER & STATIC FILES =====
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads/avatars", express.static(path.join(__dirname, "uploads/avatars")));

// ===== API ROUTES =====
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/bookings", bookingsRouter);
app.use("/api/users", userRoutes);
app.use("/api/events", eventsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api", ticketTypesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/support", supportRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/tickets", ticketsRouter);
app.use("/api/contact", contactRoutes);
app.use("/api", testRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use('/api/tags', tagsRouter);

// 🔒 Protected notifications route
app.use("/api/notifications", verifyToken, notificationRoutes);

// M-Pesa callback
mpesaCallback(app, db);

// ===== TOKEN VALIDATION =====
app.get("/api/validate-token", verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.send("✅ Event Booking System API running...");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    connectedUsers: connectedUsers.size,
  });
});

// ===== 404 =====
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// ===== GLOBAL ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

// ===== CREATE DEFAULT ADMIN =====
const ensureDefaultAdmin = async () => {
  try {
    const result = await db.query(
      "SELECT * FROM usercredentials WHERE role = 'admin' LIMIT 1"
    );

    if (result.rows.length === 0) {
      console.log("⚠️ Creating default admin...");

      const hash = await bcrypt.hash("Admin@123", 10);

      await db.query(
        "INSERT INTO usercredentials (fullname, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        ["System Admin", "admin@system.com", hash, "admin"]
      );

      console.log("✅ Default admin created");
    } else {
      console.log("✅ Admin already exists");
    }
  } catch (error) {
    console.error("❌ Error creating default admin:", error);
  }
};

// ===== START SERVER =====
const startServer = async () => {
  try {
    const client = await db.pool.connect();
    client.release();
    console.log("✅ Database connected.");

    const PORT = process.env.PORT || 3300;

    server.listen(PORT, async () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 CORS: ${allowedOrigins.join(", ")}`);
      console.log(`🔌 Socket.IO ready`);
      await ensureDefaultAdmin();
    });
  } catch (err) {
    console.error("❌ Failed to connect to DB:", err.message);
    process.exit(1);
  }
};

startServer();
