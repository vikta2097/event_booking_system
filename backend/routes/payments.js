// backend/routes/payments.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const { stkPush } = require("../mpesa");

// ======================
// POST /payments/mpesa
// Trigger M-Pesa STK Push
// ======================
router.post("/mpesa", verifyToken, async (req, res) => {
  try {
    const { booking_id, phone } = req.body;
    const user_id = req.user.id;

    // Verify booking exists
    const [bookings] = await db.promise.query(
      "SELECT * FROM bookings WHERE id = ?",
      [booking_id]
    );
    if (!bookings.length) return res.status(404).json({ error: "Booking not found" });

    const booking = bookings[0];
    if (booking.user_id !== user_id)
      return res.status(403).json({ error: "Cannot pay for others' bookings" });

    // Trigger STK Push
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const stkRes = await stkPush({
      amount: booking.total_amount,
      phone,
      accountRef: `Booking${booking_id}`,
      callbackUrl,
    });

    // Save payment record as pending, store CheckoutRequestID for callback
    const [result] = await db.promise.query(
      `INSERT INTO payments 
       (booking_id, user_id, amount, method, status, checkout_request_id)
       VALUES (?, ?, ?, 'mpesa', 'pending', ?)`,
      [booking_id, user_id, booking.total_amount, stkRes.CheckoutRequestID]
    );

    res.json({
      message: "STK Push initiated",
      data: stkRes,
      payment_id: result.insertId,
    });
  } catch (err) {
    console.error("M-Pesa payment error:", err);
    res.status(500).json({ error: "M-Pesa payment failed" });
  }
});

// ======================
// Daraja STK Push callback
// ======================
router.post("/mpesa/callback", async (req, res) => {
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback || !stkCallback.CheckoutRequestID) return res.status(400).end();

    const { ResultCode, CheckoutRequestID } = stkCallback;

    // Find the payment record using CheckoutRequestID
    const [payments] = await db.promise.query(
      "SELECT * FROM payments WHERE checkout_request_id = ?",
      [CheckoutRequestID]
    );

    if (!payments.length) return res.status(404).end();

    const payment = payments[0];

    if (ResultCode === 0) {
      // Payment successful
      await db.promise.query(
        "UPDATE payments SET status = 'success', paid_at = NOW() WHERE id = ?",
        [payment.id]
      );
    } else {
      // Payment failed or canceled
      await db.promise.query(
        "UPDATE payments SET status = 'failed' WHERE id = ?",
        [payment.id]
      );
    }

    res.json({ message: "Callback processed successfully" });
  } catch (err) {
    console.error("Daraja callback error:", err);
    res.status(500).end();
  }
});

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

    if (!payments.length) return res.status(404).json({ error: "Payment not found" });

    res.json(payments[0]);
  } catch (err) {
    console.error("Error fetching payment:", err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// ======================
// Payment stats (Admin only)
// ======================
router.get("/stats", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [all] = await db.promise.query("SELECT * FROM payments");
    const total = all.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const pending = all.filter(p => p.status === "pending").length;
    const failed = all.filter(p => p.status === "failed" || p.status === "refunded").length;
    res.json({ total, pending, failed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ======================
// Refund payment (Admin only)
// ======================
router.put("/refund/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [existing] = await db.promise.query("SELECT * FROM payments WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: "Payment not found" });
    if (existing[0].status !== "success") return res.status(400).json({ error: "Only successful payments can be refunded" });

    await db.promise.query("UPDATE payments SET status = 'refunded' WHERE id = ?", [req.params.id]);
    res.json({ message: "Payment refunded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to refund payment" });
  }
});

// ======================
// Create, Update, Delete payments (Admin or user)
// ======================
router.post("/", verifyToken, async (req, res) => {
  try {
    const { booking_id, amount, method, status } = req.body;
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (!booking_id || !amount || !method) return res.status(400).json({ error: "booking_id, amount, and method are required" });

    const [bookings] = await db.promise.query("SELECT * FROM bookings WHERE id = ?", [booking_id]);
    if (!bookings.length) return res.status(404).json({ error: "Booking not found" });

    const booking = bookings[0];
    if (user_role !== "admin" && booking.user_id !== user_id) return res.status(403).json({ error: "Forbidden. Cannot pay for others' bookings." });

    const [result] = await db.promise.query(
      "INSERT INTO payments (booking_id, amount, method, status) VALUES (?, ?, ?, ?)",
      [booking_id, amount, method, status || "pending"]
    );
    res.status(201).json({ message: "Payment created", payment_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { amount, method, status } = req.body;
    const [existing] = await db.promise.query("SELECT * FROM payments WHERE id = ?", [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: "Payment not found" });

    const updateFields = [];
    const values = [];
    if (amount !== undefined) { updateFields.push("amount = ?"); values.push(amount); }
    if (method) { updateFields.push("method = ?"); values.push(method); }
    if (status) { updateFields.push("status = ?"); values.push(status); }
    if (!updateFields.length) return res.status(400).json({ error: "No fields to update" });

    values.push(req.params.id);
    await db.promise.query(`UPDATE payments SET ${updateFields.join(", ")} WHERE id = ?`, values);
    res.json({ message: "Payment updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [result] = await db.promise.query("DELETE FROM payments WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Payment not found" });
    res.json({ message: "Payment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

module.exports = router;
