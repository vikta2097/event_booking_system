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
        u.phone AS user_phone
      FROM bookings b
      INNER JOIN events e ON b.event_id = e.id
      INNER JOIN usercredentials u ON b.user_id = u.id
    `;

    if (!isAdmin) {
      query += " WHERE b.user_id = ?";
    }

    query += " ORDER BY b.booking_date DESC";

    const [bookings] = isAdmin
      ? await db.promise.query(query)
      : await db.promise.query(query, [userId]);

    res.json(bookings);
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
        u.fullname AS user_name,
        u.email AS user_email,
        u.phone AS user_phone
      FROM bookings b
      INNER JOIN events e ON b.event_id = e.id
      INNER JOIN usercredentials u ON b.user_id = u.id
      WHERE b.id = ?
    `;

    const [bookings] = await db.promise.query(query, [bookingId]);

    if (bookings.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (!isAdmin && bookings[0].user_id !== userId) {
      return res.status(403).json({ error: "Forbidden. Access denied." });
    }

    res.json(bookings[0]);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// ======================
// POST create new booking
// ======================
router.post("/", verifyToken, async (req, res) => {
  try {
    const { event_id, seats, total_amount, status } = req.body;
    const user_id = req.user.id;

    if (!event_id || !seats) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check event capacity
    const [events] = await db.promise.query(
      "SELECT capacity FROM events WHERE id = ?",
      [event_id]
    );

    if (events.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const [currentBookings] = await db.promise.query(
      'SELECT SUM(seats) as total_seats FROM bookings WHERE event_id = ? AND status != "cancelled"',
      [event_id]
    );

    const bookedSeats = currentBookings[0].total_seats || 0;
    const availableSeats = events[0].capacity - bookedSeats;

    if (seats > availableSeats) {
      return res
        .status(400)
        .json({ error: `Only ${availableSeats} seats available` });
    }

    const [result] = await db.promise.query(
      `INSERT INTO bookings (user_id, event_id, seats, total_amount, status)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, event_id, seats, total_amount || 0, status || "pending"]
    );

    res.status(201).json({
      message: "Booking created successfully",
      booking_id: result.insertId,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
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

    const [existing] = await db.promise.query(
      "SELECT * FROM bookings WHERE id = ?",
      [bookingId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const updateFields = [];
    const values = [];

    if (status) {
      updateFields.push("status = ?");
      values.push(status);
    }
    if (seats !== undefined) {
      updateFields.push("seats = ?");
      values.push(seats);
    }
    if (total_amount !== undefined) {
      updateFields.push("total_amount = ?");
      values.push(total_amount);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(bookingId);

    await db.promise.query(
      `UPDATE bookings SET ${updateFields.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ message: "Booking updated successfully" });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Failed to update booking" });
  }
});

// ======================
// DELETE booking
// Admin only
// ======================
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;

    const [result] = await db.promise.query(
      "DELETE FROM bookings WHERE id = ?",
      [bookingId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Failed to delete booking" });
  }
});

module.exports = router;
