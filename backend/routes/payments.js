// backend/routes/payments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ======================
// GET all payments (Admin only)
// ======================
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [payments] = await db.promise.query(`
      SELECT p.*, b.id AS booking_id, b.user_id, b.event_id, u.fullname AS user_name, e.title AS event_title
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN usercredentials u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      ORDER BY p.paid_at DESC
    `);

    res.json(payments);
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ======================
// GET single payment by ID (Admin only)
// ======================
router.get("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [payments] = await db.promise.query(
      `
      SELECT p.*, b.id AS booking_id, b.user_id, b.event_id, u.fullname AS user_name, e.title AS event_title
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN usercredentials u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      WHERE p.id = ?
    `,
      [req.params.id]
    );

    if (payments.length === 0)
      return res.status(404).json({ error: "Payment not found" });

    res.json(payments[0]);
  } catch (err) {
    console.error("Error fetching payment:", err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// ======================
// CREATE a new payment (Admin or user for their own booking)
// ======================
router.post("/", verifyToken, async (req, res) => {
  try {
    const { booking_id, amount, method, status } = req.body;
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (!booking_id || !amount || !method)
      return res
        .status(400)
        .json({ error: "booking_id, amount, and method are required" });

    // Verify booking exists
    const [bookings] = await db.promise.query(
      "SELECT * FROM bookings WHERE id = ?",
      [booking_id]
    );

    if (bookings.length === 0)
      return res.status(404).json({ error: "Booking not found" });

    const booking = bookings[0];

    // Regular users can only pay for their own bookings
    if (user_role !== "admin" && booking.user_id !== user_id) {
      return res
        .status(403)
        .json({ error: "Forbidden. Cannot pay for others' bookings." });
    }

    const [result] = await db.promise.query(
      `
      INSERT INTO payments (booking_id, amount, method, status)
      VALUES (?, ?, ?, ?)
    `,
      [booking_id, amount, method, status || "pending"]
    );

    res
      .status(201)
      .json({ message: "Payment created", payment_id: result.insertId });
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// ======================
// UPDATE payment (Admin only)
// ======================
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { amount, method, status } = req.body;

    const [existing] = await db.promise.query(
      "SELECT * FROM payments WHERE id = ?",
      [req.params.id]
    );

    if (existing.length === 0)
      return res.status(404).json({ error: "Payment not found" });

    const updateFields = [];
    const values = [];

    if (amount !== undefined) {
      updateFields.push("amount = ?");
      values.push(amount);
    }
    if (method) {
      updateFields.push("method = ?");
      values.push(method);
    }
    if (status) {
      updateFields.push("status = ?");
      values.push(status);
    }

    if (updateFields.length === 0)
      return res.status(400).json({ error: "No fields to update" });

    values.push(req.params.id);

    await db.promise.query(
      `UPDATE payments SET ${updateFields.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ message: "Payment updated" });
  } catch (err) {
    console.error("Error updating payment:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// ======================
// DELETE payment (Admin only)
// ======================
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [result] = await db.promise.query(
      "DELETE FROM payments WHERE id = ?",
      [req.params.id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Payment not found" });

    res.json({ message: "Payment deleted" });
  } catch (err) {
    console.error("Error deleting payment:", err);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

module.exports = router;
