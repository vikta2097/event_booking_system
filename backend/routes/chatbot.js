const express = require("express");
const router = express.Router();
const db = require("../db"); // Postgres pool/connection
const { verifyToken } = require("../auth"); // optional JWT auth

// ======================
// INTENT RECOGNITION
// ======================
const intents = {
  greeting: ["hello", "hi", "hey", "good morning", "good afternoon", "greetings"],
  help: ["help", "assist", "support", "what can you do"],
  events: ["events", "show events", "upcoming events", "list events", "what events"],
  bookings: ["my bookings", "show bookings", "booking history", "tickets"],
  payment: ["payment", "pay", "mpesa", "how to pay", "payment method"],
  contact: ["contact", "support", "help desk", "reach you"],
  pricing: ["price", "cost", "how much", "ticket price"],
  register: ["register", "sign up", "create account", "join"],
  login: ["login", "sign in", "log in"],
  cancel: ["cancel booking", "refund", "cancel ticket"],
  stats: ["stats", "statistics", "dashboard", "revenue", "summary"],
  validate: ["validate ticket", "check ticket", "scan ticket", "verify ticket"],
  users: ["users", "show users", "user list", "manage users"],
  payments_admin: ["pending payments", "payment status", "all payments"],
};

// Detect intent
function detectIntent(message) {
  const lower = message.toLowerCase();
  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(keyword => lower.includes(keyword))) return intent;
  }
  return "unknown";
}

// ======================
// DATABASE HANDLERS
// ======================

// Upcoming events
async function getUpcomingEvents() {
  try {
    const result = await db.query(`
      SELECT id, title, event_date, location, price
      FROM events
      WHERE status='upcoming' AND event_date >= NOW()
      ORDER BY event_date ASC
      LIMIT 5
    `);
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// User bookings
async function getUserBookings(userId) {
  try {
    const result = await db.query(`
      SELECT b.id, b.reference, b.status, b.total_amount, e.title, e.event_date
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      LIMIT 5
    `, [userId]);
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Admin stats
async function getAdminStats() {
  try {
    const events = await db.query("SELECT COUNT(*) FROM events");
    const bookings = await db.query("SELECT COUNT(*) FROM bookings");
    const payments = await db.query("SELECT COUNT(*) as total, SUM(amount) as revenue FROM payments WHERE status='success'");
    const users = await db.query("SELECT COUNT(*) as total, SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END) as admins, SUM(CASE WHEN role='user' THEN 1 ELSE 0 END) as regular FROM usercredentials");

    return {
      totalEvents: parseInt(events.rows[0].count, 10),
      totalBookings: parseInt(bookings.rows[0].count, 10),
      totalRevenue: parseFloat(payments.rows[0].revenue) || 0,
      successfulPayments: parseInt(payments.rows[0].total, 10),
      totalUsers: parseInt(users.rows[0].total, 10),
      admins: parseInt(users.rows[0].admins, 10),
      regularUsers: parseInt(users.rows[0].regular, 10),
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ======================
// RESPONSES
// ======================
const guestResponses = {
  greeting: "Hello! I can show events, registration info, login help, or contact info.",
  help: "I can guide you on viewing events, registering, or contacting support.",
  events: "upcoming_events",
  register: "To register: click Register, fill your info, verify email, start booking!",
  login: "To log in: click Login, enter credentials.",
  contact: "Contact us via email victorlabs854@gmail.com or the contact form.",
  unknown: "I didn't get that. You can ask about events, registration, login, or contact info."
};

const userResponses = {
  greeting: "Welcome back! I can show your bookings, payments, events, cancellations, and support.",
  help: "Ask me about your bookings, payment instructions, or contact options.",
  events: "upcoming_events",
  bookings: "user_bookings",
  payment: "Payment instructions:\n- M-Pesa: Select at checkout, follow prompts.\n- Card: Enter card details.",
  cancel: "To cancel a booking, go to My Bookings and select a pending booking.",
  contact: "Reach support via contact form or email.",
  unknown: "I can help with bookings, payments, cancellations, events, and support."
};

const adminResponses = {
  greeting: "Hello Admin! I can show stats, recent bookings, payments, and ticket validation guidance.",
  help: "Ask me about stats, bookings, payments, ticket validation, or user info.",
  stats: "admin_stats",
  bookings: "admin_bookings",
  payments_admin: "admin_payments",
  validate: "To validate tickets: scan QR code or check booking reference.",
  users: "I can give you a summary of users.",
  unknown: "I can help with stats, bookings, payments, ticket validation, and users."
};

// ======================
// MAIN CHAT ENDPOINT
// ======================
router.post("/chat", async (req, res) => {
  try {
    const { message, role, userId } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "Message required" });

    const intent = detectIntent(message);
    let responses = role === "admin" ? adminResponses : role === "user" ? userResponses : guestResponses;
    let responseText = responses[intent] || responses.unknown;

    // Dynamic content
    let events = [];
    let bookings = [];
    let stats = null;

    if (responseText === "upcoming_events") {
      events = await getUpcomingEvents();
      responseText = events.length ? "Here are upcoming events:" : "No upcoming events.";
    }
    if (responseText === "user_bookings" && userId) {
      bookings = await getUserBookings(userId);
      responseText = bookings.length ? "Here are your recent bookings:" : "You have no bookings yet.";
    }
    if (responseText === "admin_stats" && role === "admin") {
      stats = await getAdminStats();
      responseText = stats ? "Here is the dashboard summary:" : "No stats available.";
    }

    // Contextual suggestions
    let suggestions = [];
    switch (intent) {
      case "bookings":
        suggestions = ["Cancel booking", "Upcoming events"];
        break;
      case "events":
        suggestions = ["Book event", "Show my bookings"];
        break;
      case "stats":
        suggestions = ["Recent bookings", "Payment summary"];
        break;
      default:
        suggestions = ["Help", "Events", "Bookings", "Contact support"];
    }

    res.json({
      response: responseText,
      intent,
      events,
      bookings,
      stats,
      suggestions
    });

  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ error: "Error processing request" });
  }
});

module.exports = router;
