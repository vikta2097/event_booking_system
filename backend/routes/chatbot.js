const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");

// ======================
// CONVERSATION CONTEXT
// ======================
const conversationContext = new Map();

function updateContext(userId, data) {
  const existing = conversationContext.get(userId) || {};
  conversationContext.set(userId, { 
    ...existing, 
    ...data, 
    timestamp: Date.now() 
  });
}

function getContext(userId) {
  const context = conversationContext.get(userId);
  // Clear context after 10 minutes of inactivity
  if (context && Date.now() - context.timestamp > 600000) {
    conversationContext.delete(userId);
    return null;
  }
  return context;
}

function clearContext(userId) {
  conversationContext.delete(userId);
}

// ======================
// ENHANCED INTENT RECOGNITION
// ======================
const intents = {
  greeting: ["hello", "hi", "hey", "good morning", "good afternoon", "greetings"],
  help: ["help", "assist", "support", "what can you do", "how to use"],
  
  // Events
  events: ["events", "show events", "upcoming events", "list events", "what events"],
  event_search: ["find event", "search event", "event about", "events in", "events on", "look for event"],
  event_details: ["event details", "more info", "tell me about", "information about", "details of"],
  event_categories: ["categories", "types of events", "what categories", "event types"],
  my_events: ["my events", "events i created", "events i organized", "my organized events"],
  
  // Bookings
  bookings: ["my bookings", "show bookings", "booking history", "tickets", "my tickets"],
  book_ticket: ["book", "reserve", "buy ticket", "purchase", "get ticket", "i want to book"],
  booking_status: ["booking status", "check booking", "track booking", "where is my booking"],
  modify_booking: ["change booking", "modify", "update booking", "edit booking"],
  cancel: ["cancel booking", "refund", "cancel ticket", "remove booking"],
  
  // Organizer specific
  organizer_stats: ["my stats", "my performance", "my revenue", "my bookings count", "how am i doing", "dashboard"],
  organizer_bookings: ["bookings for my events", "who booked", "attendees", "customers", "event bookings"],
  event_performance: ["event performance", "which event is doing well", "best event", "top event", "popular event"],
  recent_sales: ["recent sales", "latest bookings", "new bookings", "today's bookings", "recent activity"],
  validate_ticket: ["validate", "check ticket", "scan ticket", "verify ticket", "ticket validation"],
  create_event_help: ["create event", "new event", "add event", "how to create event"],
  
  // Payments
  payment: ["payment", "pay", "mpesa", "how to pay", "payment method"],
  payment_status: ["payment status", "did payment go through", "check payment", "payment complete"],
  payment_methods: ["payment options", "accepted payments", "ways to pay"],
  
  // Tickets
  download_ticket: ["download ticket", "get ticket", "where is my ticket", "ticket download"],
  resend_ticket: ["resend ticket", "send ticket again", "email ticket"],
  validate: ["validate ticket", "check ticket", "scan ticket", "verify ticket"],
  
  // Account
  profile: ["my profile", "account details", "update profile", "my account"],
  register: ["register", "sign up", "create account", "join"],
  login: ["login", "sign in", "log in"],
  
  // Admin
  stats: ["stats", "statistics", "dashboard", "revenue", "summary"],
  users: ["users", "show users", "user list", "manage users"],
  payments_admin: ["pending payments", "payment status", "all payments"],
  create_event: ["create event", "add event", "new event"],
  manage_bookings: ["manage bookings", "booking management", "all bookings"],
  reports: ["reports", "analytics", "insights"],
  
  // General
  contact: ["contact", "support", "help desk", "reach you"],
  pricing: ["price", "cost", "how much", "ticket price"],
  thanks: ["thank you", "thanks", "appreciate"],
  cancel_action: ["cancel", "never mind", "stop", "go back"],
};

function detectIntent(message) {
  const lower = message.toLowerCase();
  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(keyword => lower.includes(keyword))) return intent;
  }
  return "unknown";
}

