const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const { stkPush } = require("./mpesa");
const crypto = require("crypto");
const { generateTicketCodes } = require("../utils/ticketUtils");

// Import notification functions
const {
  sendNotification,
  broadcastNotification,
} = require("./notifications");

// Generate transaction ref
const generateTransactionRef = () => {
  return "PAY-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();
};

// Validate Kenyan phone number (accepts +254, 254, 07, or 7 formats)
const validatePhoneNumber = (phone) => {
  if (!phone) return false;
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[\s\-()]/g, "");
  
  // Valid patterns for Kenyan Safaricom numbers
  const patterns = [
    /^254[17]\d{8}$/,        // 254712345678
    /^\+254[17]\d{8}$/,      // +254712345678
    /^0[17]\d{8}$/,          // 0712345678
    /^[17]\d{8}$/            // 712345678
  ];
  
  return patterns.some((pattern) => pattern.test(cleaned));
};

// Format phone number to M-Pesa format (254XXXXXXXXX - 12 digits, no +)
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");
  
  // Already in correct format (254XXXXXXXXX)
  if (cleaned.startsWith("254") && cleaned.length === 12) {
    return cleaned;
  }
  
  // Format: 0712345678 -> 254712345678
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "254" + cleaned.substring(1);
  }
  
  // Format: 712345678 -> 254712345678
  if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9) {
    return "254" + cleaned;
  }
  
  // If none of the above patterns match, return as-is (will fail validation later)
  return cleaned;
};

