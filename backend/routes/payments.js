const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const { stkPush } = require("./mpesa");
const crypto = require("crypto");

// Generate a unique transaction reference
const generateTransactionRef = () => {
  return 'PAY-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Validate Kenyan phone number
const validatePhoneNumber = (phone) => {
  // Remove spaces and special characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Check if it matches Kenyan format
  // Accepts: 254xxxxxxxxx, 07xxxxxxxx, 01xxxxxxxx, +254xxxxxxxxx
  const patterns = [
    /^254[17]\d{8}$/,           // 254712345678
    /^0[17]\d{8}$/,             // 0712345678
    /^\+254[17]\d{8}$/          // +254712345678
  ];
  
  return patterns.some(pattern => pattern.test(cleaned));
};

// Format phone number to M-Pesa format (254xxxxxxxxx)
const formatPhoneNumber = (phone) => {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  
  if (cleaned.startsWith('254')) {
    return cleaned;
  } else if (cleaned.startsWith('0')) {
    return '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    return '254' + cleaned;
  }
  
  return cleaned;
};

// ======================
// POST /payments/mpesa
// Trigger M-Pesa STK Push
// ======================
router.post("/mpesa", verifyToken, async (req, res) => {
  try {
    const { booking_id, phone } = req.body;
    const user_id = req.user.id;

    if (!booking_id) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Validate phone number
    if (!validatePhoneNumber(phone)) {
      return res.status(400).json({ 
        error: "Invalid phone number. Use format: 0712345678 or 254712345678" 
      });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);

    // Verify booking exists and belongs to user
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

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: "Cannot pay for cancelled booking" });
    }

    if (booking.status === 'confirmed') {
      return res.status(400).json({ error: "Booking already paid" });
    }

    // Check if there's already a pending payment
    const existingPayment = await db.query(
      `SELECT id, status FROM payments 
       WHERE booking_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [booking_id]
    );

    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ 
        error: "Payment already in progress",
        payment_id: existingPayment.rows[0].id
      });
    }

    // Round amount to nearest integer (M-Pesa doesn't accept decimals)
    const amount = Math.ceil(parseFloat(booking.total_amount));

    if (amount < 1) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    // Trigger STK Push
    const accountRef = booking.reference || `Booking${booking_id}`;
    
    const stkRes = await stkPush({
      amount,
      phone: formattedPhone,
      accountRef,
    });

    if (!stkRes.CheckoutRequestID) {
      throw new Error("M-Pesa STK Push failed");
    }

    // Save payment record as pending
    const transactionRef = generateTransactionRef();
    
    const result = await db.query(
      `INSERT INTO payments 
       (booking_id, user_id, amount, method, status, checkout_request_id, transaction_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, transaction_ref`,
      [
        booking_id, 
        user_id, 
        amount, 
        'mpesa', 
        'pending', 
        stkRes.CheckoutRequestID,
        transactionRef
      ]
    );

    res.json({
      message: "STK Push sent successfully. Check your phone to complete payment.",
      payment_id: result.rows[0].id,
      transaction_ref: result.rows[0].transaction_ref,
      checkout_request_id: stkRes.CheckoutRequestID,
      merchant_request_id: stkRes.MerchantRequestID
    });

  } catch (err) {
    console.error("M-Pesa payment error:", err);
    res.status(500).json({ 
      error: err.message || "M-Pesa payment failed. Please try again." 
    });
  }
});

// ======================
// Daraja STK Push callback
// ======================


// ======================
// GET payment by booking ID
// ======================
router.get("/by-booking/:booking_id", verifyToken, async (req, res) => {
  try {
    const { booking_id } = req.params;

    const result = await db.query(
      `SELECT p.* FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE p.booking_id = $1
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [booking_id]
    );

    if (result.rows.length === 0) {
      return res.json(null);
    }

    const payment = result.rows[0];

    // Users can only see their own payments
    if (payment.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(payment);
  } catch (err) {
    console.error("Error fetching payment:", err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// ======================
// GET single payment by ID
// ======================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        p.*, 
        b.id AS booking_id, 
        b.reference AS booking_reference,
        b.user_id, 
        b.event_id, 
        u.fullname AS user_name,
        u.email AS user_email,
        e.title AS event_title
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN usercredentials u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      WHERE p.id = $1`,
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
// GET all payments (Admin only)
// ======================
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.*, 
        b.id AS booking_id,
        b.reference AS booking_reference,
        b.user_id, 
        b.event_id, 
        u.fullname AS user_name,
        u.email AS user_email,
        e.title AS event_title
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN usercredentials u ON b.user_id = u.id
      JOIN events e ON b.event_id = e.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ======================
// Payment stats (Admin only)
// ======================
router.get("/stats/summary", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM payments");
    const all = result.rows;
    
    const totalRevenue = all
      .filter(p => p.status === "success")
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    
    const pending = all.filter(p => p.status === "pending").length;
    const successful = all.filter(p => p.status === "success").length;
    const failed = all.filter(p => p.status === "failed").length;
    
    res.json({ 
      totalRevenue,
      totalPayments: all.length,
      successful,
      pending,
      failed
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ======================
// Update payment (Admin only)
// ======================
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const existingResult = await db.query(
      "SELECT * FROM payments WHERE id = $1", 
      [req.params.id]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    await db.query(
      "UPDATE payments SET status = $1 WHERE id = $2", 
      [status, req.params.id]
    );

    // If marking as success, update booking
    if (status === 'success') {
      const payment = existingResult.rows[0];
      await db.query(
        "UPDATE bookings SET status = 'confirmed' WHERE id = $1",
        [payment.booking_id]
      );
    }
    
    res.json({ message: "Payment updated successfully" });
  } catch (err) {
    console.error("Error updating payment:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

const { generateTicketQR } = require("../utils/ticketUtils");

router.get("/:id", verifyToken, async (req, res) => {
  try {
    const paymentId = req.params.id;

    const paymentRes = await db.query(
      "SELECT * FROM payments WHERE id = $1",
      [paymentId]
    );

    if (paymentRes.rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = paymentRes.rows[0];

    // If payment is now success and tickets not yet generated
    if (payment.status === "success" && !payment.tickets_generated) {
      const bookingId = payment.booking_id;

      const bookedTickets = await db.query(
        "SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1",
        [bookingId]
      );

      for (const bt of bookedTickets.rows) {
        for (let i = 0; i < bt.quantity; i++) {
          const qrCode = generateTicketQR();
          await db.query(
            "INSERT INTO tickets (booking_id, ticket_type_id, qr_code) VALUES ($1, $2, $3)",
            [bookingId, bt.ticket_type_id, qrCode]
          );
        }
      }

      // Mark tickets as generated
      await db.query(
        "UPDATE payments SET tickets_generated = true WHERE id = $1",
        [paymentId]
      );
    }

    res.json(payment);
  } catch (err) {
    console.error("Payment fetch error:", err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});


module.exports = router;