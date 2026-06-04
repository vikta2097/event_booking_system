const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const { generateTicketQR } = require("../utils/ticketUtils");

// Import notification functions
const {
  sendNotification,
  notifyOrganizerNewBooking,
} = require("./notifications");

/**
 * Helper: safe socket emit
 * (prevents crashes if socket not initialized yet)
 */
const emitEvent = (event, payload) => {
  try {
    if (global.io) {
      global.io.emit(event, payload);
    }
  } catch (err) {
    console.error("Socket emit error:", err.message);
  }
};

// ======================
// GET all bookings
// ======================
router.get("/", verifyToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const userId = req.user.id;

    let query = `
      SELECT 
        b.id,
        b.reference,
        b.booking_date,
        b.seats,
        b.total_amount,
        b.status AS booking_status,
        b.created_at,
        e.id AS event_id,
        e.title AS event_title,
        e.event_date,
        e.start_time,
        e.location,
        e.price AS event_price,
        u.id AS user_id,
        u.fullname AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM bookings b
      INNER JOIN events e ON b.event_id = e.id
      INNER JOIN usercredentials u ON b.user_id = u.id
    `;

    const params = [];
    if (!isAdmin) {
      query += " WHERE b.user_id = $1";
      params.push(userId);
    }
    query += " ORDER BY b.booking_date DESC";

    const result = await db.query(query, params);

    const bookingsWithTickets = await Promise.all(
      result.rows.map(async booking => {
        const ticketsResult = await db.query(
          `SELECT bt.*, tt.name as ticket_name
           FROM booking_tickets bt
           JOIN ticket_types tt ON bt.ticket_type_id = tt.id
           WHERE bt.booking_id = $1`,
          [booking.id]
        );
        return { ...booking, tickets: ticketsResult.rows };
      })
    );

    res.json(bookingsWithTickets);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ======================
// GET organizer bookings
// ======================
router.get("/organizer", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "organizer" && userRole !== "admin") {
      return res.status(403).json({ error: "Access denied. Organizer role required." });
    }

    const query = `
      SELECT 
        b.id,
        b.reference,
        b.booking_date,
        b.seats,
        b.total_amount,
        b.status AS booking_status,
        b.created_at,
        e.id AS event_id,
        e.title AS event_title,
        e.event_date,
        e.start_time,
        e.location,
        e.price AS event_price,
        u.id AS user_id,
        u.fullname AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        p.status AS payment_status
      FROM bookings b
      INNER JOIN events e ON b.event_id = e.id
      INNER JOIN usercredentials u ON b.user_id = u.id
      LEFT JOIN payments p ON p.booking_id = b.id
      WHERE e.created_by = $1
      ORDER BY b.booking_date DESC
    `;

    const result = await db.query(query, [userId]);

    const bookingsWithTickets = await Promise.all(
      result.rows.map(async booking => {
        const ticketsResult = await db.query(
          `SELECT bt.*, tt.name as ticket_name, tt.price as ticket_price
           FROM booking_tickets bt
           JOIN ticket_types tt ON bt.ticket_type_id = tt.id
           WHERE bt.booking_id = $1`,
          [booking.id]
        );
        return { ...booking, tickets: ticketsResult.rows };
      })
    );

    res.json(bookingsWithTickets);
  } catch (error) {
    console.error("Error fetching organizer bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ======================
// CREATE booking (REAL-TIME ENABLED)
// ======================
router.post("/", verifyToken, async (req, res) => {
  const client = await db.getClient();

  try {
    const { event_id, tickets } = req.body;
    const userId = req.user.id;

    if (!event_id || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: "event_id and tickets[] required" });
    }

    await client.query("BEGIN");

    const eventResult = await client.query(
      "SELECT id, price, title, created_by FROM events WHERE id = $1",
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventResult.rows[0];

    let totalAmount = 0;
    let totalSeats = 0;

    for (const t of tickets) {
      const ticketType = await client.query(
        `SELECT id, price, quantity_available, quantity_sold 
         FROM ticket_types 
         WHERE id = $1 AND event_id = $2`,
        [t.ticket_type_id, event_id]
      );

      if (ticketType.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid ticket type" });
      }

      const available =
        ticketType.rows[0].quantity_available -
        ticketType.rows[0].quantity_sold;

      if (t.quantity > available) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Only ${available} tickets left`
        });
      }

      totalAmount += ticketType.rows[0].price * t.quantity;
      totalSeats += t.quantity;
    }

    const reference =
      "BK-" + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();

    const booking = await client.query(
      `INSERT INTO bookings 
       (user_id, event_id, total_amount, status, reference, booking_date, seats)
       VALUES ($1, $2, $3, 'pending', $4, NOW(), $5)
       RETURNING id, reference`,
      [userId, event_id, totalAmount, reference, totalSeats]
    );

    const bookingId = booking.rows[0].id;

    for (const t of tickets) {
      await client.query(
        `INSERT INTO booking_tickets (booking_id, ticket_type_id, quantity, price)
         VALUES ($1, $2, $3,
         (SELECT price FROM ticket_types WHERE id = $2))`,
        [bookingId, t.ticket_type_id, t.quantity]
      );

      await client.query(
        `UPDATE ticket_types 
         SET quantity_sold = quantity_sold + $1
         WHERE id = $2`,
        [t.quantity, t.ticket_type_id]
      );
    }

    await client.query("COMMIT");

    // ======================
    // 🔴 REAL-TIME EVENTS
    // ======================
    emitEvent("booking_created", {
      booking_id: bookingId,
      user_id: userId,
      event_id,
      event_title: event.title,
      total_amount: totalAmount,
      seats: totalSeats,
      reference
    });

    // Notifications
    await sendNotification(
      userId,
      "🎫 Booking Created",
      `Booking for "${event.title}" created successfully.`,
      "booking",
      { booking_id: bookingId }
    );

    if (event.created_by) {
      const userResult = await db.query(
        "SELECT fullname FROM usercredentials WHERE id = $1",
        [userId]
      );

      await notifyOrganizerNewBooking(event.created_by, {
        event_title: event.title,
        customer_name: userResult.rows[0]?.fullname,
        seats: totalSeats,
        total_amount: totalAmount,
        booking_reference: reference
      });
    }

    res.status(201).json({
      success: true,
      booking_id: bookingId,
      reference,
      total_amount: totalAmount
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Booking error:", error);
    res.status(500).json({ error: "Booking failed" });
  } finally {
    client.release();
  }
});

// ======================
// CANCEL booking (REAL-TIME)
// ======================
router.put("/:id/cancel", verifyToken, async (req, res) => {
  const client = await db.getClient();

  try {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    await client.query("BEGIN");

    const bookingResult = await client.query(
      `SELECT b.*, e.title AS event_title 
       FROM bookings b 
       JOIN events e ON b.event_id = e.id 
       WHERE b.id = $1 FOR UPDATE`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error("Booking not found");
    }

    const booking = bookingResult.rows[0];

    if (!isAdmin && booking.user_id !== userId) {
      throw new Error("Not allowed");
    }

    await client.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
      [bookingId]
    );

    await client.query("COMMIT");

    // ======================
    // 🔴 SOCKET EVENT
    // ======================
    emitEvent("booking_cancelled", {
      booking_id: bookingId,
      user_id: booking.user_id,
      event_title: booking.event_title
    });

    await sendNotification(
      booking.user_id,
      "❌ Booking Cancelled",
      `Booking for "${booking.event_title}" cancelled.`,
      "booking",
      { booking_id: bookingId }
    );

    res.json({ message: "Cancelled" });

  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;