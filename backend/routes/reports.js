// routes/reports.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");
const axios = require("axios");
require("dotenv").config();

// simple in-memory cache (optional)
const analyticsCache = {};

router.get("/", verifyToken, async (req, res) => {
  try {
    const { startDate, endDate, eventId, paymentStatus, symbol } = req.query;
    const isAdmin = req.user.role === "admin";
    const userId = req.user.id;

    // BUILD FILTERS
    const filters = [];
    const values = [];
    let param = 1;

    if (startDate) {
      filters.push(`b.booking_date >= $${param}`);
      values.push(startDate);
      param++;
    }
    if (endDate) {
      filters.push(`b.booking_date <= $${param}`);
      values.push(endDate);
      param++;
    }
    if (eventId) {
      filters.push(`e.id = $${param}`);
      values.push(eventId);
      param++;
    }
    if (paymentStatus) {
      filters.push(`p.status = $${param}`);
      values.push(paymentStatus);
      param++;
    }

    if (!isAdmin) {
      filters.push(`b.user_id = $${param}`);
      values.push(userId);
      param++;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    // QUERY
    const query = `
      SELECT 
        b.id AS booking_id,
        b.booking_date,
        b.seats,
        b.total_amount AS booking_amount,
        b.status AS booking_status,
        e.id AS event_id,
        e.title AS event_title,
        e.event_date,
        e.status AS event_status,
        u.id AS user_id,
        u.fullname AS user_name,
        p.id AS payment_id,
        p.amount AS payment_amount,
        p.method AS payment_method,
        p.status AS payment_status,
        p.paid_at
      FROM bookings b
      LEFT JOIN events e ON b.event_id = e.id
      LEFT JOIN usercredentials u ON b.user_id = u.id
      LEFT JOIN payments p ON p.booking_id = b.id
      ${whereClause}
      ORDER BY b.booking_date DESC, e.event_date ASC
    `;

    const result = await db.query(query, values);
    const reports = result.rows || [];

    // ======================
    // AGGREGATED STATS
    // ======================

    const totalRevenue = reports.reduce((sum, r) => sum + (parseFloat(r.payment_amount) || 0), 0);
    const totalBookings = reports.length;
    const totalEvents = new Set(reports.map(r => r.event_id)).size;

    // ======================
    // 1) Time Series Data
    // ======================
    const timeSeriesMap = {};
    reports.forEach(r => {
      if (!r.booking_date) return;
      const d = new Date(r.booking_date);
      const key = d.toISOString().split("T")[0]; // YYYY-MM-DD
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      if (!timeSeriesMap[key]) {
        timeSeriesMap[key] = { dateKey: key, date: label, revenue: 0, bookings: 0 };
      }

      timeSeriesMap[key].revenue += parseFloat(r.booking_amount || r.payment_amount || 0) || 0;
      timeSeriesMap[key].bookings += 1;
    });

    const timeSeriesData = Object.values(timeSeriesMap)
      .sort((a, b) => new Date(a.dateKey) - new Date(b.dateKey))
      .map(d => ({
        date: d.date,
        revenue: d.revenue,
        bookings: d.bookings
      }));

    // ======================
    // 2) Event Performance
    // ======================
    const eventPerfMap = {};
    reports.forEach(r => {
      const id = r.event_id ?? `unknown-${r.event_title || 'Unknown'}`;
      if (!eventPerfMap[id]) {
        eventPerfMap[id] = {
          id,
          name: r.event_title || 'Unknown',
          bookings: 0,
          revenue: 0,
          date: r.event_date || null
        };
      }

      eventPerfMap[id].bookings += 1;
      eventPerfMap[id].revenue += parseFloat(r.booking_amount || r.payment_amount || 0) || 0;
    });

    const eventPerformance = Object.values(eventPerfMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ======================
    // 3) Payment Status (FIXED NAME)
    // ======================
    const paymentDist = {};
    reports.forEach(r => {
      const st = (r.payment_status || "unknown").toString().toLowerCase();
      paymentDist[st] = (paymentDist[st] || 0) + 1;
    });

    const paymentStatusStats = Object.entries(paymentDist).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      percentage: Number(((value / (reports.length || 1)) * 100).toFixed(1))
    }));

    // ======================
    // 4) Booking Status
    // ======================
    const bookingDist = {};
    reports.forEach(r => {
      const st = (r.booking_status || "unknown").toString().toLowerCase();
      bookingDist[st] = (bookingDist[st] || 0) + 1;
    });

    const bookingStatus = Object.entries(bookingDist).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));

    // ======================
    // 5) Revenue & Booking Growth
    // ======================
    const reportsChron = [...reports].sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));
    const mid = Math.floor(reportsChron.length / 2);
    const firstHalf = reportsChron.slice(0, mid);
    const secondHalf = reportsChron.slice(mid);

    const firstRev = firstHalf.reduce((s, r) => s + (parseFloat(r.booking_amount || r.payment_amount || 0) || 0), 0);
    const secondRev = secondHalf.reduce((s, r) => s + (parseFloat(r.booking_amount || r.payment_amount || 0) || 0), 0);

    const revenueGrowth =
      firstRev > 0 ? Number((((secondRev - firstRev) / firstRev) * 100).toFixed(1)) : 0;

    const bookingsGrowth =
      firstHalf.length > 0
        ? Number((((secondHalf.length - firstHalf.length) / firstHalf.length) * 100).toFixed(1))
        : 0;

    // ======================
    // 6) Avg Booking Value
    // ======================
    const avgBookingValue = totalBookings > 0 ? (totalRevenue / totalBookings) : 0;

    // ======================
    // 7) Suspicious Bookings
    // ======================
    const suspiciousBookings = reports.filter(r => {
      const amount = parseFloat(r.booking_amount || r.payment_amount || 0) || 0;

      if (amount > avgBookingValue * 3) return true;
      if ((r.payment_status || "").toLowerCase() === "failed") return true;

      return false;
    });

    // ======================
    // 8) Day-of-Week Data
    // ======================
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayMap = {};

    reports.forEach(r => {
      if (!r.booking_date) return;

      const day = new Date(r.booking_date).toLocaleDateString('en-US', { weekday: 'short' });

      if (!dayMap[day]) {
        dayMap[day] = { day, bookings: 0, revenue: 0 };
      }

      dayMap[day].bookings += 1;
      dayMap[day].revenue += parseFloat(r.booking_amount || r.payment_amount || 0) || 0;
    });

    const dayOfWeekData = dayNames.map(d => dayMap[d] || { day: d, bookings: 0, revenue: 0 });

    // ======================
    // 9) Optional AlphaVantage
    // ======================
    let analyticsStock = [];

    if (symbol) {
      const key = symbol.toUpperCase();
      const cached = analyticsCache[key];
      const now = Date.now();

      if (cached && now - cached.timestamp < 10 * 60 * 1000) {
        analyticsStock = cached.data;
      } else {
        try {
          const avRes = await axios.get("https://www.alphavantage.co/query", {
            params: {
              function: "TIME_SERIES_DAILY",
              symbol: key,
              apikey: process.env.ALPHA_VANTAGE_KEY
            }
          });

          const ts = avRes.data["Time Series (Daily)"];
          if (ts) {
            analyticsStock = Object.keys(ts).slice(0, 5).map(date => ({
              date,
              open: parseFloat(ts[date]["1. open"]),
              high: parseFloat(ts[date]["2. high"]),
              low: parseFloat(ts[date]["3. low"]),
              close: parseFloat(ts[date]["4. close"]),
              volume: parseInt(ts[date]["5. volume"], 10)
            }));

            analyticsCache[key] = { data: analyticsStock, timestamp: now };
          }
        } catch (err) {
          console.error("AlphaVantage error:", err.message);
        }
      }
    }

    // ======================
    // FINAL RESPONSE
    // ======================
    res.json({
      stats: { totalRevenue, totalBookings, totalEvents },
      reports,
      analytics: {
        timeSeriesData,
        eventPerformance,
        paymentStatus: paymentStatusStats,   // FIXED
        bookingStatus,
        revenueGrowth,
        bookingsGrowth,
        avgBookingValue,
        suspiciousBookings,
        dayOfWeekData
      },
      stockAnalytics: analyticsStock
    });

  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// ======================