// ======================
// ENTITY EXTRACTION
// ======================
function extractEntities(message) {
  const entities = {};
  
  // Extract dates
  const dateMatch = message.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|today|tomorrow|this weekend)\b/i);
  if (dateMatch) entities.date = dateMatch[0];
  
  // Extract numbers
  const numberMatch = message.match(/\b(\d+)\b/);
  if (numberMatch) entities.number = parseInt(numberMatch[0]);
  
  // Extract price ranges
  const priceMatch = message.match(/under\s+(\d+)|below\s+(\d+)|less than\s+(\d+)/i);
  if (priceMatch) entities.maxPrice = parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3]);
  
  // Extract booking references (8+ alphanumeric)
  const refMatch = message.match(/\b([A-Z0-9]{8,})\b/);
  if (refMatch) entities.reference = refMatch[0];
  
  // Extract location
  const locationMatch = message.match(/in\s+([a-z\s]+)/i);
  if (locationMatch) entities.location = locationMatch[1].trim();
  
  return entities;
}

// ======================
// DATABASE HANDLERS
// ======================

// Upcoming events
async function getUpcomingEvents(limit = 5) {
  try {
    const result = await db.query(`
      SELECT e.id, e.title, e.event_date, e.location, e.price, e.capacity,
             c.name as category
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      WHERE e.status='upcoming' AND e.event_date >= NOW()
      ORDER BY e.event_date ASC
      LIMIT $1
    `, [limit]);
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Organizer's events
async function getOrganizerEvents(userId) {
  try {
    const result = await db.query(`
      SELECT e.id, e.title, e.event_date, e.location, e.price, e.capacity, e.status,
             c.name as category,
             COUNT(DISTINCT b.id) as total_bookings,
             COALESCE(SUM(b.seats), 0) as total_seats_booked
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN bookings b ON b.event_id = e.id AND b.status != 'cancelled'
      WHERE e.created_by = $1
      GROUP BY e.id, c.name
      ORDER BY e.event_date DESC
      LIMIT 10
    `, [userId]);
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Search events
async function searchEvents(criteria) {
  try {
    const { keyword, category, location, date, maxPrice } = criteria;
    let query = `
      SELECT e.id, e.title, e.event_date, e.location, e.price, 
             c.name as category
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      WHERE e.status='upcoming' AND e.event_date >= NOW()
    `;
    const params = [];
    
    if (keyword) {
      params.push(`%${keyword}%`);
      query += ` AND (e.title ILIKE $${params.length} OR e.description ILIKE $${params.length})`;
    }
    
    if (location) {
      params.push(`%${location}%`);
      query += ` AND e.location ILIKE $${params.length}`;
    }
    
    if (maxPrice) {
      params.push(maxPrice);
      query += ` AND e.price <= $${params.length}`;
    }
    
    query += ` ORDER BY e.event_date ASC LIMIT 10`;
    
    const result = await db.query(query, params);
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Event details with ticket types
async function getEventDetails(eventId) {
  try {
    const event = await db.query(`
      SELECT e.*, c.name as category_name 
      FROM events e 
      LEFT JOIN event_categories c ON e.category_id = c.id 
      WHERE e.id = $1
    `, [eventId]);
    
    const tickets = await db.query(`
      SELECT * FROM ticket_types WHERE event_id = $1
    `, [eventId]);
    
    return { 
      event: event.rows[0], 
      tickets: tickets.rows 
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

// User bookings
async function getUserBookings(userId) {
  try {
    const result = await db.query(`
      SELECT b.id, b.reference, b.status, b.total_amount, b.seats,
             e.title, e.event_date, e.location,
             p.status as payment_status
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
      LIMIT 10
    `, [userId]);
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Organizer's event bookings
async function getOrganizerBookings(userId) {
  try {
    const result = await db.query(`
      SELECT b.id, b.reference, b.status as booking_status, b.total_amount, b.seats,
             b.created_at as booking_date,
             e.title as event_title, e.event_date, e.location,
             u.fullname as customer_name, u.email as customer_email,
             p.status as payment_status
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      JOIN usercredentials u ON b.user_id = u.id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE e.created_by = $1
      ORDER BY b.created_at DESC
      LIMIT 10
    `, [userId]);
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Check booking status
async function getBookingStatus(reference) {
  try {
    const result = await db.query(`
      SELECT b.*, e.title, e.event_date, e.location,
             p.status as payment_status, p.mpesa_receipt
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE b.reference = $1
    `, [reference]);
    return result.rows[0];
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Get upcoming reminders
async function getUpcomingReminders(userId) {
  try {
    const result = await db.query(`
      SELECT b.*, e.title, e.event_date, e.start_time, e.location
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE b.user_id = $1 
      AND e.event_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      AND b.status = 'confirmed'
      ORDER BY e.event_date ASC
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
    const payments = await db.query(`
      SELECT COUNT(*) as total, SUM(amount) as revenue 
      FROM payments WHERE status='success'
    `);
    const users = await db.query(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END) as admins, 
             SUM(CASE WHEN role='user' THEN 1 ELSE 0 END) as regular 
      FROM usercredentials
    `);

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

// Organizer stats
async function getOrganizerStats(userId) {
  try {
    const events = await db.query(
      "SELECT COUNT(*) FROM events WHERE created_by = $1", 
      [userId]
    );
    
    const bookings = await db.query(`
      SELECT COUNT(*) as total, SUM(b.total_amount) as revenue 
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE e.created_by = $1 AND b.status = 'confirmed'
    `, [userId]);
    
    const recentBookings = await db.query(`
      SELECT COUNT(*) as today_count
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE e.created_by = $1 
      AND DATE(b.created_at) = CURRENT_DATE
    `, [userId]);

    return {
      totalEvents: parseInt(events.rows[0].count, 10),
      totalBookings: parseInt(bookings.rows[0].total, 10) || 0,
      totalRevenue: parseFloat(bookings.rows[0].revenue) || 0,
      todayBookings: parseInt(recentBookings.rows[0].today_count, 10) || 0,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Event performance for organizer
async function getEventPerformance(userId) {
  try {
    const result = await db.query(`
      SELECT e.id, e.title, e.event_date,
             COUNT(b.id) as bookings_count,
             COALESCE(SUM(b.total_amount), 0) as revenue
      FROM events e
      LEFT JOIN bookings b ON b.event_id = e.id AND b.status = 'confirmed'
      WHERE e.created_by = $1
      GROUP BY e.id
      ORDER BY revenue DESC
      LIMIT 5
    `, [userId]);
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Event categories
async function getEventCategories() {
  try {
    const result = await db.query("SELECT * FROM event_categories ORDER BY name");
    return result.rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

// ======================
// RESPONSE TEMPLATES
// ======================
const responseTemplates = {
  booking_success: (details) => 
    `✅ Booking confirmed!\n\nReference: ${details.reference}\nEvent: ${details.title}\nTickets: ${details.seats}\nTotal: KES ${details.total_amount}\n\nCheck your email for tickets!`,
  
  booking_status: (booking) => 
    `📋 Booking Details:\n\nReference: ${booking.reference}\nEvent: ${booking.title}\nDate: ${booking.event_date}\nStatus: ${booking.status}\nPayment: ${booking.payment_status || 'pending'}\n\n${booking.payment_status === 'success' ? 'Your tickets have been sent to your email.' : 'Complete payment to receive tickets.'}`,
  
  event_details: (event) =>
    `🎉 ${event.title}\n\n📅 Date: ${event.event_date}\n📍 Location: ${event.location}\n💰 Price: KES ${event.price}\n👥 Capacity: ${event.capacity}\n\n${event.description || ''}`,
};

// ======================
// ROLE-BASED RESPONSES
// ======================
const guestResponses = {
  greeting: "Hello! 👋 I can help you explore events, learn about registration, or answer questions. What would you like to know?",
  help: "I can assist with:\n• Viewing upcoming events\n• Registration information\n• Login assistance\n• Contact information",
  events: "upcoming_events",
  event_search: "search_events",
  event_categories: "show_categories",
  register: "To register:\n1. Click 'Register' button\n2. Fill in your details\n3. Verify your email\n4. Start booking events!\n\nNeed help with registration?",
  login: "To log in:\n1. Click 'Login' button\n2. Enter your email and password\n3. Click 'Sign In'\n\nForgot your password? Use the 'Forgot Password' link.",
  contact: "📧 Contact us:\n• Email: victorlabs854@gmail.com\n• Use our contact form\n• We respond within 24 hours",
  pricing: "Event prices vary by type and organizer. View specific event details to see pricing and available ticket types.",
  thanks: "You're welcome! Let me know if you need anything else. 😊",
  unknown: "I'm not sure I understand. You can ask me about:\n• Upcoming events\n• How to register\n• How to login\n• Contact information"
};

const userResponses = {
  greeting: "Welcome back! 👋 I can help with your bookings, payments, finding events, and more.",
  help: "I can assist with:\n• Your bookings and tickets\n• Finding and booking events\n• Payment instructions\n• Cancellations and refunds\n• Upcoming event reminders",
  events: "upcoming_events",
  event_search: "search_events",
  event_categories: "show_categories",
  bookings: "user_bookings",
  booking_status: "check_booking_status",
  book_ticket: "What event would you like to book? You can browse events or tell me the event name/ID.",
  payment: "💳 Payment Methods:\n\n1. M-Pesa:\n   • Select M-Pesa at checkout\n   • Enter your phone number\n   • Approve the STK push\n\n2. Card Payment:\n   • Enter card details at checkout\n   • Follow the prompts\n\nNeed help with a specific payment?",
  payment_status: "check_payment_status",
  cancel: "To cancel a booking:\n1. Go to 'My Bookings'\n2. Select the booking\n3. Click 'Cancel Booking'\n\nNote: Refunds depend on the cancellation policy.",
  download_ticket: "Your tickets are sent to your email after payment. You can also download them from 'My Bookings'. Need me to resend them?",
  contact: "📧 Need support? Contact us via:\n• Email: victorlabs854@gmail.com\n• Contact form\n• This chat!",
  thanks: "Happy to help! Enjoy your event! 🎉",
  unknown: "I can help with:\n• Your bookings and tickets\n• Finding events\n• Payments\n• Cancellations\n• General support"
};

const organizerResponses = {
  greeting: "Hello Organizer! 👋 I can help you manage your events, track bookings, view performance stats, and more.",
  
  help: "I can assist with:\n• Your events and performance\n• Managing bookings for your events\n• Revenue and statistics\n• Ticket validation\n• Creating new events\n• Recent sales activity",
  
  events: "upcoming_events",
  event_search: "search_events",
  event_categories: "show_categories",
  my_events: "organizer_events",
  create_event_help: "To create a new event:\n1. Go to 'My Events' section\n2. Click 'Create Event' button\n3. Fill in event details (title, date, location, etc.)\n4. Set ticket types and pricing\n5. Add event image and description\n6. Publish your event\n\nNeed help with any specific step?",
  
  organizer_stats: "organizer_stats",
  event_performance: "event_performance",
  recent_sales: "recent_bookings_organizer",
  
  bookings: "user_bookings",
  organizer_bookings: "organizer_bookings",
  booking_status: "check_booking_status",
  
  validate_ticket: "🎫 Ticket Validation:\n\n1. Use the 'Scan Tickets' feature\n2. Scan QR code or enter manual code\n3. System verifies ticket authenticity\n4. Confirm entry\n\nYou can validate tickets for your events only. Need to validate now?",
  
  validate: "To validate a ticket:\n• Go to 'Scan Tickets' section\n• Use camera to scan QR code\n• Or manually enter ticket code\n• Instant verification\n\nProvide a booking reference or ticket code to validate!",
  
  payment: "💳 Payment Information:\n\nYour attendees can pay via:\n1. M-Pesa\n2. Card Payment\n\nAll payments are processed securely. You'll receive payouts according to the payment schedule.",
  
  payment_status: "check_payment_status",
  
  reports: "📊 View detailed reports:\n• Revenue analytics\n• Booking trends\n• Event performance\n• Customer insights\n\nGo to 'Reports' section for comprehensive analytics!",
  
  contact: "📧 Need organizer support?\n• Email: victorlabs854@gmail.com\n• Use support form\n• Check organizer documentation\n\nHow can I help you today?",
  
  pricing: "Your event pricing is set when creating events. You can offer multiple ticket types with different prices. Check 'My Events' to manage pricing.",
  
  thanks: "You're welcome! Keep creating amazing events! 🎉",
  
  unknown: "I can help with:\n• Your events and statistics\n• Managing event bookings\n• Ticket validation\n• Revenue and performance\n• Creating new events\n\nWhat would you like to know?"
};

const adminResponses = {
  greeting: "Hello Admin! 👨‍💼 I can show stats, manage bookings, track payments, and more.",
  help: "Admin tools:\n• Dashboard statistics\n• Booking management\n• Payment tracking\n• User management\n• Ticket validation\n• Reports and analytics",
  stats: "admin_stats",
  bookings: "admin_bookings",
  manage_bookings: "admin_bookings",
  payments_admin: "admin_payments",
  validate: "🎫 Ticket Validation:\n1. Scan QR code from ticket\n2. Or enter booking reference\n3. System verifies authenticity\n4. Confirm entry\n\nNeed to validate a specific ticket?",
  users: "show_users",
  create_event: "To create an event, use the 'Create Event' page in the admin dashboard. I can guide you through the process if needed!",
  reports: "What type of report do you need?\n• Revenue reports\n• Booking analytics\n• User statistics\n• Event performance",
  thanks: "You're welcome! Let me know if you need anything else.",
  unknown: "I can help with:\n• Statistics and analytics\n• Managing bookings\n• Payment tracking\n• User management\n• Ticket validation"
};

// ======================
// MAIN CHAT LOGIC
// ======================
async function processChat(message, role, userId) {
  const intent = detectIntent(message);
  const entities = extractEntities(message);
  const context = getContext(userId) || {};
  
  let responses = 
    role === "admin" ? adminResponses : 
    role === "organizer" ? organizerResponses :
    role === "user" ? userResponses : 
    guestResponses;
    
  let responseText = responses[intent] || responses.unknown;
  
  let events = [];
  let bookings = [];
  let stats = null;
  let categories = [];
  let reminders = [];
  let performance = [];
  
  // Handle special response types
  if (responseText === "upcoming_events") {
    events = await getUpcomingEvents();
    responseText = events.length 
      ? "Here are the upcoming events:" 
      : "No upcoming events at the moment. Check back soon!";
  }
  
  if (responseText === "organizer_events" && userId) {
    events = await getOrganizerEvents(userId);
    responseText = events.length
      ? "Here are your events:"
      : "You haven't created any events yet. Click 'Create Event' to get started!";
  }
  
  if (responseText === "search_events") {
    const searchCriteria = {
      keyword: message.replace(/find|search|event|about|in|on/gi, '').trim(),
      location: entities.location,
      maxPrice: entities.maxPrice
    };
    events = await searchEvents(searchCriteria);
    responseText = events.length
      ? `Found ${events.length} event(s) matching your search:`
      : "No events found matching your criteria. Try different keywords!";
  }
  
  if (responseText === "show_categories") {
    categories = await getEventCategories();
    responseText = categories.length
      ? "Browse events by category:"
      : "Categories will be available soon!";
  }
  
  if (responseText === "user_bookings" && userId) {
    bookings = await getUserBookings(userId);
    responseText = bookings.length 
      ? "Here are your recent bookings:" 
      : "You haven't made any bookings yet. Explore events to get started!";
  }
  
  if (responseText === "organizer_bookings" && userId) {
    bookings = await getOrganizerBookings(userId);
    responseText = bookings.length
      ? "Here are bookings for your events:"
      : "No bookings yet for your events. Share your events to get more attendees!";
  }
  
  if (responseText === "check_booking_status") {
    if (entities.reference) {
      const booking = await getBookingStatus(entities.reference);
      responseText = booking 
        ? responseTemplates.booking_status(booking)
        : "Booking not found. Please check the reference and try again.";
    } else {
      responseText = "Please provide your booking reference number (e.g., BK12345678).";
    }
  }
  
  if (responseText === "admin_stats" && role === "admin") {
    stats = await getAdminStats();
    responseText = stats 
      ? "Here's your dashboard summary:" 
      : "Unable to load statistics at the moment.";
  }
  
  if (responseText === "organizer_stats" && userId) {
    stats = await getOrganizerStats(userId);
    responseText = stats 
      ? "Here's your performance summary:" 
      : "Unable to load statistics at the moment.";
  }
  
  if (responseText === "event_performance" && userId) {
    performance = await getEventPerformance(userId);
    responseText = performance.length
      ? "Here's how your events are performing:"
      : "No performance data available yet.";
  }
  
  if (responseText === "recent_bookings_organizer" && userId) {
    bookings = await getOrganizerBookings(userId);
    const recentBookings = bookings.slice(0, 5);
    responseText = recentBookings.length
      ? "Here are your recent bookings:"
      : "No recent bookings for your events.";
    bookings = recentBookings;
  }
  
  // Check for upcoming reminders
  if (userId && role === "user" && intent === "bookings") {
    reminders = await getUpcomingReminders(userId);
  }
  
  // Generate contextual suggestions
  let suggestions = generateSuggestions(intent, role, context);
  
  return {
    response: responseText,
    intent,
    events,
    bookings,
    stats,
    categories,
    reminders,
    performance,
    suggestions
  };
}

function generateSuggestions(intent, role, context) {
  const baseSuggestions = {
    guest: ["Show events", "How to register", "Contact support"],
    user: ["My bookings", "Find events", "How to pay"],
    organizer: ["My events", "My stats", "Bookings for my events", "Event performance"],
    admin: ["Dashboard stats", "Manage bookings", "View users"]
  };
  
  const contextualSuggestions = {
    bookings: ["Cancel booking", "Upcoming events", "Payment help"],
    events: ["Book event", "Event details", "Show my bookings"],
    event_search: ["Show all events", "Filter by category", "Filter by price"],
    stats: ["Recent bookings", "Payment summary", "User analytics"],
    payment: ["Check payment status", "Payment methods", "My bookings"],
    my_events: ["Create event", "Event performance", "Bookings for my events"],
    organizer_bookings: ["My stats", "Event performance", "Validate ticket"],
    organizer_stats: ["My events", "Recent sales", "Event performance"],
  };
  
  return contextualSuggestions[intent] || baseSuggestions[role] || baseSuggestions.guest;
}

// ======================
// MAIN ENDPOINT
// ======================
router.post("/chat", async (req, res) => {
  try {
    const { message, role, userId } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message required" });
    }
    
    const result = await processChat(message, role || "guest", userId);
    
    res.json(result);
    
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ 
      error: "Sorry, I encountered an error. Please try again.",
      response: "I'm having trouble processing that request. Please try again or contact support."
    });
  }
});

// Clear context endpoint
router.post("/clear", (req, res) => {
  const { userId } = req.body;
  if (userId) {
    clearContext(userId);
    res.json({ success: true, message: "Context cleared" });
  } else {
    res.status(400).json({ error: "User ID required" });
  }
});

module.exports = router;