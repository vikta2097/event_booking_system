const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");
const axios = require("axios");
require("dotenv").config();

// Simple in-memory cache for analytics (optional)
const analyticsCache = {};

router.get("/", verifyToken, async (req, res) => {
  try {
    const { startDate, endDate, eventId, paymentStatus, symbol } = req.query;
    const isAdmin = req.user.role === "admin";
    const userId = req.user.id;

    // ===== Filters for SQL query =====
    const filters = [];
    const values = [];
    let paramCount = 1;

    if (startDate) {
      filters.push(`b.booking_date >= $${paramCount}`);
      values.push(startDate);
      paramCount++;
    }
    if (endDate) {
      filters.push(`b.booking_date <= $${paramCount}`);
      values.push(endDate);
      paramCount++;
    }
    if (eventId) {
      filters.push(`e.id = $${paramCount}`);
      values.push(eventId);
      paramCount++;
    }
    if (paymentStatus) {
      filters.push(`p.status = $${paramCount}`);
      values.push(paymentStatus);
      paramCount++;
    }

    if (!isAdmin) {
      filters.push(`b.user_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

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
    const reports = result.rows;

    // ===== Aggregated stats =====
    const totalRevenue = reports.reduce((sum, r) => sum + (parseFloat(r.payment_amount) || 0), 0);
    const totalBookings = reports.length;
    const totalEvents = new Set(reports.map(r => r.event_id)).size;

    // ===== Analytics (optional) =====
    let analytics = [];
    if (symbol) {
      // Use cached data if exists and recent
      const cacheKey = symbol.toUpperCase();
      const cached = analyticsCache[cacheKey];
      const now = Date.now();
      if (cached && now - cached.timestamp < 10 * 60 * 1000) {
        analytics = cached.data;
      } else {
        try {
          const avRes = await axios.get("https://www.alphavantage.co/query", {
            params: {
              function: "TIME_SERIES_DAILY",
              symbol: cacheKey,
              apikey: process.env.ALPHA_VANTAGE_KEY
            }
          });
          const timeSeries = avRes.data["Time Series (Daily)"];
          if (timeSeries) {
            analytics = Object.keys(timeSeries)
              .slice(0, 5) // last 5 days
              .map(date => ({
                date,
                open: parseFloat(timeSeries[date]["1. open"]),
                high: parseFloat(timeSeries[date]["2. high"]),
                low: parseFloat(timeSeries[date]["3. low"]),
                close: parseFloat(timeSeries[date]["4. close"]),
                volume: parseInt(timeSeries[date]["5. volume"], 10)
              }));
            // Cache the result
            analyticsCache[cacheKey] = { data: analytics, timestamp: now };
          }
        } catch (err) {
          console.error("Alpha Vantage error:", err.message);
        }
      }
    }

    res.json({
      stats: { totalRevenue, totalBookings, totalEvents },
      reports,
      analytics
    });
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

module.exports = router;
