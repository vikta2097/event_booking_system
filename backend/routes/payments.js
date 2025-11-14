const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const { stkPush } = require("./mpesa");

// ======================
// POST /payments/mpesa
// Trigger M-Pesa STK Push
// ======================
router.post("/mpesa", verifyToken, async (req, res) => {
  try {
    const { booking_id, phone } = req.body;
    const user_id = req.user.id;

    // Verify booking exists
    const bookingResult = await db.query(
      "SELECT * FROM bookings WHERE id = $1",
      [booking_id]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bookingResult.rows[0];
    
    if (booking.user_id !== user_id) {
      return res.status(403).json({ error: "Cannot pay for others' bookings" });
    }

    // Trigger STK Push
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const stkRes = await stkPush({
      amount: booking.total_amount,
      phone,
      accountRef: `Booking${booking_id}`,
      callbackUrl,
    });

    // Save payment record as pending, store CheckoutRequestID for callback
    const result = await db.query(
      `INSERT INTO payments 
       (booking_id, user_id, amount, method, status, checkout_request_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [booking_id, user_id, booking.total_amount, 'mpesa', 'pending', stkRes.CheckoutRequestID]
    );

    res.json({
      message: "STK Push initiated",
      data: stkRes,
      payment_id: result.rows[0].id,
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
    if (!stkCallback || !stkCallback.CheckoutRequestID) {
      return res.status(400).end();
    }

    const { ResultCode, CheckoutRequestID } = stkCallback;

    // Find the payment record using CheckoutRequestID
    const paymentResult = await db.query(
      "SELECT * FROM payments WHERE checkout_request_id = $1",
      [CheckoutRequestID]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).end();
    }

    const payment = paymentResult.rows[0];

    if (ResultCode === 0) {
      // Payment successful
      await db.query(
        "UPDATE payments SET status = $1, paid_at = NOW() WHERE id = $2",
        ['success', payment.id]
      );
      
      // Update booking status to confirmed
      await db.query(
        "UPDATE bookings SET status = $1 WHERE id = $2",
        ['confirmed', payment.booking_id]
      );
    } else {
      // Payment failed or canceled
      await db.query(
        "UPDATE payments SET status = $1 WHERE id = $2",
        ['failed', payment.id]
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
    const result = await db.query(`
      SELECT 
        p.*, 
        b.id AS booking_id, 
        b.user_id, 
        b.event_id, 
        u.fullname AS user_name, 
        e.title AS event_title
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN usercredentials u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      ORDER BY p.paid_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ======================
// GET single payment by ID (User can check their own, Admin can check any)
// ======================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT 
        p.*, 
        b.id AS booking_id, 
        b.user_id, 
        b.event_id, 
        u.fullname AS user_name, 
        e.title AS event_title
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN usercredentials u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      WHERE p.id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = result.rows[0];

    // Allow user to check their own payment or admin to check any
    if (req.user.role !== "admin" && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden. Access denied." });
    }

    res.json(payment);
  } catch (err) {
    console.error("Error fetching payment:", err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// ======================
// Payment stats (Admin only)
// ======================
router.get("/stats/summary", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM payments");
    const all = result.rows;
    
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
    const existingResult = await db.query(
      "SELECT * FROM payments WHERE id = $1", 
      [req.params.id]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    if (existingResult.rows[0].status !== "success") {
      return res.status(400).json({ error: "Only successful payments can be refunded" });
    }

    await db.query(
      "UPDATE payments SET status = $1 WHERE id = $2", 
      ['refunded', req.params.id]
    );
    
    res.json({ message: "Payment refunded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to refund payment" });
  }
});

// ======================
// Create payment (Admin or user for their own booking)
// ======================
router.post("/", verifyToken, async (req, res) => {
  try {
    const { booking_id, amount, method, status } = req.body;
    const user_id = req.user.id;
    const user_role = req.user.role;

    if (!booking_id || !amount || !method) {
      return res.status(400).json({ error: "booking_id, amount, and method are required" });
    }

    const bookingResult = await db.query(
      "SELECT * FROM bookings WHERE id = $1", 
      [booking_id]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bookingResult.rows[0];
    
    if (user_role !== "admin" && booking.user_id !== user_id) {
      return res.status(403).json({ error: "Forbidden. Cannot pay for others' bookings." });
    }

    const result = await db.query(
      "INSERT INTO payments (booking_id, user_id, amount, method, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [booking_id, user_id, amount, method, status || "pending"]
    );
    
    res.status(201).json({ 
      message: "Payment created", 
      payment_id: result.rows[0].id 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});

// ======================
// Update payment (Admin only)
// ======================
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { amount, method, status } = req.body;
    
    const existingResult = await db.query(
      "SELECT * FROM payments WHERE id = $1", 
      [req.params.id]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (amount !== undefined) { 
      updateFields.push(`amount = $${paramCount}`); 
      values.push(amount); 
      paramCount++;
    }
    if (method) { 
      updateFields.push(`method = $${paramCount}`); 
      values.push(method); 
      paramCount++;
    }
    if (status) { 
      updateFields.push(`status = $${paramCount}`); 
      values.push(status); 
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.id);
    
    await db.query(
      `UPDATE payments SET ${updateFields.join(", ")} WHERE id = $${paramCount}`, 
      values
    );
    
    res.json({ message: "Payment updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// Get the most recent payment for a booking (user only)
router.get("/by-booking/:booking_id", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM payments 
       WHERE booking_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.params.booking_id]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    const payment = result.rows[0];

    // Users can only see their own payment
    if (payment.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});


// ======================
// Delete payment (Admin only)
// ======================
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM payments WHERE id = $1", 
      [req.params.id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    res.json({ message: "Payment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});

module.exports = router;