const express = require("express");
const router = express.Router();
const db = require("../db");

// WebSocket instance injected from server.js
let io = null;

// Attach WebSocket instance
function attachSocket(socketInstance) {
  io = socketInstance;
  console.log("✅ Socket.IO attached to notifications");
}

/*******************************
 *  UTILITY FUNCTIONS
 *******************************/

/**
 * Send notification to a specific user
 * @param {number} userId - User ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (system, booking, payment, event, reminder)
 * @param {object} meta - Additional metadata (event_id, booking_id, etc.)
 */
async function sendNotification(userId, title, message, type = "system", meta = {}) {
  try {
    const query = `
      INSERT INTO notifications (user_id, title, message, type, meta)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at;
    `;

    const values = [userId, title, message, type, JSON.stringify(meta)];
    const result = await db.query(query, values);
    const inserted = result.rows[0];

    // Real-time push via Socket.IO
    if (io) {
      io.to(`user_${userId}`).emit("notification", {
        id: inserted.id,
        title,
        message,
        type,
        meta,
        created_at: inserted.created_at,
        is_read: false
      });
    }

    console.log(`📩 Notification sent to user ${userId}: ${title}`);
    return inserted.id;
  } catch (err) {
    console.error("Error sending notification:", err);
    throw err;
  }
}

/**
 * Broadcast notification to all users
 */
async function broadcastNotification(title, message, type = "broadcast", meta = {}) {
  try {
    const usersResult = await db.query(`SELECT id FROM usercredentials WHERE role != 'admin'`);

    const notificationIds = [];
    for (const u of usersResult.rows) {
      const id = await sendNotification(u.id, title, message, type, meta);
      notificationIds.push(id);
    }

    // Also emit broadcast event
    if (io) {
      io.emit("broadcast_notification", { 
        title, 
        message, 
        type,
        meta,
        created_at: new Date()
      });
    }

    console.log(`📢 Broadcast notification sent to ${usersResult.rows.length} users`);
    return notificationIds;
  } catch (err) {
    console.error("Error broadcasting notification:", err);
    throw err;
  }
}

/**
 * Send notification to organizer when their event gets a booking
 */
async function notifyOrganizerNewBooking(organizerId, bookingData) {
  const { event_title, customer_name, seats, total_amount, booking_reference } = bookingData;
  
  await sendNotification(
    organizerId,
    "🎉 New Booking Received!",
    `${customer_name} just booked ${seats} seat(s) for "${event_title}". Amount: KES ${total_amount}`,
    "booking",
    { 
      booking_reference,
      event_title,
      customer_name,
      amount: total_amount
    }
  );
}

/**
 * Send notification to user about booking confirmation
 */
async function notifyUserBookingConfirmed(userId, bookingData) {
  const { event_title, event_date, booking_reference } = bookingData;
  
  await sendNotification(
    userId,
    "✅ Booking Confirmed",
    `Your booking for "${event_title}" on ${event_date} has been confirmed. Ref: ${booking_reference}`,
    "booking",
    { 
      booking_reference,
      event_title,
      event_date
    }
  );
}

/**
 * Send event reminder notification
 */
async function sendEventReminder(userId, eventData) {
  const { event_title, event_date, location, booking_reference } = eventData;
  
  await sendNotification(
    userId,
    "⏰ Event Reminder",
    `Reminder: "${event_title}" is coming up on ${event_date} at ${location}`,
    "reminder",
    { 
      booking_reference,
      event_title,
      event_date,
      location
    }
  );
}

/**
 * Get unread count for a user
 */
async function getUnreadCount(userId) {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (err) {
    console.error("Error getting unread count:", err);
    return 0;
  }
}

/*******************************
 *  REST API ROUTES
 *******************************/

// Get all notifications for logged-in user
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unread_only } = req.query;

    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
    
    const params = [userId];
    
    if (unread_only === 'true') {
      query += ` AND is_read = FALSE`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    // Get unread count
    const unreadCount = await getUnreadCount(userId);

    res.json({
      notifications: result.rows,
      unread_count: unreadCount,
      total: result.rows.length
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Get unread count only
router.get("/unread-count", async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await getUnreadCount(userId);
    res.json({ unread_count: count });
  } catch (err) {
    console.error("Error fetching unread count:", err);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

// Mark single notification as read
router.put("/:id/read", async (req, res) => {
  try {
    const userId = req.user.id;
    const notifId = req.params.id;

    const result = await db.query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notifId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Emit update to user
    if (io) {
      io.to(`user_${userId}`).emit("notification_read", { id: notifId });
    }

    res.json({ success: true, notification: result.rows[0] });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// Mark all notifications as read
router.put("/read-all", async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      `UPDATE notifications 
       SET is_read = TRUE 
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    // Emit update to user
    if (io) {
      io.to(`user_${userId}`).emit("notifications_read_all");
    }

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Error marking all as read:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

// Delete single notification
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const notifId = req.params.id;

    const result = await db.query(
      `DELETE FROM notifications 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notifId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Emit deletion to user
    if (io) {
      io.to(`user_${userId}`).emit("notification_deleted", { id: notifId });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// Delete all notifications
router.delete("/", async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      `DELETE FROM notifications 
       WHERE user_id = $1`,
      [userId]
    );

    // Emit clear all to user
    if (io) {
      io.to(`user_${userId}`).emit("notifications_cleared");
    }

    res.json({ success: true, message: "All notifications cleared" });
  } catch (err) {
    console.error("Error clearing notifications:", err);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

// Admin: Send notification to specific user
router.post("/send", async (req, res) => {
  try {
    // Only admins can send custom notifications
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const { user_id, title, message, type = "system", meta = {} } = req.body;

    if (!user_id || !title || !message) {
      return res.status(400).json({ error: "user_id, title, and message are required" });
    }

    const notificationId = await sendNotification(user_id, title, message, type, meta);

    res.json({ 
      success: true, 
      message: "Notification sent successfully",
      notification_id: notificationId
    });
  } catch (err) {
    console.error("Error sending custom notification:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// Admin: Broadcast notification to all users
router.post("/broadcast", async (req, res) => {
  try {
    // Only admins can broadcast
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const { title, message, type = "broadcast", meta = {} } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "title and message are required" });
    }

    const notificationIds = await broadcastNotification(title, message, type, meta);

    res.json({ 
      success: true, 
      message: "Broadcast sent successfully",
      notification_count: notificationIds.length
    });
  } catch (err) {
    console.error("Error broadcasting notification:", err);
    res.status(500).json({ error: "Failed to broadcast notification" });
  }
});

// Admin: Get all notifications (for monitoring)
router.get("/admin/all", async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const { limit = 100, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT n.*, u.fullname, u.email 
       FROM notifications n
       JOIN usercredentials u ON n.user_id = u.id
       ORDER BY n.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching all notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

module.exports = {
  router,
  attachSocket,
  sendNotification,
  broadcastNotification,
  notifyOrganizerNewBooking,
  notifyUserBookingConfirmed,
  sendEventReminder,
  getUnreadCount
};