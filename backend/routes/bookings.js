const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const { generateTicketQR } = require("../utils/ticketUtils");

// Import notification functions
const {
  sendNotification,
  notifyOrganizerNewBooking,
  notifyUserBookingConfirmed
} = require("./notifications");

// ======================
// GET all bookings
// Admin: all bookings
// User: only their own bookings
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
// GET bookings for organizer's events only
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
// UPDATE booking status for organizer
// ======================
router.put("/organizer/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const bookingId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "organizer" && userRole !== "admin") {
      return res.status(403).json({ error: "Access denied. Organizer role required." });
    }

    const checkQuery = `
      SELECT b.*, e.created_by, e.title as event_title, u.fullname as customer_name
      FROM bookings b
      INNER JOIN events e ON b.event_id = e.id
      INNER JOIN usercredentials u ON b.user_id = u.id
      WHERE b.id = $1
    `;
    const checkResult = await db.query(checkQuery, [bookingId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = checkResult.rows[0];

    if (userRole === "organizer" && booking.created_by !== userId) {
      return res.status(403).json({ error: "You can only update bookings for your own events" });
    }

    if (status === "confirmed") {
      const paymentResult = await db.query(
        "SELECT status FROM payments WHERE booking_id = $1",
        [bookingId]
      );

      if (
        paymentResult.rows.length === 0 ||
        paymentResult.rows[0].status !== "success"
      ) {
        return res.status(400).json({
          error: "Cannot confirm booking: payment is still pending or not recorded"
        });
      }
    }

    await db.query(
      "UPDATE bookings SET status = $1 WHERE id = $2",
      [status, bookingId]
    );

    // 📩 Send notification to customer
    if (status === "confirmed") {
      await sendNotification(
        booking.user_id,
        "✅ Booking Confirmed",
        `Your booking for "${booking.event_title}" has been confirmed by the organizer!`,
        "booking",
        { booking_id: bookingId, booking_reference: booking.reference }
      );
    } else if (status === "cancelled") {
      await sendNotification(
        booking.user_id,
        "❌ Booking Cancelled",
        `Your booking for "${booking.event_title}" has been cancelled.`,
        "booking",
        { booking_id: bookingId, booking_reference: booking.reference }
      );
    }

    res.json({ message: "Booking status updated successfully" });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// ======================
// GET single booking by ID
// ======================
router.get("/:id", verifyToken, async (req, res) => {
  const bookingId = req.params.id;
  const isAdmin = req.user.role === "admin";
  const userId = req.user.id;

  try {
    const bookingResult = await db.query(`
      SELECT 
        b.id,
        b.reference,
        b.booking_date,
        b.seats,
        b.total_amount,
        b.status AS booking_status,
        b.created_at,
        b.user_id,
        b.event_id,
        e.title AS event_title,
        e.event_date,
        e.location,
        e.venue,
        e.start_time,
        e.end_time,
        u.fullname AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM bookings b
      INNER JOIN events e ON b.event_id = e.id
      INNER JOIN usercredentials u ON b.user_id = u.id
      WHERE b.id = $1
    `, [bookingId]);

    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0];
    if (!isAdmin && booking.user_id !== userId) return res.status(403).json({ error: "Forbidden. Access denied." });

    const ticketTypesResult = await db.query(`
      SELECT 
        bt.id AS booking_ticket_id,
        bt.ticket_type_id,
        bt.quantity,
        bt.price,
        tt.name AS ticket_name,
        tt.description AS ticket_description
      FROM booking_tickets bt
      JOIN ticket_types tt ON bt.ticket_type_id = tt.id
      WHERE bt.booking_id = $1
    `, [bookingId]);

    booking.tickets = ticketTypesResult.rows;

    const generatedTicketsResult = await db.query(`
      SELECT id AS ticket_id, ticket_type_id, qr_code
      FROM tickets
      WHERE booking_id = $1
    `, [bookingId]);

    booking.generatedTickets = generatedTicketsResult.rows;

    res.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// ======================
// PUT update booking (Admin only)
// ======================
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, seats, total_amount } = req.body;
    const bookingId = req.params.id;

    const existingResult = await db.query(
      "SELECT * FROM bookings WHERE id = $1",
      [bookingId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = existingResult.rows[0];

    if (status === "confirmed") {
      const paymentResult = await db.query(
        "SELECT status FROM payments WHERE booking_id = $1",
        [bookingId]
      );

      if (
        paymentResult.rows.length === 0 ||
        paymentResult.rows[0].status !== "success"
      ) {
        return res.status(400).json({
          error:
            "Cannot confirm booking: payment is still pending or not recorded"
        });
      }
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (status) {
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    if (seats !== undefined) {
      updateFields.push(`seats = $${paramCount}`);
      values.push(seats);
      paramCount++;
    }
    if (total_amount !== undefined) {
      updateFields.push(`total_amount = $${paramCount}`);
      values.push(total_amount);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(bookingId);

    await db.query(
      `UPDATE bookings SET ${updateFields.join(", ")} WHERE id = $${paramCount}`,
      values
    );

    res.json({ message: "Booking updated successfully" });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// ======================
// CREATE new booking
// ======================
router.post("/", verifyToken, async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { event_id, tickets } = req.body; 
    const userId = req.user.id;

    console.log('🔥 Booking request received:', { userId, event_id, tickets });

    if (!event_id || !tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: "event_id and tickets[] are required" });
    }

    await client.query("BEGIN");

    // Fetch event and organizer
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

    // Validate ticket types
    for (const t of tickets) {
      const ticketType = await client.query(
        "SELECT id, price, quantity_available, quantity_sold FROM ticket_types WHERE id = $1 AND event_id = $2",
        [t.ticket_type_id, event_id]
      );

      if (ticketType.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Invalid ticket type: ${t.ticket_type_id}` });
      }

      const available = ticketType.rows[0].quantity_available - ticketType.rows[0].quantity_sold;
      if (t.quantity > available) {
        await client.query("ROLLBACK");
        return res.status(400).json({ 
          error: `Not enough tickets available. Only ${available} tickets left for this type.` 
        });
      }

      totalAmount += ticketType.rows[0].price * t.quantity;
      totalSeats += t.quantity;
    }

    // Generate unique reference
    const reference = 'BK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

    // Create booking
    const booking = await client.query(
      `INSERT INTO bookings (user_id, event_id, total_amount, status, reference, booking_date, seats)
       VALUES ($1, $2, $3, 'pending', $4, NOW(), $5)
       RETURNING id, reference`,
      [userId, event_id, totalAmount, reference, totalSeats]
    );

    const bookingId = booking.rows[0].id;
    console.log('✅ Booking created:', { bookingId, reference: booking.rows[0].reference });

    // Insert booked tickets
    for (const t of tickets) {
      await client.query(
        `INSERT INTO booking_tickets (booking_id, ticket_type_id, quantity, price)
         VALUES ($1, $2, $3, 
         (SELECT price FROM ticket_types WHERE id = $2))`,
        [bookingId, t.ticket_type_id, t.quantity]
      );

      // Update ticket usage
      await client.query(
        `UPDATE ticket_types 
         SET quantity_sold = quantity_sold + $1 
         WHERE id = $2`,
        [t.quantity, t.ticket_type_id]
      );
      
      console.log(`✅ Added ${t.quantity} tickets of type ${t.ticket_type_id}`);
    }

    await client.query("COMMIT");

    // 📩 Notify user about booking creation
    await sendNotification(
      userId,
      "🎫 Booking Created",
      `Your booking for "${event.title}" has been created. Complete payment to confirm.`,
      "booking",
      { booking_id: bookingId, booking_reference: reference, event_id }
    );

    // 📩 Notify organizer about new booking
    if (event.created_by) {
      // Get customer name
      const userResult = await db.query("SELECT fullname FROM usercredentials WHERE id = $1", [userId]);
      const customerName = userResult.rows[0]?.fullname || "A customer";

      await notifyOrganizerNewBooking(event.created_by, {
        event_title: event.title,
        customer_name: customerName,
        seats: totalSeats,
        total_amount: totalAmount,
        booking_reference: reference
      });
    }

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking_id: bookingId,
      reference: booking.rows[0].reference,
      total_amount: totalAmount,
      status: "pending"
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error creating booking:", error);
    res.status(500).json({ 
      error: "Failed to create booking",
      details: error.message 
    });
  } finally {
    client.release();
  }
});

// ======================
// DELETE booking (Admin only)
// ======================
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    const bookingId = req.params.id;
    await client.query("BEGIN");

    const ticketsResult = await client.query(
      `SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1`,
      [bookingId]
    );

    for (const ticket of ticketsResult.rows) {
      await client.query(
        `UPDATE ticket_types SET quantity_sold = quantity_sold - $1 WHERE id = $2`,
        [ticket.quantity, ticket.ticket_type_id]
      );
    }

    const result = await client.query("DELETE FROM bookings WHERE id = $1 RETURNING user_id", [bookingId]);
    if (result.rowCount === 0) throw new Error("Booking not found");

    await client.query("COMMIT");
    
    // 📩 Notify user about booking deletion
    if (result.rows[0]?.user_id) {
      await sendNotification(
        result.rows[0].user_id,
        "🗑️ Booking Deleted",
        "One of your bookings has been deleted by an administrator.",
        "system",
        { booking_id: bookingId }
      );
    }

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: error.message || "Failed to delete booking" });
  } finally {
    client.release();
  }
});

// ======================
// Cancel booking (User)
// ======================
router.put("/:id/cancel", verifyToken, async (req, res) => {
  const client = await db.getClient();
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    await client.query("BEGIN");

    const bookingResult = await client.query(
      "SELECT b.*, e.title as event_title FROM bookings b JOIN events e ON b.event_id = e.id WHERE b.id = $1 FOR UPDATE", 
      [bookingId]
    );
    if (bookingResult.rows.length === 0) throw new Error("Booking not found");
    const booking = bookingResult.rows[0];

    if (!isAdmin && booking.user_id !== userId) throw new Error("You can only cancel your own bookings");
    if (booking.status === "cancelled") throw new Error("Booking is already cancelled");
    if (booking.status === "confirmed") throw new Error("Confirmed bookings cannot be cancelled. Contact support.");

    const ticketsResult = await client.query(
      `SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1`,
      [bookingId]
    );
    for (const ticket of ticketsResult.rows) {
      await client.query(
        `UPDATE ticket_types SET quantity_sold = quantity_sold - $1 WHERE id = $2`,
        [ticket.quantity, ticket.ticket_type_id]
      );
    }

    await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [bookingId]);

    await client.query("COMMIT");
    
    // 📩 Notify user about cancellation
    await sendNotification(
      booking.user_id,
      "❌ Booking Cancelled",
      `Your booking for "${booking.event_title}" has been cancelled.`,
      "booking",
      { booking_id: bookingId, booking_reference: booking.reference }
    );

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error cancelling booking:", error);
    res.status(500).json({ error: error.message || "Failed to cancel booking" });
  } finally {
    client.release();
  }
});

module.exports = router;