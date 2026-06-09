const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");
const Groq = require("groq-sdk");

// ======================
// GROQ CLIENT
// ======================
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const GROQ_MODEL = process.env.GROQ_MODEL || "llama3-70b-8192";

// ======================
// IN-MEMORY CONTEXT (30-min TTL)
// ======================
const conversationContext = new Map();

function updateContext(userId, data) {
  const existing = conversationContext.get(userId) || {};
  conversationContext.set(userId, {
    ...existing,
    ...data,
    lastActivity: Date.now(),
    history: existing.history || [],
  });
}

function getContext(userId) {
  if (!userId) return null;
  const context = conversationContext.get(userId);
  if (context && Date.now() - context.lastActivity > 1_800_000) {
    conversationContext.delete(userId);
    return null;
  }
  return context || null;
}

/**
 * Keep last N turns (user + assistant pairs) in memory for multi-turn chat.
 */
function addToHistory(userId, userMsg, botMsg) {
  const context = getContext(userId) || {};
  const history = context.history || [];
  history.push({ role: "user", content: userMsg });
  history.push({ role: "assistant", content: botMsg });
  // Keep last 20 messages (10 turns)
  if (history.length > 20) history.splice(0, history.length - 20);
  updateContext(userId, { history });
}

function clearContext(userId) {
  conversationContext.delete(userId);
}

// ======================
// DATABASE: SAVE / LOAD HISTORY
// ======================

/**
 * Persist each turn so history survives server restarts.
 * Requires table: chatbot_conversations (see migration at bottom of file).
 */
async function saveConversation(userId, message, response, intent, modelUsed) {
  try {
    await db.query(
      `INSERT INTO chatbot_conversations
         (user_id, message, response, intent, model_used, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, message, response, intent, modelUsed]
    );
  } catch (err) {
    // Non-fatal – log and continue
    console.error("saveConversation error:", err.message);
  }
}

/**
 * Load the last `limit` turns from DB and return them as OpenAI-style messages
 * so Groq picks up the conversation even after a page reload.
 */
async function loadHistoryFromDB(userId, limit = 10) {
  try {
    const result = await db.query(
      `SELECT message, response
       FROM chatbot_conversations
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    // Reverse so oldest is first, then expand each row into two messages
    return result.rows.reverse().flatMap((row) => [
      { role: "user", content: row.message },
      { role: "assistant", content: row.response },
    ]);
  } catch (err) {
    console.error("loadHistoryFromDB error:", err.message);
    return [];
  }
}

// ======================
// DATABASE QUERY HELPERS
// ======================

async function getUserById(userId) {
  try {
    const { rows } = await db.query(
      `SELECT id, fullname, email, role, phone, created_at
       FROM usercredentials WHERE id = $1`,
      [userId]
    );
    return rows[0] || null;
  } catch (err) {
    console.error("getUserById error:", err.message);
    return null;
  }
}

async function getUpcomingEvents(limit = 5, category = null) {
  try {
    const params = [];
    let query = `
      SELECT e.id, e.title, e.description, e.event_date, e.start_time,
             e.location, e.venue, e.price, e.capacity,
             c.name AS category,
             COALESCE(SUM(b.seats), 0) AS booked
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN bookings b ON b.event_id = e.id AND b.status = 'confirmed'
      WHERE e.status = 'upcoming' AND e.event_date >= CURRENT_DATE
    `;
    if (category) {
      params.push(category);
      query += ` AND c.name ILIKE $${params.length}`;
    }
    params.push(limit);
    query += ` GROUP BY e.id, c.name ORDER BY e.event_date ASC LIMIT $${params.length}`;
    const { rows } = await db.query(query, params);
    return rows;
  } catch (err) {
    console.error("getUpcomingEvents error:", err.message);
    return [];
  }
}

async function getUserBookings(userId, limit = 5) {
  try {
    const { rows } = await db.query(
      `SELECT b.id, b.reference, b.status, b.total_amount, b.seats, b.booking_date,
              e.id AS event_id, e.title, e.event_date, e.location, e.start_time,
              p.status AS payment_status, p.mpesa_receipt
       FROM bookings b
       JOIN events e ON b.event_id = e.id
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  } catch (err) {
    console.error("getUserBookings error:", err.message);
    return [];
  }
}

async function searchEvents(keyword, limit = 5) {
  try {
    const { rows } = await db.query(
      `SELECT id, title, event_date, location, price
       FROM events
       WHERE status = 'upcoming'
         AND event_date >= CURRENT_DATE
         AND (title ILIKE $1 OR description ILIKE $1 OR location ILIKE $1)
       ORDER BY event_date ASC
       LIMIT $2`,
      [`%${keyword}%`, limit]
    );
    return rows;
  } catch (err) {
    console.error("searchEvents error:", err.message);
    return [];
  }
}

async function getAdminStats() {
  try {
    const [events, bookings, payments, users] = await Promise.all([
      db.query("SELECT COUNT(*) FROM events"),
      db.query("SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'"),
      db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS revenue
                FROM payments WHERE status = 'success'`),
      db.query(`SELECT COUNT(*) AS total,
                       SUM(CASE WHEN role='admin'     THEN 1 ELSE 0 END) AS admins,
                       SUM(CASE WHEN role='organizer' THEN 1 ELSE 0 END) AS organizers,
                       SUM(CASE WHEN role='user'      THEN 1 ELSE 0 END) AS regular_users
                FROM usercredentials`),
    ]);
    return {
      totalEvents:   parseInt(events.rows[0].count, 10),
      totalBookings: parseInt(bookings.rows[0].count, 10),
      totalRevenue:  parseFloat(payments.rows[0].revenue) || 0,
      totalUsers:    parseInt(users.rows[0].total, 10),
    };
  } catch (err) {
    console.error("getAdminStats error:", err.message);
    return null;
  }
}

