const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");

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

// Detect intent from user message
function detectIntent(message) {
  const lower = message.toLowerCase();
  
  for (const [intent, keywords] of Object.entries(intents)) {
    if (keywords.some(keyword => lower.includes(keyword))) {
      return intent;
    }
  }
  
  return "unknown";
}

// ======================
// RESPONSE HANDLERS
// ======================

// Guest responses
const guestResponses = {
  greeting: "👋 Hello! Welcome to our Event Booking System. I can help you:\n\n• View upcoming events\n• Learn how to register\n• Get general information\n• Contact support\n\nWhat would you like to know?",
  
  help: "I'm here to assist you! Here's what I can do:\n\n📅 Show upcoming events\n📝 Explain registration process\n💬 Answer general questions\n📧 Help you contact support\n\nJust ask me anything!",
  
  events: "upcoming_events", // Will be replaced with actual data
  
  register: "To create an account:\n\n1. Click 'Register' at the top\n2. Fill in your details (name, email, password)\n3. Verify your email\n4. Start booking events!\n\nNeed help with registration? Let me know!",
  
  login: "To log in:\n\n1. Click 'Login' at the top\n2. Enter your email and password\n3. Click 'Sign In'\n\nForgot your password? Use the 'Forgot Password' link on the login page.",
  
  contact: "You can reach us at:\n\n📧 Email: victorlabs854@gmail.com\n📞 Phone: +254 759205319\n\nOr use our Contact Form in the menu to send us a message directly!",
  
  unknown: "I'm not sure I understand. As a guest, I can help you with:\n\n• Viewing upcoming events\n• Registration information\n• Login assistance\n• Contact information\n\nWhat would you like to know?"
};

// User responses
const userResponses = {
  greeting: "👋 Hello! Welcome back! I can help you:\n\n• Browse upcoming events\n• View your bookings\n• Check payment status\n• Get ticket information\n• Contact support\n\nHow can I assist you today?",
  
  help: "I'm your personal assistant! I can help you:\n\n📅 Find events\n🎟️ View your bookings\n💳 Check payment status\n📧 Contact support\n❌ Cancel bookings\n\nWhat do you need?",
  
  events: "upcoming_events",
  
  bookings: "user_bookings",
  
  payment: "💳 Payment Methods:\n\n1. **M-Pesa STK Push** (Recommended)\n   - Select M-Pesa at checkout\n   - Enter your phone number\n   - Complete on your phone\n\n2. **Card Payment**\n   - Credit/Debit cards accepted\n\nNeed help with a specific payment? Let me know!",
  
  cancel: "To cancel a booking:\n\n1. Go to 'My Bookings'\n2. Find your booking\n3. Click 'Cancel Booking'\n\n⚠️ Note: Only pending bookings can be cancelled. Confirmed bookings require admin approval.\n\nNeed help cancelling? Provide your booking reference.",
  
  pricing: "Ticket prices vary by event. To check prices:\n\n1. Browse events on the homepage\n2. Click on an event\n3. View ticket types and prices\n\nLooking for a specific event? Tell me which one!",
  
  contact: "📧 Support Options:\n\n• Email: support@eventbooking.com\n• Phone: +254 123 456 789\n• Contact Form: Available in menu\n• Live Chat: Right here!\n\nHow can I help you right now?",
  
  unknown: "I didn't quite catch that. I can help you with:\n\n• Finding events\n• Checking your bookings\n• Payment assistance\n• Cancelling bookings\n• Contacting support\n\nWhat would you like to do?"
};

