const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");

// ✅ Safe socket access (NO global)
const { getIO } = require("../socket");

// Notifications
const {
  sendNotification,
  notifyOrganizerNewBooking,
} = require("./notifications");

// ======================
// SAFE SOCKET EMITTER
// ======================
const emitEvent = (event, payload) => {
  try {
    const io = getIO();
    if (io) io.emit(event, payload);
  } catch (err) {
    console.error("Socket emit error:", err.message);
  }
};

// ======================
// GET ALL BOOKINGS
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

    // attach tickets
    const bookingsWithTickets = await Promise.all(
      result.rows.map(async (b) => {
        const tickets = await db.query(
          `SELECT bt.*, tt.name AS ticket_name
           FROM booking_tickets bt
           JOIN ticket_types tt ON bt.ticket_type_id = tt.id
           WHERE bt.booking_id = $1`,
          [b.id]
        );

        return { ...b, tickets: tickets.rows };
      })
    );

    res.json(bookingsWithTickets);
  } catch (err) {
    console.error("Fetch bookings error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ======================
// GET ORGANIZER BOOKINGS
// ======================
router.get("/organizer", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!["organizer", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Organizer access required" });
    }

    const result = await db.query(
      `
      SELECT 
        b.id,
        b.reference,
        b.booking_date,
        b.seats,
        b.total_amount,
        b.status AS booking_status,

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
      `,
      [userId]
    );

    const enriched = await Promise.all(
      result.rows.map(async (b) => {
        const tickets = await db.query(
          `SELECT bt.*, tt.name, tt.price
           FROM booking_tickets bt
           JOIN ticket_types tt ON bt.ticket_type_id = tt.id
           WHERE bt.booking_id = $1`,
          [b.id]
        );

        return { ...b, tickets: tickets.rows };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("Organizer bookings error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ======================
// CREATE BOOKING (SAFE + ATOMIC)
// ======================
router.post("/", verifyToken, async (req, res) => {
  const client = await db.getClient();

  try {
    const { event_id, tickets } = req.body;
    const userId = req.user.id;

    if (!event_id || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: "event_id and tickets required" });
    }

    await client.query("BEGIN");

    // get event
    const eventRes = await client.query(
      "SELECT id, title, created_by FROM events WHERE id = $1",
      [event_id]
    );

    if (!eventRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventRes.rows[0];

    let totalAmount = 0;
    let totalSeats = 0;

    // ======================
    // LOCK TICKET ROWS
    // ======================
    for (const t of tickets) {
      const ttRes = await client.query(
        `
        SELECT id, price, quantity_available, quantity_sold
        FROM ticket_types
        WHERE id = $1 AND event_id = $2
        FOR UPDATE
        `,
        [t.ticket_type_id, event_id]
      );

      if (!ttRes.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Invalid ticket type" });
      }

      const tt = ttRes.rows[0];

      const available = tt.quantity_available - tt.quantity_sold;

      if (t.quantity > available) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: `Only ${available} tickets available`,
        });
      }

      totalAmount += tt.price * t.quantity;
      totalSeats += t.quantity;
    }

    const reference =
      "BK-" +
      Date.now() +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    // create booking
    const bookingRes = await client.query(
      `
      INSERT INTO bookings
      (user_id, event_id, total_amount, status, reference, booking_date, seats)
      VALUES ($1,$2,$3,'pending',$4,NOW(),$5)
      RETURNING id
      `,
      [userId, event_id, totalAmount, reference, totalSeats]
    );

    const bookingId = bookingRes.rows[0].id;

    // insert tickets + atomic update
    for (const t of tickets) {
      const update = await client.query(
        `
        UPDATE ticket_types
        SET quantity_sold = quantity_sold + $1
        WHERE id = $2
        AND quantity_sold + $1 <= quantity_available
        `,
        [t.quantity, t.ticket_type_id]
      );

      if (update.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Ticket limit exceeded during update",
        });
      }

      await client.query(
        `
        INSERT INTO booking_tickets
        (booking_id, ticket_type_id, quantity, price)
        VALUES (
          $1,
          $2,
          $3,
          (SELECT price FROM ticket_types WHERE id = $2)
        )
        `,
        [bookingId, t.ticket_type_id, t.quantity]
      );
    }

    await client.query("COMMIT");

    // ======================
    // REAL-TIME EVENTS
    // ======================
    emitEvent("booking_created", {
      booking_id: bookingId,
      user_id: userId,
      event_id,
      event_title: event.title,
      total_amount: totalAmount,
      seats: totalSeats,
      reference,
    });

    // notifications
    await sendNotification(
      userId,
      "🎫 Booking Created",
      `Booking for "${event.title}" created successfully.`,
      "booking",
      { booking_id: bookingId }
    );

    if (event.created_by) {
      const user = await db.query(
        "SELECT fullname FROM usercredentials WHERE id = $1",
        [userId]
      );

      await notifyOrganizerNewBooking(event.created_by, {
        event_title: event.title,
        customer_name: user.rows[0]?.fullname,
        seats: totalSeats,
        total_amount: totalAmount,
        booking_reference: reference,
      });
    }

    res.status(201).json({
      success: true,
      booking_id: bookingId,
      reference,
      total_amount: totalAmount,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Booking error:", err);
    res.status(500).json({ error: "Booking failed" });
  } finally {
    client.release();
  }
});

// ======================
// CANCEL BOOKING
// ======================
router.put("/:id/cancel", verifyToken, async (req, res) => {
  const client = await db.getClient();

  try {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT b.*, e.title AS event_title
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE b.id = $1
      FOR UPDATE
      `,
      [bookingId]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = result.rows[0];

    if (!isAdmin && booking.user_id !== userId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Not allowed" });
    }

    await client.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
      [bookingId]
    );

    await client.query("COMMIT");

    emitEvent("booking_cancelled", {
      booking_id: bookingId,
      user_id: booking.user_id,
      event_title: booking.event_title,
    });

    await sendNotification(
      booking.user_id,
      "❌ Booking Cancelled",
      `Booking for "${booking.event_title}" cancelled.`,
      "booking",
      { booking_id: bookingId }
    );

    res.json({ message: "Cancelled" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Cancel error:", err);
    res.status(500).json({ error: "Cancel failed" });
  } finally {
    client.release();
  }
});

module.exports = router;