async function getOrganizerStats(userId) {
  try {
    const [events, bookings, today] = await Promise.all([
      db.query("SELECT COUNT(*) FROM events WHERE created_by = $1", [userId]),
      db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(b.total_amount),0) AS revenue
                FROM bookings b
                JOIN events e ON b.event_id = e.id
                WHERE e.created_by = $1 AND b.status = 'confirmed'`, [userId]),
      db.query(`SELECT COUNT(*) AS today_count
                FROM bookings b
                JOIN events e ON b.event_id = e.id
                WHERE e.created_by = $1 AND DATE(b.created_at) = CURRENT_DATE`, [userId]),
    ]);
    return {
      totalEvents:   parseInt(events.rows[0].count, 10),
      totalBookings: parseInt(bookings.rows[0].total, 10) || 0,
      totalRevenue:  parseFloat(bookings.rows[0].revenue) || 0,
      todayBookings: parseInt(today.rows[0].today_count, 10) || 0,
    };
  } catch (err) {
    console.error("getOrganizerStats error:", err.message);
    return null;
  }
}

// ======================
// GROQ AI RESPONSE
// ======================

/**
 * Build the system prompt with live DB data injected so the model answers
 * accurately about events, bookings, and stats — no hallucination needed.
 */
function buildSystemPrompt(role, userData, relevantData) {
  const now = new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });

  let dataSection = "";

  if (relevantData.events?.length) {
    dataSection += `\n📅 UPCOMING EVENTS (from database):\n`;
    relevantData.events.forEach((e) => {
      dataSection += `  • [ID:${e.id}] ${e.title} — ${new Date(e.event_date).toDateString()}`;
      dataSection += ` | 📍 ${e.location || e.venue || "TBD"}`;
      dataSection += ` | 💰 KES ${e.price ?? "Free"}`;
      if (e.category) dataSection += ` | 🏷 ${e.category}`;
      dataSection += `\n`;
    });
  }

  if (relevantData.bookings?.length) {
    dataSection += `\n🎟 USER'S BOOKINGS (from database):\n`;
    relevantData.bookings.forEach((b) => {
      dataSection += `  • [Ref:${b.reference}] ${b.title}`;
      dataSection += ` — ${b.status.toUpperCase()}`;
      dataSection += ` | ${new Date(b.event_date).toDateString()}`;
      dataSection += ` | ${b.seats} seat(s) | KES ${b.total_amount}`;
      dataSection += ` | Payment: ${b.payment_status || "pending"}`;
      if (b.mpesa_receipt) dataSection += ` | M-Pesa: ${b.mpesa_receipt}`;
      dataSection += `\n`;
    });
  }

  if (relevantData.stats) {
    const s = relevantData.stats;
    dataSection += `\n📊 PLATFORM STATS (from database):\n`;
    Object.entries(s).forEach(([k, v]) => {
      dataSection += `  • ${k}: ${typeof v === "number" ? v.toLocaleString() : v}\n`;
    });
  }

  if (relevantData.searchResults?.length) {
    dataSection += `\n🔍 SEARCH RESULTS:\n`;
    relevantData.searchResults.forEach((e) => {
      dataSection += `  • [ID:${e.id}] ${e.title} | ${new Date(e.event_date).toDateString()} | 📍 ${e.location} | KES ${e.price}\n`;
    });
  }

  return `You are EventBot, the intelligent assistant for EventHyper — a Kenyan event booking platform.
Current time (Nairobi): ${now}
User role: ${role.toUpperCase()}
${userData ? `Logged-in user: ${userData.fullname} (${userData.email})` : "User is a guest (not logged in)."}

YOUR JOB:
- Help users discover, book, and manage events
- Answer questions about bookings, payments, and cancellations
- Guide organizers and admins with platform management tasks
- Explain M-Pesa STK push payment flow clearly when asked

RULES:
1. Only quote facts that appear in the LIVE DATA section below. Do not invent event names, prices, or dates.
2. Be concise, warm, and use relevant emojis (✅ 📅 🎟 💳 etc.).
3. If a user asks for data you don't have, direct them to the relevant dashboard page.
4. Never ask for or reveal passwords, M-Pesa PINs, or any sensitive credentials.
5. If something is outside your scope, offer to escalate to human support.
6. When a booking reference or M-Pesa receipt is visible in the data, quote it back to the user.

LIVE DATA FROM DATABASE:${dataSection || "\n  (No specific data fetched for this query — answer from general knowledge about the platform.)"}`;
}

async function generateAIResponse(message, role, userData, conversationHistory, relevantData) {
  const systemPrompt = buildSystemPrompt(role, userData, relevantData);

  // conversationHistory is an array of {role, content} — multi-turn context
  const messages = [
    { role: "system", content: systemPrompt },
    ...(conversationHistory || []),
    { role: "user", content: message },
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.65,
      max_tokens: 600,
      top_p: 0.9,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("Groq API error:", err.message);
    // Surface quota/auth errors clearly in logs
    if (err.status === 401) console.error("❌ Invalid GROQ_API_KEY");
    if (err.status === 429) console.error("⚠️  Groq rate limit hit");
    return null;
  }
}

// ======================
// FALLBACK (when Groq is unavailable)
// ======================
function getFallbackResponse(role, message, relevantData) {
  const msg = message.toLowerCase();
  if (relevantData.events?.length)
    return `I found ${relevantData.events.length} upcoming event(s)! Head to the Events page to explore them, or ask me to narrow it down.`;
  if (relevantData.bookings?.length)
    return `You have ${relevantData.bookings.length} booking(s). Visit "My Bookings" for full details, or ask me about a specific one.`;
  if (msg.includes("mpesa") || msg.includes("payment") || msg.includes("pay"))
    return "Payments on EventHyper use M-Pesa. At checkout you'll get an STK push on your phone — enter your PIN to confirm. Need help with a specific payment?";
  if (msg.includes("hello") || msg.includes("hi"))
    return role === "admin"
      ? "Hello Admin! 👋 How can I help you manage the platform today?"
      : role === "organizer"
      ? "Welcome back Organizer! 📊 What would you like to check today?"
      : "Hi there! 👋 I can help you find events, check bookings, or answer payment questions.";
  if (msg.includes("help"))
    return "Here's what I can help you with:\n• 📅 Find upcoming events\n• 🎟 Check your bookings\n• 💳 Payment & M-Pesa help\n• 📊 Event/platform stats\n\nWhat would you like to know?";
  return "How can I help you with events or bookings today? Feel free to ask!";
}

// ======================
// SUGGESTION GENERATOR
// ======================
function generateSuggestions(message, role) {
  const msg = message.toLowerCase();
  if (msg.includes("event") || msg.includes("upcoming"))
    return ["Show all events", "Filter by category", "Events near me"];
  if (msg.includes("booking") || msg.includes("ticket"))
    return ["My bookings", "Cancel a booking", "Download my ticket"];
  if (msg.includes("payment") || msg.includes("mpesa"))
    return ["How M-Pesa works", "Check payment status", "Payment failed help"];
  if (msg.includes("stat") || msg.includes("revenue") || msg.includes("dashboard"))
    return ["Today's stats", "Monthly report", "Export data"];
  const defaults = {
    admin:     ["Platform stats", "Recent bookings", "Manage users", "View payments"],
    organizer: ["My events", "Event revenue", "Scan tickets", "Recent bookings"],
    user:      ["Upcoming events", "My bookings", "M-Pesa help", "Contact support"],
    guest:     ["Browse events", "How to register", "Contact us"],
  };
  return defaults[role] || defaults.guest;
}

// ======================
// MAIN CHAT PROCESSOR
// ======================
async function processChat(message, role, userId) {
  const t0 = Date.now();

  let userData = null;
  const relevantData = { events: [], bookings: [], stats: null, searchResults: [] };
  const msgLower = message.toLowerCase();

  // --- Fetch DB data relevant to this message ---
  if (userId && role !== "guest") {
    userData = await getUserById(userId);

    if (msgLower.includes("event") || msgLower.includes("upcoming") || msgLower.includes("show")) {
      relevantData.events = await getUpcomingEvents(6);
    }

    if (msgLower.includes("booking") || msgLower.includes("ticket") || msgLower.includes("my ")) {
      relevantData.bookings = await getUserBookings(userId, 5);
    }

    if (msgLower.includes("stat") || msgLower.includes("revenue") || msgLower.includes("dashboard")) {
      relevantData.stats =
        role === "admin" ? await getAdminStats() : await getOrganizerStats(userId);
    }

    const searchMatch = msgLower.match(/(?:search|find|look for|events? (?:about|in|at|near))\s+(.{3,})/i);
    if (searchMatch) {
      relevantData.searchResults = await searchEvents(searchMatch[1].trim(), 5);
    }
  } else {
    // Guests can still see upcoming events
    if (msgLower.includes("event") || msgLower.includes("upcoming") || msgLower.includes("show")) {
      relevantData.events = await getUpcomingEvents(5);
    }
  }

  // --- Build multi-turn history ---
  // 1. Try in-memory first (fastest)
  let conversationHistory = getContext(userId)?.history || [];
  // 2. If memory is empty (e.g. fresh page load), hydrate from DB
  if (conversationHistory.length === 0 && userId) {
    conversationHistory = await loadHistoryFromDB(userId, 8);
    // Seed in-memory so subsequent turns don't re-query
    updateContext(userId, { history: conversationHistory });
  }

  // --- Call Groq ---
  let response = await generateAIResponse(message, role, userData, conversationHistory, relevantData);

  // --- Fallback ---
  if (!response) {
    response = getFallbackResponse(role, message, relevantData);
  }

  // --- Persist & update memory ---
  if (userId) {
    await saveConversation(userId, message, response, "ai_generated", GROQ_MODEL);
    addToHistory(userId, message, response);
  }

  console.log(`🤖 [${GROQ_MODEL}] processed in ${Date.now() - t0}ms`);

  return {
    response,
    intent:        "ai_generated",
    events:        relevantData.events,
    bookings:      relevantData.bookings,
    stats:         relevantData.stats,
    searchResults: relevantData.searchResults,
    suggestions:   generateSuggestions(message, role).slice(0, 4),
    model:         GROQ_MODEL,
  };
}

// ======================
// API ENDPOINTS
// ======================

// POST /api/chatbot/chat
router.post("/chat", async (req, res) => {
  try {
    const { message, role, userId } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "Message is required" });

    // If the request carries a verified JWT, prefer token identity
    const effectiveUserId = req.user?.id ?? userId;
    const effectiveRole   = req.user?.role ?? role ?? "guest";

    const result = await processChat(message.trim(), effectiveRole, effectiveUserId);
    res.json(result);
  } catch (err) {
    console.error("Chatbot /chat error:", err);
    res.status(500).json({
      response: "I'm having trouble right now. Please try again or contact support.",
      suggestions: ["Upcoming events", "Contact support"],
    });
  }
});

