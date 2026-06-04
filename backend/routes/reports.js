const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");
const axios = require("axios");
require("dotenv").config();

const analyticsCache = {};

// ───────────────── helpers ─────────────────

const buildFilters = ({
  startDate,
  endDate,
  eventId,
  paymentStatus,
  isAdmin,
  userId,
  organizerOnly = false,
}) => {
  const filters = [];
  const values = [];
  let param = 1;

  if (organizerOnly) {
    filters.push(`e.created_by = $${param++}`);
    values.push(userId);
  }

  if (startDate) {
    filters.push(`b.booking_date >= $${param++}`);
    values.push(startDate);
  }

  if (endDate) {
    filters.push(`b.booking_date <= $${param++}`);
    values.push(endDate);
  }

  if (eventId) {
    filters.push(`e.id = $${param++}`);
    values.push(eventId);
  }

  if (paymentStatus) {
    filters.push(`p.status = $${param++}`);
    values.push(paymentStatus);
  }

  if (!isAdmin && !organizerOnly) {
    filters.push(`b.user_id = $${param++}`);
    values.push(userId);
  }

  return {
    whereClause: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
    values,
  };
};

// ───────────────── analytics builder ─────────────────

const buildAnalytics = (reports = []) => {
  const safeAmount = (v) => parseFloat(v || 0);

  // ONLY successful payments should count as revenue
  const successful = reports.filter(
    r => (r.payment_status || "").toLowerCase() === "success"
  );

  const totalRevenue = successful.reduce(
    (s, r) => s + safeAmount(r.payment_amount),
    0
  );

  const totalBookings = reports.length;
  const totalEvents = new Set(reports.map(r => r.event_id)).size;

  // ───── time series ─────
  const tsMap = {};

  reports.forEach(r => {
    if (!r.booking_date) return;

    const d = new Date(r.booking_date);
    if (isNaN(d)) return;

    const key = d.toISOString().split("T")[0];

    if (!tsMap[key]) {
      tsMap[key] = {
        dateKey: key,
        date: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        revenue: 0,
        bookings: 0,
      };
    }

    tsMap[key].bookings += 1;

    if ((r.payment_status || "").toLowerCase() === "success") {
      tsMap[key].revenue += safeAmount(r.payment_amount);
    }
  });

  const timeSeriesData = Object.values(tsMap)
    .sort((a, b) => new Date(a.dateKey) - new Date(b.dateKey))
    .map(({ date, revenue, bookings }) => ({
      date,
      revenue,
      bookings,
    }));

  // ───── event performance ─────
  const eventMap = {};

  reports.forEach(r => {
    const id = r.event_id || "unknown";

    if (!eventMap[id]) {
      eventMap[id] = {
        id,
        name: r.event_title || "Unknown",
        bookings: 0,
        revenue: 0,
      };
    }

    eventMap[id].bookings += 1;

    if ((r.payment_status || "").toLowerCase() === "success") {
      eventMap[id].revenue += safeAmount(r.payment_amount);
    }
  });

  const eventPerformance = Object.values(eventMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ───── distribution helper ─────
  const dist = (field) => {
    const map = {};

    reports.forEach(r => {
      const k = (r[field] || "unknown").toLowerCase();
      map[k] = (map[k] || 0) + 1;
    });

    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  };

  const paymentStatus = dist("payment_status");
  const bookingStatus = dist("booking_status");

  // ───── REAL growth (last 7 days vs previous 7 days) ─────
  const sorted = [...reports]
    .filter(r => r.booking_date)
    .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));

  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() - 7);

  const last7 = sorted.filter(r => new Date(r.booking_date) >= cutoff);
  const prev7 = sorted.filter(r => new Date(r.booking_date) < cutoff);

  const sumRevenue = (arr) =>
    arr.reduce(
      (s, r) =>
        (r.payment_status || "").toLowerCase() === "success"
          ? s + safeAmount(r.payment_amount)
          : s,
      0
    );

  const revenueGrowth =
    sumRevenue(prev7) > 0
      ? Number(
          (((sumRevenue(last7) - sumRevenue(prev7)) / sumRevenue(prev7)) * 100).toFixed(1)
        )
      : 0;

  const bookingsGrowth =
    prev7.length > 0
      ? Number(
          (((last7.length - prev7.length) / prev7.length) * 100).toFixed(1)
        )
      : 0;

  // ───── avg booking ─────
  const avgBookingValue =
    totalBookings > 0 ? totalRevenue / totalBookings : 0;

  // ───── suspicious bookings ─────
  const suspiciousBookings = reports.filter(r => {
    const amount = safeAmount(r.payment_amount);

    return (
      amount > avgBookingValue * 3 ||
      (r.payment_status || "").toLowerCase() === "failed"
    );
  });

  // ───── day of week ─────
  const dayMap = {};
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  reports.forEach(r => {
    if (!r.booking_date) return;

    const d = new Date(r.booking_date);
    if (isNaN(d)) return;

    const day = days[d.getDay()];

    if (!dayMap[day]) {
      dayMap[day] = { day, bookings: 0, revenue: 0 };
    }

    dayMap[day].bookings += 1;

    if ((r.payment_status || "").toLowerCase() === "success") {
      dayMap[day].revenue += safeAmount(r.payment_amount);
    }
  });

  const dayOfWeekData = days.map(
    d => dayMap[d] || { day: d, bookings: 0, revenue: 0 }
  );

  return {
    stats: {
      totalRevenue,
      totalBookings,
      totalEvents,
    },

    analytics: {
      timeSeriesData,
      eventPerformance,
      paymentStatus,
      bookingStatus,
      revenueGrowth,
      bookingsGrowth,
      avgBookingValue,
      suspiciousBookings,
      dayOfWeekData,
    },
  };
};

