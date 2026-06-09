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
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ================= NGROK WEBHOOK ENDPOINT =================
// This endpoint receives webhook events from ngrok
app.post("/api/chatbot/webhook/receive", async (req, res) => {
  try {
    const { event, data, timestamp } = req.body;
    
    console.log(`📨 Webhook received: ${event} at ${timestamp}`);
    console.log("Webhook data:", JSON.stringify(data, null, 2));
    
    // Process webhook events
    switch (event) {
      case 'message':
        // Handle incoming message webhook
        // Could trigger notifications, analytics, etc.
        break;
      case 'typing':
        // Handle typing indicator
        break;
      case 'test':
        console.log("✅ Test webhook received successfully");
        break;
      default:
        console.log(`Unknown webhook event: ${event}`);
    }
    
    res.json({ 
      success: true, 
      message: "Webhook received",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

// ================= NGROK SETUP =================
let ngrokListener = null;

async function setupNgrok() {
  // Only setup ngrok if explicitly enabled and not in production
  const enableNgrok = process.env.ENABLE_NGROK === 'true';
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!enableNgrok || isProduction) {
    console.log("ℹ️ Ngrok webhook disabled. Set ENABLE_NGROK=true to enable.");
    return null;
  }
  
  try {
    // Dynamic import for ngrok (ES module)
    const ngrok = await import('@ngrok/ngrok');
    
    const port = process.env.PORT || 3300;
    
    // Start ngrok tunnel
    const listener = await ngrok.default.forward({
      addr: port,
      authtoken: process.env.NGROK_AUTH_TOKEN,
      authtoken_from_env: true,
    });
    
    const ngrokUrl = listener.url();
    console.log(`🚀 Ngrok tunnel established: ${ngrokUrl}`);
    
    // Configure chatbot webhook
    const webhookUrl = `${ngrokUrl}/api/chatbot/webhook/receive`;
    
    // Import the chatbot module to set webhook
    const chatbotModule = require("./routes/chatbot");
    if (chatbotModule.setNgrokWebhook) {
      chatbotModule.setNgrokWebhook(webhookUrl, ['message', 'typing', 'test']);
      console.log(`✅ Chatbot webhook configured at: ${webhookUrl}`);
    }
    
    // Send test webhook to confirm
    const axios = require('axios');
    await axios.post(webhookUrl, {
      event: 'test',
      data: { message: "Ngrok tunnel established successfully" },
      timestamp: new Date().toISOString()
    }).catch(err => console.log("Test webhook send failed:", err.message));
    
    return listener;
    
  } catch (err) {
    console.error("❌ Ngrok setup failed:", err.message);
    console.log("⚠️ Continuing without ngrok webhook. Chatbot will still work normally.");
    
    if (err.message.includes('authtoken')) {
      console.log("💡 Tip: Get your auth token from https://dashboard.ngrok.com/auth");
      console.log("   Then add NGROK_AUTH_TOKEN=your_token_here to .env");
    }
    
    return null;
  }
}

// Graceful shutdown function
async function gracefulShutdown() {
  console.log("\n🛑 Shutting down gracefully...");
  
  if (ngrokListener) {
    try {
      await ngrokListener.close();
      console.log("✅ Ngrok tunnel closed");
    } catch (err) {
      console.error("Error closing ngrok tunnel:", err);
    }
  }
  
  // Close database connection
  try {
    await db.pool.end();
    console.log("✅ Database connection closed");
  } catch (err) {
    console.error("Error closing database:", err);
  }
  
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ================= START SERVER =================
const startServer = async () => {
  try {
    // Test database connection
    await db.pool.connect();
    console.log("✅ Database connected successfully");
    
    const PORT = process.env.PORT || 3300;
    
    server.listen(PORT, async () => {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`${"=".repeat(60)}\n`);
      
      // Setup ngrok after server is listening
      ngrokListener = await setupNgrok();
      
      // Log available endpoints
      console.log("\n📋 Available API Endpoints:");
      console.log("   • /api/health - Health check");
      console.log("   • /api/auth/* - Authentication");
      console.log("   • /api/events/* - Events management");
      console.log("   • /api/bookings/* - Bookings");
      console.log("   • /api/payments/* - Payments");
      console.log("   • /api/chatbot/* - Chatbot assistant");
      console.log("   • /api/notifications/* - Notifications");
      console.log("\n✨ Server ready!");
    });
    
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

// Start the server
startServer();