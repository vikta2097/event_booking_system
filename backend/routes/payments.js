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

// ==============================
// SOCKET HELPERS
// ==============================
const emitToUser = (userId, event, payload) => {
  if (global.io) {
    global.io.to(`user_${userId}`).emit(event, payload);
  }
};

const emitToAdmins = (event, payload) => {
  if (global.io) {
    global.io.emit(event, payload);
  }
};

// ==============================
// Helpers
// ==============================
const generateTransactionRef = () => {
  return "PAY-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();
};

const validatePhoneNumber = (phone) => {
  if (!phone) return false;

  const cleaned = phone.replace(/[\s\-()]/g, "");

  const patterns = [
    /^254[17]\d{8}$/,
    /^\+254[17]\d{8}$/,
    /^0[17]\d{8}$/,
    /^[17]\d{8}$/
  ];

  return patterns.some((pattern) => pattern.test(cleaned));
};

const formatPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.substring(1);
  if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9) return "254" + cleaned;

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

    if (!booking_id || !phone) {
      return res.status(400).json({ error: "Missing required fields", debugLogs });
    }

    if (!validatePhoneNumber(phone)) {
      return res.status(400).json({
        error: "Invalid phone number",
        debugLogs
      });
    }

    const formattedPhone = formatPhoneNumber(phone);

    const bookingResult = await db.query(
      "SELECT * FROM bookings WHERE id = $1",
      [booking_id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bookingResult.rows[0];

    if (booking.user_id !== user_id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const amount = Math.ceil(parseFloat(booking.total_amount));

    const stkRes = await stkPush({
      amount,
      phone: formattedPhone,
      accountRef: booking.reference
    });

    const transactionRef = generateTransactionRef();

    const result = await db.query(
      `INSERT INTO payments 
       (booking_id, user_id, amount, method, status, checkout_request_id, transaction_ref)
       VALUES ($1,$2,$3,'mpesa','pending',$4,$5)
       RETURNING id`,
      [booking_id, user_id, amount, stkRes.CheckoutRequestID, transactionRef]
    );

    // ==============================
    // SOCKET: PAYMENT INITIATED
    // ==============================
    emitToUser(user_id, "payment_initiated", {
      booking_id,
      amount,
      status: "pending"
    });

    emitToAdmins("admin_payment_event", {
      type: "initiated",
      booking_id,
      amount
    });

    await sendNotification(
      user_id,
      "Payment Initiated",
      `M-Pesa request sent for booking ${booking.reference}`
    );

    res.json({
      message: "STK Push sent",
      payment_id: result.rows[0].id
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});

// ==============================
// ADMIN: UPDATE PAYMENT STATUS
// ==============================
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();

  try {
    const { status } = req.body;

    await client.query("BEGIN");

    const paymentRes = await client.query(
      "SELECT * FROM payments WHERE id = $1 FOR UPDATE",
      [req.params.id]
    );

    const payment = paymentRes.rows[0];

    await client.query(
      "UPDATE payments SET status = $1 WHERE id = $2",
      [status, req.params.id]
    );

    if (status === "success") {
      await client.query(
        "UPDATE bookings SET status = 'confirmed' WHERE id = $1",
        [payment.booking_id]
      );

      // Generate tickets
      const bookedTickets = await client.query(
        "SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1",
        [payment.booking_id]
      );

      for (const bt of bookedTickets.rows) {
        for (let i = 0; i < bt.quantity; i++) {
          const { qr_code, manual_code } = generateTicketCodes();

          await client.query(
            "INSERT INTO tickets (booking_id, ticket_type_id, qr_code, manual_code) VALUES ($1,$2,$3,$4)",
            [payment.booking_id, bt.ticket_type_id, qr_code, manual_code]
          );
        }
      }

      await client.query(
        "UPDATE payments SET tickets_generated = true WHERE id = $1",
        [req.params.id]
      );

      // ==============================
      // SOCKET: PAYMENT SUCCESS
      // ==============================
      emitToUser(payment.user_id, "payment_success", {
        booking_id: payment.booking_id,
        payment_id: payment.id
      });

      emitToAdmins("admin_payment_event", {
        type: "success",
        booking_id: payment.booking_id
      });

    } else if (status === "failed") {

      // ==============================
      // SOCKET: PAYMENT FAILED
      // ==============================
      emitToUser(payment.user_id, "payment_failed", {
        booking_id: payment.booking_id
      });

    }

    await client.query("COMMIT");

    res.json({ message: "Payment updated" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==============================
// REFUND (ADMIN)
// ==============================
router.put("/refund/:id", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const paymentRes = await client.query(
      "SELECT * FROM payments WHERE id = $1",
      [req.params.id]
    );

    const payment = paymentRes.rows[0];

    await client.query(
      "UPDATE payments SET status = 'refunded' WHERE id = $1",
      [req.params.id]
    );

    await client.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1",
      [payment.booking_id]
    );

    await client.query("COMMIT");

    // ==============================
    // SOCKET: REFUND EVENT
    // ==============================
    emitToUser(payment.user_id, "payment_refunded", {
      booking_id: payment.booking_id
    });

    emitToAdmins("admin_payment_event", {
      type: "refund",
      booking_id: payment.booking_id
    });

    await sendNotification(
      payment.user_id,
      "Payment Refunded",
      `Your payment has been refunded.`
    );

    res.json({ message: "Refund successful" });

  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;