// GET /api/chatbot/history  (auth required)
router.get("/history", verifyToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const history = await getUserConversationHistory(req.user.id, limit);
    res.json({ success: true, history });
  } catch (err) {
    console.error("Chatbot /history error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Helper used by /history route
async function getUserConversationHistory(userId, limit = 20) {
  try {
    const { rows } = await db.query(
      `SELECT message, response, intent, model_used, created_at
       FROM chatbot_conversations
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return rows.reverse();
  } catch (err) {
    console.error("getUserConversationHistory error:", err.message);
    return [];
  }
}

// POST /api/chatbot/clear  (auth required)
router.post("/clear", verifyToken, (req, res) => {
  clearContext(req.user.id);
  res.json({ success: true, message: "Conversation cleared" });
});

// GET /api/chatbot/models  (auth required)
router.get("/models", verifyToken, (_req, res) => {
  res.json({
    models: [
      "llama3-70b-8192",
      "llama3-8b-8192",
      "llama-3.3-70b-versatile",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
    ],
    current: GROQ_MODEL,
  });
});

// GET /api/chatbot/health
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    model: GROQ_MODEL,
    groqConfigured: !!process.env.GROQ_API_KEY,
  });
});

module.exports = router;

/*
 * ============================================================
 * DATABASE MIGRATION — run once to create the conversations table
 * ============================================================
 *
 * CREATE TABLE IF NOT EXISTS chatbot_conversations (
 *   id          SERIAL PRIMARY KEY,
 *   user_id     INTEGER REFERENCES usercredentials(id) ON DELETE CASCADE,
 *   message     TEXT NOT NULL,
 *   response    TEXT NOT NULL,
 *   intent      VARCHAR(50),
 *   model_used  VARCHAR(100),
 *   created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_chatbot_user_id ON chatbot_conversations(user_id);
 * CREATE INDEX IF NOT EXISTS idx_chatbot_created  ON chatbot_conversations(created_at DESC);
 * ============================================================
 */