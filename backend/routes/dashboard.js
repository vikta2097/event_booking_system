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

// Add this NEW endpoint to your dashboard.js file
// Place it AFTER the existing router.get("/", verifyToken, async...) endpoint

// ======================
// GET dashboard for organizer's events only
// NEW ENDPOINT FOR ORGANIZERS
// ======================
router.get("/organizer", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only organizers and admins can access
    if (userRole !== "organizer" && userRole !== "admin") {
      return res.status(403).json({ error: "Access denied. Organizer role required." });
    }

    // Total events created by this organizer
    const eventsResult = await db.query(
      "SELECT COUNT(*) AS total FROM events WHERE created_by = $1",
      [userId]
    );
    const totalEvents = parseInt(eventsResult.rows[0].total);

    // Total bookings for organizer's events
    const bookingsResult = await db.query(
      `SELECT COUNT(*) AS total 
       FROM bookings b
       INNER JOIN events e ON b.event_id = e.id
       WHERE e.created_by = $1`,
      [userId]
    );
    const totalBookings = parseInt(bookingsResult.rows[0].total);

    // Total revenue from organizer's events
    const revenueResult = await db.query(
      `SELECT COALESCE(SUM(p.amount), 0) AS total 
       FROM payments p
       INNER JOIN bookings b ON p.booking_id = b.id
       INNER JOIN events e ON b.event_id = e.id
       WHERE e.created_by = $1 AND p.status = 'completed'`,
      [userId]
    );
    const totalRevenue = parseFloat(revenueResult.rows[0].total);

    // Recent events created by organizer
    const recentEventsResult = await db.query(
      `SELECT id, title, created_at, event_date, status
       FROM events
       WHERE created_by = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    // Recent bookings for organizer's events
    const recentBookingsResult = await db.query(
      `SELECT b.id, b.event_id, b.booking_date, b.status, e.title as event_title
       FROM bookings b
       INNER JOIN events e ON b.event_id = e.id
       WHERE e.created_by = $1 AND b.status = 'confirmed'
       ORDER BY b.booking_date DESC
       LIMIT 5`,
      [userId]
    );

    // Upcoming events created by organizer
    const upcomingEventsResult = await db.query(
      `SELECT id, title, event_date, start_time, location, status
       FROM events
       WHERE created_by = $1 
         AND event_date >= CURRENT_DATE 
         AND status = 'upcoming'
       ORDER BY event_date ASC, start_time ASC
       LIMIT 5`,
      [userId]
    );

    // Recent payments for organizer's events
    const recentPaymentsResult = await db.query(
      `SELECT p.id, p.booking_id, p.amount, p.method, p.paid_at
       FROM payments p
       INNER JOIN bookings b ON p.booking_id = b.id
       INNER JOIN events e ON b.event_id = e.id
       WHERE e.created_by = $1 AND p.status = 'completed'
       ORDER BY p.paid_at DESC
       LIMIT 5`,
      [userId]
    );

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
    console.error("Error fetching organizer dashboard data:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;