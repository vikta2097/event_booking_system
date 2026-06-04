const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");

const db = require("./db");
const { verifyToken } = require("./auth");

const app = express();
const server = http.createServer(app);

// ================= SOCKET INIT =================
const { initSocket } = require("./socket");
initSocket(server);

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
const notificationRoutes = require("./routes/notifications");

const mpesaCallback = require("./routes/mpesaCallback");

require("./eventScheduler");

// ================= CORS =================
const allowedOrigins = [
  "http://localhost:3000",
  "https://eventhyper.netlify.app",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// static
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

// notifications (protected)
app.use("/api/notifications", verifyToken, notificationRoutes);

mpesaCallback(app, db);

// ================= HEALTH =================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ================= START =================
const startServer = async () => {
  await db.pool.connect();

  const PORT = process.env.PORT || 3300;

  server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });
};

startServer();