// Admin responses
const adminResponses = {
  greeting: "👨‍💼 Hello Admin! I can assist you with:\n\n• Dashboard statistics\n• Manage bookings\n• View payments\n• Validate tickets\n• User management\n• Generate reports\n\nWhat do you need?",
  
  help: "Admin Control Panel:\n\n📊 Dashboard stats\n📅 Event management\n🎟️ Booking management\n💰 Payment tracking\n✅ Ticket validation\n👥 User management\n📈 Reports & analytics\n\nWhat would you like to check?",
  
  stats: "admin_stats",
  
  bookings: "admin_bookings",
  
  payments_admin: "admin_payments",
  
  validate: "🔍 To validate a ticket:\n\n1. Go to 'Scan Tickets' in the sidebar\n2. Scan QR code OR enter manual code\n3. Confirm validation\n\nNeed to validate a specific ticket? Provide the code!",
  
  users: "admin_users",
  
  events: "To manage events:\n\n1. Go to 'Events' in sidebar\n2. View/Edit/Delete events\n3. Create new events\n4. Manage ticket types\n\nNeed help with a specific event?",
  
  contact: "📧 Admin Support:\n\n• View all contact messages in 'Support' tab\n• Check support tickets\n• Reply to user inquiries\n\nNeed to access support messages?",
  
  unknown: "I can help you with:\n\n• Dashboard statistics\n• Managing bookings & payments\n• Validating tickets\n• User management\n• Reports\n\nWhat do you need assistance with?"
};

// ======================
// DATABASE QUERY HANDLERS
// ======================

// Get upcoming events
async function getUpcomingEvents() {
  try {
    const result = await db.promise.query(`
      SELECT id, title, event_date, location, price 
      FROM events 
      WHERE status = 'upcoming' AND event_date >= CURDATE()
      ORDER BY event_date ASC 
      LIMIT 5
    `);
    
    if (result[0].length === 0) {
      return "No upcoming events at the moment. Check back soon!";
    }
    
    let message = "📅 **Upcoming Events:**\n\n";
    result[0].forEach((event, idx) => {
      const date = new Date(event.event_date).toLocaleDateString();
      message += `${idx + 1}. **${event.title}**\n`;
      message += `   📍 ${event.location || "TBA"}\n`;
      message += `   📆 ${date}\n`;
      message += `   💰 KES ${event.price}\n\n`;
    });
    
    return message + "Want details on a specific event? Just ask!";
  } catch (err) {
    console.error("Error fetching events:", err);
    return "Sorry, I couldn't fetch events right now. Please try again.";
  }
}

// Get user bookings
async function getUserBookings(userId) {
  try {
    const result = await db.promise.query(`
      SELECT b.id, b.reference, b.status, b.total_amount, e.title, e.event_date
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
      LIMIT 5
    `, [userId]);
    
    if (result[0].length === 0) {
      return "You don't have any bookings yet. Browse events to get started!";
    }
    
    let message = "🎟️ **Your Recent Bookings:**\n\n";
    result[0].forEach((booking, idx) => {
      const date = new Date(booking.event_date).toLocaleDateString();
      const statusEmoji = booking.status === "confirmed" ? "✅" : 
                         booking.status === "pending" ? "⏳" : "❌";
      
      message += `${idx + 1}. ${statusEmoji} **${booking.title}**\n`;
      message += `   📋 Ref: ${booking.reference}\n`;
      message += `   📆 ${date}\n`;
      message += `   💰 KES ${booking.total_amount}\n`;
      message += `   Status: ${booking.status}\n\n`;
    });
    
    return message + "Need details on a specific booking? Let me know!";
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return "Sorry, I couldn't fetch your bookings. Please try again.";
  }
}

// Get admin stats
async function getAdminStats() {
  try {
    const [events] = await db.promise.query("SELECT COUNT(*) as total FROM events");
    const [bookings] = await db.promise.query("SELECT COUNT(*) as total FROM bookings");
    const [payments] = await db.promise.query(
      "SELECT COUNT(*) as total, SUM(amount) as revenue FROM payments WHERE status='success'"
    );
    const [pending] = await db.promise.query(
      "SELECT COUNT(*) as total FROM bookings WHERE status='pending'"
    );
    
    return `📊 **Dashboard Statistics:**\n\n` +
           `📅 Total Events: ${events[0].total}\n` +
           `🎟️ Total Bookings: ${bookings[0].total}\n` +
           `⏳ Pending Bookings: ${pending[0].total}\n` +
           `💰 Total Revenue: KES ${payments[0].revenue || 0}\n` +
           `✅ Successful Payments: ${payments[0].total}\n\n` +
           `Need more detailed reports? Check the Reports section!`;
  } catch (err) {
    console.error("Error fetching stats:", err);
    return "Sorry, I couldn't fetch statistics. Please try again.";
  }
}

