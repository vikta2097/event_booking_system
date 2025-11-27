// Add this to your server for testing
// routes/test.js or add to your main server file

const express = require("express");
const router = express.Router();
const db = require("../db");
const { generateTicketQR } = require("../utils/ticketUtils");

// Manual payment confirmation endpoint (for testing)
router.post("/test/confirm-payment/:bookingId", async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { bookingId } = req.params;
    
    await client.query("BEGIN");
    
    // Get booking
    const bookingRes = await client.query(
      "SELECT * FROM bookings WHERE id = $1",
      [bookingId]
    );
    
    if (bookingRes.rows.length === 0) {
      throw new Error("Booking not found");
    }
    
    const booking = bookingRes.rows[0];
    
    // Create or update payment to success
    const paymentRes = await client.query(
      `INSERT INTO payments (booking_id, user_id, amount, method, status, mpesa_receipt, transaction_ref)
       VALUES ($1, $2, $3, 'mpesa', 'success', 'TEST-' || $1, 'TEST-' || $1)
       ON CONFLICT (booking_id) 
       DO UPDATE SET status = 'success', mpesa_receipt = 'TEST-' || $1
       RETURNING id`,
      [bookingId, booking.user_id, booking.total_amount]
    );
    
    const paymentId = paymentRes.rows[0].id;
    
    // Update booking to confirmed
    await client.query(
      "UPDATE bookings SET status = 'confirmed' WHERE id = $1",
      [bookingId]
    );
    
    // Check if tickets already exist
    const existingTickets = await client.query(
      "SELECT id FROM tickets WHERE booking_id = $1",
      [bookingId]
    );
    
    if (existingTickets.rows.length === 0) {
      // Generate tickets
      const bookedTickets = await client.query(
        "SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1",
        [bookingId]
      );
      
      let ticketCount = 0;
      for (const bt of bookedTickets.rows) {
        for (let i = 0; i < bt.quantity; i++) {
          const qrCode = generateTicketQR();
          await client.query(
            `INSERT INTO tickets (booking_id, ticket_type_id, qr_code, status, created_at)
             VALUES ($1, $2, $3, 'valid', NOW())`,
            [bookingId, bt.ticket_type_id, qrCode]
          );
          ticketCount++;
        }
      }
      
      // Mark tickets as generated
      await client.query(
        "UPDATE payments SET tickets_generated = true WHERE id = $1",
        [paymentId]
      );
      
      await client.query("COMMIT");
      
      res.json({
        success: true,
        message: "Payment confirmed and tickets generated",
        tickets_generated: ticketCount
      });
    } else {
      await client.query("COMMIT");
      
      res.json({
        success: true,
        message: "Payment confirmed (tickets already existed)",
        tickets_count: existingTickets.rows.length
      });
    }
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Test confirmation error:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;

// Don't forget to add this to your server.js:
// const testRoutes = require("./routes/test");
// app.use("/api", testRoutes);