// GET reports for organizer's events only
// NEW ENDPOINT FOR ORGANIZERS
// ======================
router.get("/organizer", verifyToken, async (req, res) => {
  try {
    const { startDate, endDate, eventId, paymentStatus } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Only organizers and admins can access
    if (userRole !== "organizer" && userRole !== "admin") {
      return res.status(403).json({ error: "Access denied. Organizer role required." });
    }

    // BUILD FILTERS - must include organizer's events
    const filters = [`e.created_by = $1`];
    const values = [userId];
    let param = 2;

    if (startDate) {
      filters.push(`b.booking_date >= $${param}`);
      values.push(startDate);
      param++;
    }
    if (endDate) {
      filters.push(`b.booking_date <= $${param}`);
      values.push(endDate);
      param++;
    }
    if (eventId) {
      filters.push(`e.id = $${param}`);
      values.push(eventId);
      param++;
    }
    if (paymentStatus) {
      filters.push(`p.status = $${param}`);
      values.push(paymentStatus);
      param++;
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;

    // MAIN QUERY
    const query = `
      SELECT 
        b.id AS booking_id,
        b.booking_date,
        b.seats,
        b.total_amount AS booking_amount,
        b.status AS booking_status,
        e.id AS event_id,
        e.title AS event_title,
        e.event_date,
        e.status AS event_status,
        u.id AS user_id,
        u.fullname AS user_name,
        u.email AS user_email,
        p.id AS payment_id,
        p.amount AS payment_amount,
        p.method AS payment_method,
        p.status AS payment_status,
        p.paid_at
      FROM bookings b
      INNER JOIN events e ON b.event_id = e.id
      LEFT JOIN usercredentials u ON b.user_id = u.id
      LEFT JOIN payments p ON p.booking_id = b.id
      ${whereClause}
      ORDER BY b.booking_date DESC, e.event_date ASC
    `;

    const result = await db.query(query, values);
    const reports = result.rows || [];

    // ======================
    // AGGREGATED STATS
    // ======================
    const totalRevenue = reports.reduce((sum, r) => sum + (parseFloat(r.payment_amount) || 0), 0);
    const totalBookings = reports.length;
    const totalEvents = new Set(reports.map(r => r.event_id)).size;

    // ======================
    // Time Series Data
    // ======================
    const timeSeriesMap = {};
    reports.forEach(r => {
      if (!r.booking_date) return;
      const d = new Date(r.booking_date);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      if (!timeSeriesMap[key]) {
        timeSeriesMap[key] = { dateKey: key, date: label, revenue: 0, bookings: 0 };
      }

      timeSeriesMap[key].revenue += parseFloat(r.booking_amount || r.payment_amount || 0) || 0;
      timeSeriesMap[key].bookings += 1;
    });

    const timeSeriesData = Object.values(timeSeriesMap)
      .sort((a, b) => new Date(a.dateKey) - new Date(b.dateKey))
      .map(d => ({
        date: d.date,
        revenue: d.revenue,
        bookings: d.bookings
      }));

    // ======================
    // Event Performance
    // ======================
    const eventPerfMap = {};
    reports.forEach(r => {
      const id = r.event_id ?? `unknown-${r.event_title || 'Unknown'}`;
      if (!eventPerfMap[id]) {
        eventPerfMap[id] = {
          id,
          name: r.event_title || 'Unknown',
          bookings: 0,
          revenue: 0,
          date: r.event_date || null
        };
      }

      eventPerfMap[id].bookings += 1;
      eventPerfMap[id].revenue += parseFloat(r.booking_amount || r.payment_amount || 0) || 0;
    });

    const eventPerformance = Object.values(eventPerfMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ======================
    // Payment Status Distribution
    // ======================
    const paymentDist = {};
    reports.forEach(r => {
      const st = (r.payment_status || "unknown").toString().toLowerCase();
      paymentDist[st] = (paymentDist[st] || 0) + 1;
    });

    const paymentStatusStats = Object.entries(paymentDist).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      percentage: Number(((value / (reports.length || 1)) * 100).toFixed(1))
    }));

    // ======================
    // Booking Status Distribution
    // ======================
    const bookingDist = {};
    reports.forEach(r => {
      const st = (r.booking_status || "unknown").toString().toLowerCase();
      bookingDist[st] = (bookingDist[st] || 0) + 1;
    });

    const bookingStatus = Object.entries(bookingDist).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      percentage: Number(((value / (reports.length || 1)) * 100).toFixed(1))
    }));

    // ======================
    // Growth Calculations
    // ======================
    const reportsChron = [...reports].sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));
    const mid = Math.floor(reportsChron.length / 2);
    const firstHalf = reportsChron.slice(0, mid);
    const secondHalf = reportsChron.slice(mid);

    const firstRev = firstHalf.reduce((s, r) => s + (parseFloat(r.booking_amount || r.payment_amount || 0) || 0), 0);
    const secondRev = secondHalf.reduce((s, r) => s + (parseFloat(r.booking_amount || r.payment_amount || 0) || 0), 0);

    const revenueGrowth = firstRev > 0 ? Number((((secondRev - firstRev) / firstRev) * 100).toFixed(1)) : 0;
    const bookingsGrowth = firstHalf.length > 0 
      ? Number((((secondHalf.length - firstHalf.length) / firstHalf.length) * 100).toFixed(1)) 
      : 0;

    // ======================
    // Average Booking Value
    // ======================
    const avgBookingValue = totalBookings > 0 ? (totalRevenue / totalBookings) : 0;

    // ======================
    // Day of Week Data
    // ======================
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayMap = {};

    reports.forEach(r => {
      if (!r.booking_date) return;
      const day = new Date(r.booking_date).toLocaleDateString('en-US', { weekday: 'short' });

      if (!dayMap[day]) {
        dayMap[day] = { day, bookings: 0, revenue: 0 };
      }

      dayMap[day].bookings += 1;
      dayMap[day].revenue += parseFloat(r.booking_amount || r.payment_amount || 0) || 0;
    });

    const dayOfWeekData = dayNames.map(d => dayMap[d] || { day: d, bookings: 0, revenue: 0 });

    // ======================
    // FINAL RESPONSE
    // ======================
    res.json({
      stats: { totalRevenue, totalBookings, totalEvents },
      reports,
      analytics: {
        timeSeriesData,
        eventPerformance,
        paymentStatus: paymentStatusStats,
        bookingStatus,
        revenueGrowth,
        bookingsGrowth,
        avgBookingValue,
        dayOfWeekData
      }
    });

  } catch (err) {
    console.error("Error fetching organizer reports:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

module.exports = router;