// Get recent admin bookings
async function getAdminBookings() {
  try {
    const result = await db.promise.query(`
      SELECT b.id, b.reference, b.status, u.fullname, e.title
      FROM bookings b
      JOIN usercredentials u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);
    
    if (result[0].length === 0) {
      return "No bookings found.";
    }
    
    let message = "📋 **Recent Bookings:**\n\n";
    result[0].forEach((booking, idx) => {
      const statusEmoji = booking.status === "confirmed" ? "✅" : 
                         booking.status === "pending" ? "⏳" : "❌";
      
      message += `${idx + 1}. ${statusEmoji} ${booking.reference}\n`;
      message += `   👤 ${booking.fullname}\n`;
      message += `   📅 ${booking.title}\n`;
      message += `   Status: ${booking.status}\n\n`;
    });
    
    return message;
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return "Sorry, I couldn't fetch bookings. Please try again.";
  }
}

// Get admin payments summary
async function getAdminPayments() {
  try {
    const [result] = await db.promise.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status='success' THEN amount ELSE 0 END) as revenue
      FROM payments
    `);
    
    const stats = result[0];
    
    return `💰 **Payment Summary:**\n\n` +
           `✅ Successful: ${stats.successful}\n` +
           `⏳ Pending: ${stats.pending}\n` +
           `❌ Failed: ${stats.failed}\n` +
           `💵 Total Revenue: KES ${stats.revenue || 0}\n\n` +
           `View detailed payment logs in the Payments section.`;
  } catch (err) {
    console.error("Error fetching payments:", err);
    return "Sorry, I couldn't fetch payment data. Please try again.";
  }
}

// Get admin users count
async function getAdminUsers() {
  try {
    const [result] = await db.promise.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN role='admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN role='user' THEN 1 ELSE 0 END) as users
      FROM usercredentials
    `);
    
    const stats = result[0];
    
    return `👥 **User Statistics:**\n\n` +
           `Total Users: ${stats.total}\n` +
           `👨‍💼 Admins: ${stats.admins}\n` +
           `👤 Regular Users: ${stats.users}\n\n` +
           `Manage users in the Users section.`;
  } catch (err) {
    console.error("Error fetching users:", err);
    return "Sorry, I couldn't fetch user data. Please try again.";
  }
}

// ======================
// MAIN CHAT ENDPOINT
// ======================
router.post("/chat", async (req, res) => {
  try {
    const { message, role } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    // Detect intent
    const intent = detectIntent(message);
    
    // Get appropriate response based on role
    let response;
    let responses;
    
    if (role === "admin") {
      responses = adminResponses;
    } else if (role === "user") {
      responses = userResponses;
    } else {
      responses = guestResponses;
    }
    
    // Get base response
    response = responses[intent] || responses.unknown;
    
    // Handle dynamic data requests
    if (response === "upcoming_events") {
      response = await getUpcomingEvents();
    } else if (response === "user_bookings" && req.user) {
      response = await getUserBookings(req.user.id);
    } else if (response === "admin_stats") {
      response = await getAdminStats();
    } else if (response === "admin_bookings") {
      response = await getAdminBookings();
    } else if (response === "admin_payments") {
      response = await getAdminPayments();
    } else if (response === "admin_users") {
      response = await getAdminUsers();
    }
    
    res.json({ 
      response,
      intent,
      suggestions: getSuggestions(role, intent)
    });
    
  } catch (err) {
    console.error("Chatbot error:", err);
    res.status(500).json({ error: "Sorry, I encountered an error. Please try again." });
  }
});

// Get contextual suggestions
function getSuggestions(role, intent) {
  if (role === "admin") {
    return [
      "Show dashboard stats",
      "View recent bookings",
      "Payment summary",
      "Validate ticket"
    ];
  } else if (role === "user") {
    return [
      "Show my bookings",
      "Upcoming events",
      "How to pay",
      "Contact support"
    ];
  } else {
    return [
      "Show upcoming events",
      "How to register",
      "How to login",
      "Contact information"
    ];
  }
}

module.exports = router;