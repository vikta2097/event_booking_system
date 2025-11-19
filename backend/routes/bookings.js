const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

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

    // Fetch ticket details for each booking
    const bookingsWithTickets = await Promise.all(
      result.rows.map(async (booking) => {
        const ticketsResult = await db.query(
          `SELECT bt.*, tt.name as ticket_name
           FROM booking_tickets bt
           JOIN ticket_types tt ON bt.ticket_type_id = tt.id
           WHERE bt.booking_id = $1`,
          [booking.id]
        );
        return {
          ...booking,
          tickets: ticketsResult.rows
        };
      })
    );

    res.json(bookingsWithTickets);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ======================
// GET single booking by ID
// ======================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const isAdmin = req.user.role === "admin";
    const userId = req.user.id;

    const query = `
      SELECT 
        b.*,
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
    `;

    const result = await db.query(query, [bookingId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = result.rows[0];

    if (!isAdmin && booking.user_id !== userId) {
      return res.status(403).json({ error: "Forbidden. Access denied." });
    }

    // Get ticket details
    const ticketsResult = await db.query(
      `SELECT bt.*, tt.name as ticket_name, tt.description
       FROM booking_tickets bt
       JOIN ticket_types tt ON bt.ticket_type_id = tt.id
       WHERE bt.booking_id = $1`,
      [bookingId]
    );

    booking.tickets = ticketsResult.rows;

    res.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// ======================
// POST create new booking with ticket types
// ======================
// POST create new booking with ticket types
router.post("/", verifyToken, async (req, res) => {
  const client = await db.getClient();

  try {
    const { event_id, tickets } = req.body;
    const user_id = req.user.id;

    // === Basic validation ===
    if (!event_id) return res.status(400).json({ error: "Event ID is required" });
    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: "At least one ticket type must be selected" });
    }

    await client.query("BEGIN");

    // === Fetch event with lock ===
    const eventResult = await client.query(
      `SELECT id, capacity, status, event_date 
       FROM events 
       WHERE id = $1 FOR UPDATE`,
      [event_id]
    );

    if (eventResult.rows.length === 0) throw new Error("Event not found");

    const event = eventResult.rows[0];

    if (event.status === "cancelled") throw new Error("This event has been cancelled");

    const eventEndOfDay = new Date(event.event_date + "T23:59:59");
    if (eventEndOfDay < new Date()) throw new Error("Cannot book tickets for past events");

    // === Process tickets ===
    let totalSeats = 0;
    let totalAmount = 0;
    const ticketDetails = [];

    for (const ticket of tickets) {
      const { ticket_type_id, quantity } = ticket;

      if (!ticket_type_id || !quantity || quantity <= 0) {
        throw new Error("Invalid ticket data: quantity must be greater than 0");
      }

      // Lock the ticket type row
      const ticketResult = await client.query(
        `SELECT id, price, quantity_available, quantity_sold, name
         FROM ticket_types 
         WHERE id = $1 AND event_id = $2
         FOR UPDATE`,
        [ticket_type_id, event_id]
      );

      if (ticketResult.rows.length === 0) throw new Error(`Ticket type not found`);

      const ticketType = ticketResult.rows[0];
      const available = ticketType.quantity_available - ticketType.quantity_sold;

      if (quantity > available) {
        throw new Error(`Only ${available} tickets available for "${ticketType.name}"`);
      }

      totalSeats += quantity;
      totalAmount += ticketType.price * quantity;
      ticketDetails.push({
        ticket_type_id,
        quantity,
        price: ticketType.price,
        name: ticketType.name,
      });
    }

    // === Check overall event capacity ===
    const bookedResult = await client.query(
      `SELECT COALESCE(SUM(seats), 0) AS total_seats
       FROM bookings
       WHERE event_id = $1 AND status != 'cancelled'`,
      [event_id]
    );

    const bookedSeats = parseInt(bookedResult.rows[0].total_seats, 10);
    const availableSeats = event.capacity - bookedSeats;

    if (totalSeats > availableSeats) {
      throw new Error(`Only ${availableSeats} seats available for this event`);
    }

    // === Generate booking reference ===
    const reference = `BK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // === Insert booking ===
    const bookingResult = await client.query(
      `INSERT INTO bookings (user_id, event_id, seats, total_amount, status, reference)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, reference`,
      [user_id, event_id, totalSeats, totalAmount, "pending", reference]
    );

    const bookingId = bookingResult.rows[0].id;

    // === Insert booking tickets and update sold quantities ===
    for (const ticket of ticketDetails) {
      await client.query(
        `INSERT INTO booking_tickets (booking_id, ticket_type_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [bookingId, ticket.ticket_type_id, ticket.quantity, ticket.price]
      );

      await client.query(
        `UPDATE ticket_types
         SET quantity_sold = quantity_sold + $1
         WHERE id = $2`,
        [ticket.quantity, ticket.ticket_type_id]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Booking created successfully",
      booking_id: bookingId,
      reference,
      total_amount: totalAmount,
      total_seats: totalSeats,
      tickets: ticketDetails,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Booking creation error:", error);

    // Send user-friendly message
    res.status(400).json({ error: error.message || "Failed to create booking" });
  } finally {
    client.release();
  }
});

// ======================
// PUT update booking
// Admin only
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
// DELETE booking (Admin only)
// ======================
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();
  
  try {
    const bookingId = req.params.id;

    await client.query('BEGIN');

    // Get booking tickets to restore quantities
    const ticketsResult = await client.query(
      `SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1`,
      [bookingId]
    );

    // Restore ticket quantities
    for (const ticket of ticketsResult.rows) {
      await client.query(
        `UPDATE ticket_types 
         SET quantity_sold = quantity_sold - $1
         WHERE id = $2`,
        [ticket.quantity, ticket.ticket_type_id]
      );
    }

    // Delete booking (cascade will delete booking_tickets)
    const result = await client.query(
      "DELETE FROM bookings WHERE id = $1",
      [bookingId]
    );

    if (result.rowCount === 0) {
      throw new Error("Booking not found");
    }

    await client.query('COMMIT');

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: error.message || "Failed to delete booking" });
  } finally {
    client.release();
  }
});

// ======================
// Cancel booking (User can cancel their own)
// ======================
router.put("/:id/cancel", verifyToken, async (req, res) => {
  const client = await db.getClient();
  
  try {
    const bookingId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === "admin";

    await client.query('BEGIN');

    const bookingResult = await client.query(
      "SELECT * FROM bookings WHERE id = $1 FOR UPDATE",
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error("Booking not found");
    }

    const booking = bookingResult.rows[0];

    if (!isAdmin && booking.user_id !== userId) {
      throw new Error("You can only cancel your own bookings");
    }

    if (booking.status === 'cancelled') {
      throw new Error("Booking is already cancelled");
    }

    if (booking.status === 'confirmed') {
      throw new Error("Confirmed bookings cannot be cancelled. Please contact support.");
    }

    // Restore ticket quantities
    const ticketsResult = await client.query(
      `SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1`,
      [bookingId]
    );

    for (const ticket of ticketsResult.rows) {
      await client.query(
        `UPDATE ticket_types 
         SET quantity_sold = quantity_sold - $1
         WHERE id = $2`,
        [ticket.quantity, ticket.ticket_type_id]
      );
    }

    // Update booking status
    await client.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
      [bookingId]
    );

    await client.query('COMMIT');

    res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error cancelling booking:", error);
    res.status(500).json({ error: error.message || "Failed to cancel booking" });
  } finally {
    client.release();
  }
});

module.exports = router;