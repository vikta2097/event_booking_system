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
    let eventsQuery = "SELECT COUNT(*) AS total FROM events";
    let eventsParams = [];
    
    if (!isAdmin) {
      eventsQuery += " WHERE created_by = $1";
      eventsParams = [userId];
    }
    
    const eventsResult = await db.query(eventsQuery, eventsParams);
    const totalEvents = parseInt(eventsResult.rows[0].total);

    // Total bookings
    let bookingsQuery = "SELECT COUNT(*) AS total FROM bookings";
    let bookingsParams = [];
    
    if (!isAdmin) {
      bookingsQuery += " WHERE user_id = $1";
      bookingsParams = [userId];
    }
    
    const bookingsResult = await db.query(bookingsQuery, bookingsParams);
    const totalBookings = parseInt(bookingsResult.rows[0].total);

    // Total revenue (sum of completed payments)
    let paymentsQuery = "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status='completed'";
    let paymentsParams = [];
    
    if (!isAdmin) {
      paymentsQuery += " AND user_id = $1";
      paymentsParams = [userId];
    }
    
    const paymentsResult = await db.query(paymentsQuery, paymentsParams);
    const totalRevenue = parseFloat(paymentsResult.rows[0].total);

    // Recent events: last 5 events
    let recentEventsQuery = "SELECT id, title, created_at FROM events";
    let recentEventsParams = [];
    
    if (!isAdmin) {
      recentEventsQuery += " WHERE created_by = $1";
      recentEventsParams = [userId];
    }
    
    recentEventsQuery += " ORDER BY created_at DESC LIMIT 5";
    
    const recentEventsResult = await db.query(recentEventsQuery, recentEventsParams);

    // Recent bookings: last 5 confirmed
    let recentBookingsQuery = "SELECT id, event_id, booking_date FROM bookings WHERE status='confirmed'";
    let recentBookingsParams = [];
    
    if (!isAdmin) {
      recentBookingsQuery += " AND user_id = $1";
      recentBookingsParams = [userId];
    }
    
    recentBookingsQuery += " ORDER BY booking_date DESC LIMIT 5";
    
    const recentBookingsResult = await db.query(recentBookingsQuery, recentBookingsParams);

    // Upcoming events: next 5 upcoming
    let upcomingQuery = `
      SELECT id, title, event_date, start_time
      FROM events
      WHERE event_date >= CURRENT_DATE AND status='upcoming'
    `;
    let upcomingParams = [];
    
    if (!isAdmin) {
      upcomingQuery += " AND created_by = $1";
      upcomingParams = [userId];
    }
    
    upcomingQuery += " ORDER BY event_date ASC, start_time ASC LIMIT 5";
    
    const upcomingEventsResult = await db.query(upcomingQuery, upcomingParams);

    // Recent revenue transactions: last 5 completed payments
    let recentPaymentsQuery = `
      SELECT id, booking_id, amount, method, paid_at 
      FROM payments 
      WHERE status='completed'
    `;
    let recentPaymentsParams = [];
    
    if (!isAdmin) {
      recentPaymentsQuery += " AND user_id = $1";
      recentPaymentsParams = [userId];
    }
    
    recentPaymentsQuery += " ORDER BY paid_at DESC LIMIT 5";
    
    const recentPaymentsResult = await db.query(recentPaymentsQuery, recentPaymentsParams);

    res.json({
      totals: { totalEvents, totalBookings, totalRevenue },
      recentActivity: {
        events: recentEventsResult.rows,
        bookings: recentBookingsResult.rows,
      },
      upcomingEvents: upcomingEventsResult.rows,
      recentPayments: recentPaymentsResult.rows,
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;