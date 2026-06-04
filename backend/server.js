const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { verifyToken } = require("./auth");

const app = express();
const server = http.createServer(app);

const { Server } = require("socket.io");

const JWT_SECRET = process.env.JWT_SECRET || "your_secret";

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://eventhyper.netlify.app",
    ],
    credentials: true,
  },
});

// ================= SOCKET AUTH MIDDLEWARE =================
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    socket.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// ================= SOCKET STATE =================
const connectedUsers = new Map();

// ================= SOCKET CONNECTION =================
io.on("connection", (socket) => {
  console.log(`🔐 Authenticated socket: ${socket.id}`, socket.user);

  const userId = socket.user.id;

  // Auto-join secure user room
  const room = `user_${userId}`;
  socket.join(room);

  connectedUsers.set(userId, socket.id);

  socket.emit("connected", {
    message: "Socket authenticated successfully",
    userId,
    room,
  });

  // Optional heartbeat
  socket.on("ping", () => socket.emit("pong"));

  // SAFE: no user input room joining anymore
  socket.on("join_user_room", () => {
    socket.join(room);
    socket.emit("joined_room", { room });
  });

  socket.on("disconnect", () => {
    connectedUsers.delete(userId);
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// ================= EXPORT SOCKET =================
const getIO = () => io;

module.exports.io = io;
module.exports.getIO = getIO;

// ================= ROUTES =================
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
const tagsRouter = require("./routes/tags");

const {
  router: notificationRoutes,
  attachSocket,
} = require("./routes/notifications");

attachSocket(io);

const mpesaCallback = require("./routes/mpesaCallback");
require("./eventScheduler");

// ================= CORS =================
const allowedOrigins = [
  "http://localhost:3000",
  "https://eventhyper.netlify.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin))
        return callback(null, true);

      return callback(new Error("CORS blocked"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ================= MIDDLEWARE =================
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads/avatars", express.static(path.join(__dirname, "uploads/avatars")));

// ================= ROUTES =================
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
app.use("/api/tags", tagsRouter);

app.use("/api/notifications", verifyToken, notificationRoutes);

mpesaCallback(app, db);

// ================= SOCKET ACCESS IN ROUTES =================
app.set("io", io);

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("API running...");
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    connectedUsers: connectedUsers.size,
    timestamp: new Date().toISOString(),
  });
});

// ================= TOKEN CHECK =================
app.get("/api/validate-token", verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ================= ERROR HANDLING =================
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

// ================= ADMIN SEED =================
const ensureDefaultAdmin = async () => {
  try {
    const result = await db.query(
      "SELECT * FROM usercredentials WHERE role = 'admin' LIMIT 1"
    );

    if (result.rows.length === 0) {
      const hash = await bcrypt.hash("Admin@123", 10);

      await db.query(
        "INSERT INTO usercredentials (fullname, email, password_hash, role) VALUES ($1,$2,$3,$4)",
        ["System Admin", "admin@system.com", hash, "admin"]
      );
    }
  } catch (e) {
    console.error(e);
  }
};

// ================= START SERVER =================
const startServer = async () => {
  try {
    await db.pool.connect();

    const PORT = process.env.PORT || 3300;

    server.listen(PORT, async () => {
      console.log(`Server running on ${PORT}`);
      console.log(`Socket.IO secured & active`);
      await ensureDefaultAdmin();
    });
  } catch (err) {
    console.error("DB connection failed", err.message);
    process.exit(1);
  }
};

startServer();