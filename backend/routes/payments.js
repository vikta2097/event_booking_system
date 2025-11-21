const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const { stkPush } = require("./mpesa");
const crypto = require("crypto");
const { generateTicketQR } = require("../utils/ticketUtils");

// Generate a unique transaction reference
const generateTransactionRef = () => {
  return 'PAY-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Validate Kenyan phone number
const validatePhoneNumber = (phone) => {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const patterns = [
    /^254[17]\d{8}$/,     
    /^0[17]\d{8}$/,       
    /^\+254[17]\d{8}$/    
  ];
  return patterns.some(pattern => pattern.test(cleaned));
};

// Format phone number to 254xxxxxxxxx
const formatPhoneNumber = (phone) => {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('0')) return '254' + cleaned.substring(1);
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) return '254' + cleaned;
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

    if (!booking_id) return res.status(400).json({ error: "Booking ID is required" });
    if (!phone) return res.status(400).json({ error: "Phone number is required" });
    if (!validatePhoneNumber(phone)) return res.status(400).json({ error: "Invalid phone number" });

    const formattedPhone = formatPhoneNumber(phone);

    const bookingResult = await db.query("SELECT * FROM bookings WHERE id = $1", [booking_id]);
    if (bookingResult.rows.length === 0) return res.status(404).json({ error: "Booking not found" });

    const booking = bookingResult.rows[0];
    if (booking.user_id !== user_id) return res.status(403).json({ error: "Cannot pay for others' bookings" });
    if (booking.status === 'cancelled') return res.status(400).json({ error: "Cannot pay for cancelled booking" });
    if (booking.status === 'confirmed') return res.status(400).json({ error: "Booking already paid" });

    const existingPayment = await db.query(
      `SELECT id, status FROM payments 
       WHERE booking_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`, [booking_id]
    );
    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ error: "Payment already in progress", payment_id: existingPayment.rows[0].id });
    }

    const amount = Math.ceil(parseFloat(booking.total_amount));
    if (amount < 1) return res.status(400).json({ error: "Invalid payment amount" });

    const accountRef = booking.reference || `Booking${booking_id}`;
    const stkRes = await stkPush({ amount, phone: formattedPhone, accountRef });

    if (!stkRes.CheckoutRequestID) throw new Error("M-Pesa STK Push failed");

    const transactionRef = generateTransactionRef();
    const result = await db.query(
      `INSERT INTO payments 
       (booking_id, user_id, amount, method, status, checkout_request_id, transaction_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, transaction_ref`,
      [booking_id, user_id, amount, 'mpesa', 'pending', stkRes.CheckoutRequestID, transactionRef]
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
    res.status(500).json({ error: err.message || "M-Pesa payment failed. Please try again." });
  }
});

// ======================
// GET payment by booking ID
// ======================
router.get("/by-booking/:booking_id", verifyToken, async (req, res) => {
  try {
    const { booking_id } = req.params;
    const result = await db.query(
      `SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [booking_id]
    );
    if (result.rows.length === 0) return res.json(null);

    const payment = result.rows[0];
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
// GET single payment by ID (with tickets)
// ======================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, b.user_id, b.reference AS booking_reference, b.event_id
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE p.id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Payment not found" });

    const payment = result.rows[0];
    if (req.user.role !== "admin" && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden. Access denied." });
    }

    // Fetch tickets if generated
    if (payment.tickets_generated) {
      const ticketsRes = await db.query(
        "SELECT id AS ticket_id, ticket_type_id, qr_code FROM tickets WHERE booking_id = $1",
        [payment.booking_id]
      );
      payment.tickets = ticketsRes.rows;
    } else {
      payment.tickets = [];
    }

    res.json(payment);

  } catch (err) {
    console.error("Payment fetch error:", err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// ======================
// GET all payments (Admin only) - WITH USER & EVENT NAMES
// ======================
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        p.*,
        b.user_id, 
        b.reference AS booking_reference, 
        b.event_id,
        u.fullname AS user_name,
        u.email AS user_email,
        e.title AS event_title
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN usercredentials u ON b.user_id = u.id
      LEFT JOIN events e ON b.event_id = e.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ======================
// Payment stats (Admin only) - FIXED STRUCTURE
// ======================
router.get("/stats/summary", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM payments");
    const all = result.rows;
    
    const successful = all.filter(p => p.status === "success");
    const totalRevenue = successful.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const pending = all.filter(p => p.status === "pending").length;
    const failed = all.filter(p => p.status === "failed" || p.status === "refunded").length;

    res.json({ 
      total: totalRevenue,  // Frontend expects "total" not "totalRevenue"
      totalRevenue,
      totalPayments: all.length, 
      successful: successful.length, 
      pending, 
      failed 
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ======================
// REFUND payment (Admin only) - NEW ENDPOINT
// ======================
router.put("/refund/:id", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    // Get payment details
    const paymentRes = await client.query(
      "SELECT * FROM payments WHERE id = $1 FOR UPDATE", 
      [req.params.id]
    );
    
    if (paymentRes.rows.length === 0) {
      throw new Error("Payment not found");
    }

    const payment = paymentRes.rows[0];

    // Only allow refunding successful payments
    if (payment.status !== 'success') {
      throw new Error("Only successful payments can be refunded");
    }

    // Update payment to refunded
    await client.query(
      "UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    // Cancel the booking
    await client.query(
      "UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [payment.booking_id]
    );

    // Optionally: Invalidate tickets
    await client.query(
      "UPDATE tickets SET status = 'cancelled' WHERE booking_id = $1",
      [payment.booking_id]
    );

    await client.query("COMMIT");
    res.json({ message: "Payment refunded successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error refunding payment:", err);
    res.status(500).json({ error: err.message || "Failed to refund payment" });
  } finally {
    client.release();
  }
});

// ======================
// UPDATE payment status (Admin only)
// Triggers booking update & ticket generation
// ======================
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "Status is required" });

    await client.query("BEGIN");

    const paymentRes = await client.query("SELECT * FROM payments WHERE id = $1 FOR UPDATE", [req.params.id]);
    if (paymentRes.rows.length === 0) throw new Error("Payment not found");

    const payment = paymentRes.rows[0];

    // Update payment status
    await client.query("UPDATE payments SET status = $1 WHERE id = $2", [status, req.params.id]);

    // Update booking if success
    if (status === 'success') {
      await client.query("UPDATE bookings SET status = 'confirmed' WHERE id = $1", [payment.booking_id]);

      // Generate tickets if not already
      if (!payment.tickets_generated) {
        const bookedTickets = await client.query(
          "SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1",
          [payment.booking_id]
        );

        for (const bt of bookedTickets.rows) {
          for (let i = 0; i < bt.quantity; i++) {
            const qrCode = generateTicketQR();
            await client.query(
              "INSERT INTO tickets (booking_id, ticket_type_id, qr_code) VALUES ($1, $2, $3)",
              [payment.booking_id, bt.ticket_type_id, qrCode]
            );
          }
        }

        // Mark tickets as generated
        await client.query("UPDATE payments SET tickets_generated = true WHERE id = $1", [req.params.id]);
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Payment updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating payment:", err);
    res.status(500).json({ error: err.message || "Failed to update payment" });
  } finally {
    client.release();
  }
});

module.exports = router;
