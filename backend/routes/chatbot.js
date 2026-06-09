const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");
const Groq = require("groq-sdk");

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ======================
// CONVERSATION CONTEXT with Persistence
// ======================
const conversationContext = new Map();

// Store conversation history in database
async function saveConversation(userId, message, response, intent, modelUsed = null) {
  try {
    await db.query(
      `INSERT INTO chatbot_conversations (user_id, message, response, intent, model_used, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, message, response, intent, modelUsed]
    );
  } catch (err) {
    console.error("Failed to save conversation:", err);
  }
}

async function getUserConversationHistory(userId, limit = 10) {
  try {
    const result = await db.query(
      `SELECT message, response, intent, created_at 
       FROM chatbot_conversations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows.reverse();
  } catch (err) {
    console.error("Failed to fetch conversation history:", err);
    return [];
  }
}

function updateContext(userId, data) {
  const existing = conversationContext.get(userId) || {};
  conversationContext.set(userId, { 
    ...existing, 
    ...data, 
    lastActivity: Date.now(),
    history: existing.history || []
  });
}

function getContext(userId) {
  const context = conversationContext.get(userId);
  if (context && Date.now() - context.lastActivity > 1800000) {
    conversationContext.delete(userId);
    return null;
  }
  return context;
}

function addToHistory(userId, message, response) {
  const context = getContext(userId) || {};
  const history = context.history || [];
  history.push({ message, response, timestamp: Date.now() });
  if (history.length > 20) history.shift();
  updateContext(userId, { history });
}

function clearContext(userId) {
  conversationContext.delete(userId);
}

// ======================
// DATABASE QUERY FUNCTIONS
// ======================

async function getUserById(userId) {
  try {
    const result = await db.query(
      `SELECT id, fullname, email, role, phone, profile_image, created_at 
       FROM usercredentials WHERE id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function getUpcomingEvents(limit = 5, offset = 0, category = null) {
  try {
    let query = `
      SELECT e.id, e.title, e.description, e.event_date, e.start_time, e.location, 
             e.price, e.capacity, e.image, e.venue,
             c.name as category,
             COALESCE(SUM(b.seats), 0) as total_booked
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN bookings b ON b.event_id = e.id AND b.status = 'confirmed'
      WHERE e.status = 'upcoming' AND e.event_date >= CURRENT_DATE
    `;
    const params = [];
    if (category) {
      params.push(category);
      query += ` AND c.name ILIKE $${params.length}`;
    }
    query += ` GROUP BY e.id, c.name ORDER BY e.event_date ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.query(query, params);
    return result.rows;
  } catch (err) {
    console.error("getUpcomingEvents error:", err);
    return [];
  }
}

async function getUserBookings(userId, limit = 10) {
  try {
    const result = await db.query(`
      SELECT b.id, b.reference, b.status, b.total_amount, b.seats, b.booking_date,
             e.id as event_id, e.title, e.event_date, e.location, e.start_time,
             p.status as payment_status, p.mpesa_receipt
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      LIMIT $2
    `, [userId, limit]);
    return result.rows;
  } catch (err) {
    console.error("getUserBookings error:", err);
    return [];
  }
}

async function getOrganizerStats(userId) {
  try {
    const events = await db.query("SELECT COUNT(*) FROM events WHERE created_by = $1", [userId]);
    const bookings = await db.query(`
      SELECT COUNT(*) as total, COALESCE(SUM(b.total_amount), 0) as revenue 
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE e.created_by = $1 AND b.status = 'confirmed'
    `, [userId]);
    const recentBookings = await db.query(`
      SELECT COUNT(*) as today_count
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE e.created_by = $1 AND DATE(b.created_at) = CURRENT_DATE
    `, [userId]);
    return {
      totalEvents: parseInt(events.rows[0].count, 10),
      totalBookings: parseInt(bookings.rows[0].total, 10) || 0,
      totalRevenue: parseFloat(bookings.rows[0].revenue) || 0,
      todayBookings: parseInt(recentBookings.rows[0].today_count, 10) || 0,
    };
  } catch (err) {
    console.error("getOrganizerStats error:", err);
    return null;
  }
}

async function getAdminStats() {
  try {
    const events = await db.query("SELECT COUNT(*) FROM events");
    const bookings = await db.query("SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'");
    const payments = await db.query(`
      SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as revenue 
      FROM payments WHERE status = 'success'
    `);
    const users = await db.query(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
             SUM(CASE WHEN role = 'organizer' THEN 1 ELSE 0 END) as organizers,
             SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as regular_users
      FROM usercredentials
    `);
    return {
      totalEvents: parseInt(events.rows[0].count, 10),
      totalBookings: parseInt(bookings.rows[0].count, 10),
      totalRevenue: parseFloat(payments.rows[0].revenue) || 0,
      totalUsers: parseInt(users.rows[0].total, 10),
    };
  } catch (err) {
    console.error("getAdminStats error:", err);
    return null;
  }
}

async function searchEvents(keyword) {
  try {
    const result = await db.query(`
      SELECT e.id, e.title, e.event_date, e.location, e.price
      FROM events e
      WHERE e.status = 'upcoming' 
        AND e.event_date >= CURRENT_DATE
        AND (e.title ILIKE $1 OR e.description ILIKE $1 OR e.location ILIKE $1)
      ORDER BY e.event_date ASC
      LIMIT 5
    `, [`%${keyword}%`]);
    return result.rows;
  } catch (err) {
    console.error("searchEvents error:", err);
    return [];
  }
}

// ======================
// GROQ AI RESPONSE GENERATION
// ======================

async function generateAIReponse(message, role, userData, context, relevantData) {
  const systemPrompt = `You are an AI assistant for EventHyper, an event booking platform. 
Your role is to help users with events, bookings, payments, and support.

USER ROLE: ${role.toUpperCase()}
${userData ? `USER NAME: ${userData.fullname}` : ''}

CAPABILITIES:
- Answer questions about events, bookings, payments, cancellations
- Help users find upcoming events
- Guide through booking process
- Explain M-Pesa payment process
- Provide event details and recommendations
- Assist organizers with event management

AVAILABLE DATA:
${relevantData.events?.length ? `- ${relevantData.events.length} upcoming events found` : ''}
${relevantData.bookings?.length ? `- ${relevantData.bookings.length} user bookings found` : ''}
${relevantData.stats ? `- Platform statistics available` : ''}

RESPONSE GUIDELINES:
1. Be friendly, professional, and helpful
2. Use emojis appropriately for engagement
3. Keep responses concise but informative
4. If user asks about specific data you don't have, suggest checking the dashboard
5. For complex requests, guide users to the appropriate page
6. Never share sensitive information like passwords or payment details
7. If unsure, offer to connect with human support

Current conversation context: ${context?.lastIntent || 'New conversation'}

Respond naturally as a helpful event assistant.`;

  const userPrompt = `User message: "${message}"

${relevantData.events?.length ? `\nRelevant events data:\n${JSON.stringify(relevantData.events.slice(0, 3), null, 2)}` : ''}
${relevantData.bookings?.length ? `\nUser's bookings:\n${JSON.stringify(relevantData.bookings.slice(0, 3), null, 2)}` : ''}
${relevantData.stats ? `\nPlatform stats: ${JSON.stringify(relevantData.stats)}` : ''}

Provide a helpful response based on the user's role (${role}) and available data.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: process.env.GROQ_MODEL || "llama3-70b-8192",
      temperature: 0.7,
      max_tokens: 500,
      top_p: 0.9,
    });

    return completion.choices[0]?.message?.content || "I'm here to help! What would you like to know about events or bookings?";
  } catch (error) {
    console.error("Groq API error:", error);
    return null;
  }
}

// Fallback responses when AI is unavailable
function getFallbackResponse(role, intent, relevantData) {
  if (relevantData.events?.length) {
    return `I found ${relevantData.events.length} upcoming events! Check them out in the Events section. Want me to help you find specific events?`;
  }
  if (relevantData.bookings?.length) {
    return `You have ${relevantData.bookings.length} booking(s). You can view all details in "My Bookings". Need help with a specific booking?`;
  }
  if (intent === 'greeting') {
    return role === 'admin' ? "Hello Admin! How can I help you manage the platform today?" :
           role === 'organizer' ? "Welcome back! Ready to check your event stats?" :
           "Hi there! How can I help you with events today?";
  }
  if (intent === 'help') {
    return "I can help you with:\n• Finding events\n• Checking bookings\n• Payment information\n• Event management\nWhat would you like to know?";
  }
  return "How can I help you with events or bookings today?";
}

// ======================
// MAIN CHAT PROCESSOR with Groq
// ======================

async function processChat(message, role, userId) {
  const startTime = Date.now();
  
  try {
    // Get user data if authenticated
    let userData = null;
    let relevantData = {
      events: [],
      bookings: [],
      stats: null
    };
    
    if (userId && role !== 'guest') {
      userData = await getUserById(userId);
      
      // Fetch relevant data based on message keywords
      const msgLower = message.toLowerCase();
      
      if (msgLower.includes('event') || msgLower.includes('upcoming')) {
        relevantData.events = await getUpcomingEvents(5);
      }
      
      if (msgLower.includes('booking') || msgLower.includes('ticket') || msgLower.includes('my')) {
        relevantData.bookings = await getUserBookings(userId, 5);
      }
      
      if (msgLower.includes('stats') || msgLower.includes('revenue') || msgLower.includes('dashboard')) {
        if (role === 'admin') {
          relevantData.stats = await getAdminStats();
        } else if (role === 'organizer') {
          relevantData.stats = await getOrganizerStats(userId);
        }
      }
      
      if (msgLower.includes('search') || msgLower.includes('find')) {
        const searchTerm = message.replace(/search|find|look for/gi, '').trim();
        if (searchTerm.length > 2) {
          relevantData.events = await searchEvents(searchTerm);
        }
      }
    }
    
    // Try to get AI response first
    let aiResponse = await generateAIReponse(message, role, userData, getContext(userId), relevantData);
    
    // Fallback to template if AI fails
    if (!aiResponse) {
      aiResponse = getFallbackResponse(role, detectSimpleIntent(message), relevantData);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`🤖 Chat processed in ${processingTime}ms using Groq AI`);
    
    // Save conversation to database
    if (userId) {
      await saveConversation(userId, message, aiResponse, 'ai_generated', process.env.GROQ_MODEL);
      addToHistory(userId, message, aiResponse);
    }
    
    // Generate suggestions
    const suggestions = generateSuggestions(message, role);
    
    return {
      response: aiResponse,
      intent: 'ai_generated',
      events: relevantData.events,
      bookings: relevantData.bookings,
      stats: relevantData.stats,
      user: userData,
      suggestions,
      processingTime,
      model: process.env.GROQ_MODEL
    };
    
  } catch (error) {
    console.error("Chat processing error:", error);
    return {
      response: "I'm having trouble processing your request right now. Please try again or contact support if the issue persists.",
      intent: 'error',
      suggestions: ["Show upcoming events", "My bookings", "Contact support"],
      error: error.message
    };
  }
}

function detectSimpleIntent(message) {
  const msg = message.toLowerCase();
  if (msg.includes('hello') || msg.includes('hi')) return 'greeting';
  if (msg.includes('help')) return 'help';
  if (msg.includes('event')) return 'events';
  if (msg.includes('booking')) return 'bookings';
  return 'general';
}

function generateSuggestions(message, role) {
  const suggestions = {
    admin: ["Dashboard stats", "Recent bookings", "View payments", "User management"],
    organizer: ["My events", "Event stats", "Recent bookings", "Create event"],
    user: ["My bookings", "Find events", "Payment help", "Upcoming events"],
    guest: ["Show events", "How to register", "Contact us"]
  };
  
  return suggestions[role] || suggestions.guest;
}

// ======================
// API ENDPOINTS
// ======================

// Main chat endpoint
router.post("/chat", async (req, res) => {
  try {
    const { message, role, userId } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    // Determine role from token if available
    let effectiveRole = role;
    let effectiveUserId = userId;
    
    if (req.user) {
      effectiveUserId = req.user.id;
      effectiveRole = req.user.role;
    }
    
    const result = await processChat(
      message.trim(),
      effectiveRole || "guest",
      effectiveUserId
    );
    
    res.json(result);
    
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ 
      error: "Sorry, I encountered an error. Please try again.",
      response: "I'm having trouble processing that request. Please try again or contact support."
    });
  }
});

// Get conversation history
router.get("/history", verifyToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const history = await getUserConversationHistory(req.user.id, parseInt(limit));
    res.json({ success: true, history });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Clear conversation context
router.post("/clear", verifyToken, async (req, res) => {
  clearContext(req.user.id);
  res.json({ success: true, message: "Conversation context cleared" });
});

// Get available models
router.get("/models", verifyToken, async (req, res) => {
  res.json({
    models: [
      "llama3-70b-8192",
      "llama3-8b-8192",
      "mixtral-8x7b-32768",
      "gemma2-9b-it"
    ],
    current: process.env.GROQ_MODEL || "llama3-70b-8192"
  });
});

module.exports = router;