// ==============================
// POST /payments/mpesa
// ==============================
router.post("/mpesa", verifyToken, async (req, res) => {
  const debugLogs = [];
  
  try {
    const { booking_id, phone } = req.body;
    const user_id = req.user.id;

    debugLogs.push({ step: "Received request", booking_id, phone });

    // Validation checks
    if (!booking_id) {
      return res.status(400).json({ error: "Booking ID is required", debugLogs });
    }
    
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required", debugLogs });
    }
    
    if (!validatePhoneNumber(phone)) {
  return res.status(400).json({ 
    error: "Invalid phone number. Use format: +254712345678, 0712345678, +254112345678, or 0112345678", 
    debugLogs 
  });
}


    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    
    // Additional validation after formatting
    if (formattedPhone.length !== 12) {
      debugLogs.push({ 
        step: "Phone format validation failed", 
        original: phone,
        formatted: formattedPhone,
        length: formattedPhone.length 
      });
      return res.status(400).json({ 
        error: `Invalid phone format. Expected 12 digits, got ${formattedPhone.length}`,
        formatted: formattedPhone,
        debugLogs 
      });
    }
    
    if (!formattedPhone.startsWith("254")) {
      debugLogs.push({ 
        step: "Phone prefix validation failed", 
        formatted: formattedPhone 
      });
      return res.status(400).json({ 
        error: "Phone number must be a Kenyan number (254)",
        formatted: formattedPhone,
        debugLogs 
      });
    }
    
    // Check if it's a Safaricom number (starts with 2547 or 2541)
    if (!["7", "1"].includes(formattedPhone[3])) {
      debugLogs.push({ 
        step: "Network validation failed", 
        formatted: formattedPhone,
        fourthDigit: formattedPhone[3]
      });
      return res.status(400).json({ 
        error: "Only Safaricom numbers are supported (2547XX or 2541XX)",
        formatted: formattedPhone,
        debugLogs 
      });
    }

    debugLogs.push({ 
      step: "Phone number validated and formatted", 
      original: phone,
      formatted: formattedPhone,
      length: formattedPhone.length
    });

    // Fetch booking
    const bookingResult = await db.query(
      "SELECT * FROM bookings WHERE id = $1", 
      [booking_id]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found", debugLogs });
    }

    const booking = bookingResult.rows[0];
    debugLogs.push({ step: "Fetched booking", booking_id: booking.id, status: booking.status });

    // Authorization check
    if (booking.user_id !== user_id) {
      return res.status(403).json({ error: "Cannot pay for others' bookings", debugLogs });
    }

    // Booking status checks
    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Cannot pay for cancelled booking", debugLogs });
    }

    if (booking.status === "confirmed") {
      return res.status(400).json({ error: "Booking already paid", debugLogs });
    }

    // Check for existing pending payment
    const existingPayment = await db.query(
      `SELECT id, status FROM payments 
       WHERE booking_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [booking_id]
    );

    if (existingPayment.rows.length > 0) {
      return res.status(400).json({
        error: "Payment already in progress",
        payment_id: existingPayment.rows[0].id,
        debugLogs
      });
    }

    // Calculate amount
    const amount = Math.ceil(parseFloat(booking.total_amount) || 0);
    debugLogs.push({ step: "Computed amount", amount });

    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid payment amount", debugLogs });
    }

    const accountRef = booking.reference || `Booking${booking_id}`;

    // Attempt STK Push
    let stkRes;
    try {
      console.log("🔄 Initiating STK Push...");
      console.log("📱 Phone:", formattedPhone);
      console.log("💰 Amount:", amount, "KES");
      console.log("📋 Account Ref:", accountRef);
      
      stkRes = await stkPush({ amount, phone: formattedPhone, accountRef });

      // Mask sensitive info before logging
      const safeStkRes = { ...stkRes };
      if (safeStkRes.Password) safeStkRes.Password = "****";

      console.log("✅ STK Push successful:", safeStkRes);
      debugLogs.push({ step: "STK Push response", response: safeStkRes });
      
    } catch (err) {
      console.error("❌ STK Push failed:", err.response?.data || err.message);
      debugLogs.push({ 
        step: "STK Push error", 
        error: err.response?.data || err.message 
      });
      return res.status(500).json({ 
        error: "M-Pesa STK Push failed. Please try again.", 
        details: err.response?.data?.errorMessage || err.message,
        debugLogs 
      });
    }

    // Verify STK Push response
    if (!stkRes.CheckoutRequestID) {
      debugLogs.push({ step: "Missing CheckoutRequestID in STK response", stkRes });
      return res.status(500).json({ 
        error: "M-Pesa STK Push failed: No CheckoutRequestID returned", 
        debugLogs 
      });
    }
    
    // Check response code (0 = success)
    if (stkRes.ResponseCode && stkRes.ResponseCode !== "0") {
      debugLogs.push({ 
        step: "M-Pesa rejected request",
        code: stkRes.ResponseCode,
        description: stkRes.ResponseDescription
      });
      return res.status(400).json({ 
        error: stkRes.ResponseDescription || stkRes.CustomerMessage || "M-Pesa request failed",
        response_code: stkRes.ResponseCode,
        debugLogs 
      });
    }

    const transactionRef = generateTransactionRef();

    // Insert payment record
    const result = await db.query(
      `INSERT INTO payments 
       (booking_id, user_id, amount, method, status, checkout_request_id, transaction_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, transaction_ref`,
      [booking_id, user_id, amount, "mpesa", "pending", stkRes.CheckoutRequestID, transactionRef]
    );

    debugLogs.push({ step: "Inserted payment record", payment_id: result.rows[0].id });

    // Send notification
    try {
      await sendNotification(
        user_id,
        "Payment Initiated",
        `M-Pesa payment for booking ${booking.reference} has been initiated. Check your phone to complete.`
      );
      debugLogs.push({ step: "Notification sent" });
    } catch (notifErr) {
      console.error("Failed to send notification:", notifErr);
      debugLogs.push({ step: "Notification failed", error: notifErr.message });
    }

    res.json({
      message: "STK Push sent successfully. Check your phone to enter PIN.",
      payment_id: result.rows[0].id,
      transaction_ref: result.rows[0].transaction_ref,
      checkout_request_id: stkRes.CheckoutRequestID,
      merchant_request_id: stkRes.MerchantRequestID,
      debugLogs
    });

  } catch (err) {
    console.error("M-Pesa payment error:", err);
    res.status(500).json({
      error: err.message || "M-Pesa payment failed. Please try again.",
      debugLogs
    });
  }
});

// ==============================
// ADMIN — GET /payments (with user + event info)
// ==============================
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
    console.error("Failed to fetch payments:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ==============================
// GET /payments/by-booking/:id
// ==============================
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
    console.error("Failed to fetch payment:", err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// ==============================
// GET /payments/:id — admin or owner
// ==============================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, b.user_id, b.reference AS booking_reference, b.event_id
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = result.rows[0];

    if (req.user.role !== "admin" && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (payment.tickets_generated) {
      const ticketsRes = await db.query(
        "SELECT id AS ticket_id, ticket_type_id, qr_code, manual_code FROM tickets WHERE booking_id = $1",
        [payment.booking_id]
      );
      payment.tickets = ticketsRes.rows;
    } else {
      payment.tickets = [];
    }

    res.json(payment);
  } catch (err) {
    console.error("Failed to fetch payment:", err);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
});

// ==============================
// ADMIN — Refund payment
// ==============================
router.put("/refund/:id", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const paymentRes = await client.query(
      "SELECT * FROM payments WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );

    if (paymentRes.rows.length === 0) {
      throw new Error("Payment not found");
    }

    const payment = paymentRes.rows[0];

    if (payment.status !== "success") {
      throw new Error("Only successful payments can be refunded");
    }

    await client.query(
      "UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    await client.query(
      "UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [payment.booking_id]
    );

    await client.query(
      "UPDATE tickets SET status = 'cancelled' WHERE booking_id = $1",
      [payment.booking_id]
    );

    await client.query("COMMIT");

    // Notify user (outside transaction)
    try {
      await sendNotification(
        payment.user_id,
        "Payment Refunded",
        `Your payment for booking ${payment.booking_id} has been refunded.`
      );
    } catch (notifErr) {
      console.error("Failed to send refund notification:", notifErr);
    }

    res.json({ message: "Payment refunded successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Refund error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==============================
// ADMIN — Update payment status
// ==============================
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    await client.query("BEGIN");

    const paymentRes = await client.query(
      "SELECT * FROM payments WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );

    if (paymentRes.rows.length === 0) {
      throw new Error("Payment not found");
    }

    const payment = paymentRes.rows[0];

    await client.query(
      "UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, req.params.id]
    );

    if (status === "success") {
      await client.query(
        "UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1",
        [payment.booking_id]
      );

      // Generate tickets if not already generated
      if (!payment.tickets_generated) {
        const bookedTickets = await client.query(
          "SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1",
          [payment.booking_id]
        );

        for (const bt of bookedTickets.rows) {
          for (let i = 0; i < bt.quantity; i++) {
            const { qr_code, manual_code } = generateTicketCodes();
            await client.query(
              "INSERT INTO tickets (booking_id, ticket_type_id, qr_code, manual_code) VALUES ($1, $2, $3, $4)",
              [payment.booking_id, bt.ticket_type_id, qr_code, manual_code]
            );
          }
        }

        await client.query(
          "UPDATE payments SET tickets_generated = true WHERE id = $1",
          [req.params.id]
        );
      }
    }

    await client.query("COMMIT");

    // Send notifications (outside transaction)
    try {
      if (status === "success") {
        await sendNotification(
          payment.user_id,
          "Payment Successful",
          `Your payment for booking ${payment.booking_id} has been confirmed. Tickets are now available.`
        );
      } else if (status === "failed") {
        await sendNotification(
          payment.user_id,
          "Payment Failed",
          "Your M-Pesa payment attempt failed. Please try again."
        );
      }
    } catch (notifErr) {
      console.error("Failed to send payment status notification:", notifErr);
    }

    res.json({ message: "Payment updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Payment update error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
