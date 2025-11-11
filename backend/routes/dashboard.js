const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");

// GET dashboard overview
router.get("/", verifyToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const userId = req.user.id;

    // Total events
    const [events] = await db.promise.query(
      isAdmin 
        ? "SELECT COUNT(*) AS total FROM events" 
        : "SELECT COUNT(*) AS total FROM events WHERE created_by = ?",
      isAdmin ? [] : [userId]
    );
    const totalEvents = events[0].total;

    // Total bookings
    const [bookings] = await db.promise.query(
      isAdmin 
        ? "SELECT COUNT(*) AS total FROM bookings" 
        : "SELECT COUNT(*) AS total FROM bookings WHERE user_id = ?",
      isAdmin ? [] : [userId]
    );
    const totalBookings = bookings[0].total;

    // Total revenue (sum of completed payments)
    const [payments] = await db.promise.query(
      isAdmin
        ? "SELECT IFNULL(SUM(amount),0) AS total FROM payments WHERE status='completed'"
        : "SELECT IFNULL(SUM(amount),0) AS total FROM payments WHERE status='completed' AND user_id = ?",
      isAdmin ? [] : [userId]
    );
    const totalRevenue = parseFloat(payments[0].total);

    // Recent events: last 5 events
    const [recentEvents] = await db.promise.query(
      isAdmin
        ? "SELECT id, title, created_at FROM events ORDER BY created_at DESC LIMIT 5"
        : "SELECT id, title, created_at FROM events WHERE created_by = ? ORDER BY created_at DESC LIMIT 5",
      isAdmin ? [] : [userId]
    );

    // Recent bookings: last 5 confirmed
    const [recentBookings] = await db.promise.query(
      isAdmin
        ? "SELECT id, event_id, booking_date FROM bookings WHERE status='confirmed' ORDER BY booking_date DESC LIMIT 5"
        : "SELECT id, event_id, booking_date FROM bookings WHERE status='confirmed' AND user_id = ? ORDER BY booking_date DESC LIMIT 5",
      isAdmin ? [] : [userId]
    );

    // Upcoming events: next 5 upcoming
    const [upcomingEvents] = await db.promise.query(
      isAdmin
        ? `SELECT id, title, event_date, start_time
           FROM events
           WHERE event_date >= CURDATE() AND status='upcoming'
           ORDER BY event_date ASC, start_time ASC
           LIMIT 5`
        : `SELECT id, title, event_date, start_time
           FROM events
           WHERE event_date >= CURDATE() AND status='upcoming' AND created_by = ?
           ORDER BY event_date ASC, start_time ASC
           LIMIT 5`,
      isAdmin ? [] : [userId]
    );

    // Recent revenue transactions: last 5 completed payments
    const [recentPayments] = await db.promise.query(
      isAdmin
        ? `SELECT id, booking_id, amount, method, paid_at 
           FROM payments 
           WHERE status='completed'
           ORDER BY paid_at DESC
           LIMIT 5`
        : `SELECT id, booking_id, amount, method, paid_at 
           FROM payments 
           WHERE status='completed' AND user_id = ?
           ORDER BY paid_at DESC
           LIMIT 5`,
      isAdmin ? [] : [userId]
    );

    res.json({
      totals: { totalEvents, totalBookings, totalRevenue },
      recentActivity: {
        events: recentEvents,
        bookings: recentBookings,
      },
      upcomingEvents,
      recentPayments,
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;