// ───────────────── main query (FIXED: no duplicates) ─────────────────

const REPORT_QUERY = `
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
LEFT JOIN events e ON b.event_id = e.id
LEFT JOIN usercredentials u ON b.user_id = u.id

-- FIX: prevent duplicate rows from multiple payments
LEFT JOIN LATERAL (
  SELECT *
  FROM payments p2
  WHERE p2.booking_id = b.id
  ORDER BY p2.created_at DESC
  LIMIT 1
) p ON true
`;

// ───────────────── routes ─────────────────

router.get("/", verifyToken, async (req, res) => {
  try {
    const { startDate, endDate, eventId, paymentStatus, symbol } = req.query;

    const isAdmin = req.user.role === "admin";

    const { whereClause, values } = buildFilters({
      startDate,
      endDate,
      eventId,
      paymentStatus,
      isAdmin,
      userId: req.user.id,
    });

    const result = await db.query(
      `${REPORT_QUERY} ${whereClause}
       ORDER BY b.booking_date DESC`,
      values
    );

    const reports = result.rows || [];

    const analytics = buildAnalytics(reports);

    let stockAnalytics = [];

    if (symbol) {
      const key = symbol.toUpperCase();
      const cached = analyticsCache[key];
      const now = Date.now();

      if (cached && now - cached.timestamp < 10 * 60 * 1000) {
        stockAnalytics = cached.data;
      } else {
        try {
          const avRes = await axios.get(
            "https://www.alphavantage.co/query",
            {
              params: {
                function: "TIME_SERIES_DAILY",
                symbol: key,
                apikey: process.env.ALPHA_VANTAGE_KEY,
              },
            }
          );

          const ts = avRes.data["Time Series (Daily)"];

          if (ts) {
            stockAnalytics = Object.keys(ts)
              .slice(0, 5)
              .map(date => ({
                date,
                open: parseFloat(ts[date]["1. open"]),
                high: parseFloat(ts[date]["2. high"]),
                low: parseFloat(ts[date]["3. low"]),
                close: parseFloat(ts[date]["4. close"]),
                volume: parseInt(ts[date]["5. volume"], 10),
              }));

            analyticsCache[key] = {
              data: stockAnalytics,
              timestamp: now,
            };
          }
        } catch (err) {
          console.error("AlphaVantage error:", err.message);
        }
      }
    }

    res.json({
      ...analytics,
      reports,
      stockAnalytics,
    });

  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// ───────────────── organizer ─────────────────

router.get("/organizer", verifyToken, async (req, res) => {
  try {
    if (!["organizer", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Organizer access required" });
    }

    const { startDate, endDate, eventId, paymentStatus } = req.query;

    const { whereClause, values } = buildFilters({
      startDate,
      endDate,
      eventId,
      paymentStatus,
      isAdmin: true,
      userId: req.user.id,
      organizerOnly: true,
    });

    const result = await db.query(
      `${REPORT_QUERY} ${whereClause}
       ORDER BY b.booking_date DESC`,
      values
    );

    const reports = result.rows || [];

    res.json({
      ...buildAnalytics(reports),
      reports,
    });

  } catch (err) {
    console.error("Error fetching organizer reports:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

module.exports = router;