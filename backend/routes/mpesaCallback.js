// mpesaCallback.js - Fixed with booking confirmation & ticket generation

const { generateTicketQR } = require("../utils/ticketUtils");

module.exports = (app, db) => {
  app.post("/mpesa/callback", async (req, res) => {
    // Respond to M-Pesa immediately (they require quick response)
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    try {
      const callback = req.body.Body.stkCallback;
      const checkoutRequestID = callback.CheckoutRequestID;
      const resultCode = callback.ResultCode;

      console.log("M-Pesa Callback received:", { checkoutRequestID, resultCode });

      // Get database client for transaction
      const client = await db.getClient();

      try {
        await client.query("BEGIN");

        if (resultCode === 0) {
          // ============================================
          // SUCCESS: Payment completed
          // ============================================
          const metadata = callback.CallbackMetadata.Item;

          const amount = metadata.find(i => i.Name === "Amount")?.Value;
          const receipt = metadata.find(i => i.Name === "MpesaReceiptNumber")?.Value;
          const phone = metadata.find(i => i.Name === "PhoneNumber")?.Value;

          console.log("Payment successful:", { receipt, amount, phone });

          // 1. Update payment status
          const paymentRes = await client.query(
            `UPDATE payments 
             SET status = 'success', 
                 transaction_id = $1, 
                 phone = $2,
                 updated_at = NOW()
             WHERE checkout_request_id = $3 
             RETURNING *`,
            [receipt, phone, checkoutRequestID]
          );

          if (paymentRes.rows.length === 0) {
            throw new Error("Payment record not found");
          }

          const payment = paymentRes.rows[0];
          console.log("Payment updated:", payment.id);

          // 2. Update booking to confirmed
          await client.query(
            "UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1",
            [payment.booking_id]
          );
          console.log("Booking confirmed:", payment.booking_id);

          // 3. Generate tickets if not already generated
          if (!payment.tickets_generated) {
            // Get booked ticket types and quantities
            const bookedTickets = await client.query(
              "SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1",
              [payment.booking_id]
            );

            console.log(`Generating tickets for booking ${payment.booking_id}...`);

            // Generate tickets for each ticket type
            for (const bt of bookedTickets.rows) {
              for (let i = 0; i < bt.quantity; i++) {
                const qrCode = generateTicketQR();
                await client.query(
                  `INSERT INTO tickets (booking_id, ticket_type_id, qr_code, created_at) 
                   VALUES ($1, $2, $3, NOW())`,
                  [payment.booking_id, bt.ticket_type_id, qrCode]
                );
              }
              console.log(`Generated ${bt.quantity} ticket(s) for type ${bt.ticket_type_id}`);
            }

            // Mark tickets as generated
            await client.query(
              "UPDATE payments SET tickets_generated = true WHERE id = $1",
              [payment.id]
            );
            console.log("Tickets marked as generated");
          }

          await client.query("COMMIT");
          console.log("Transaction committed successfully");

        } else {
          // ============================================
          // FAILED: Payment failed or cancelled
          // ============================================
          const resultDesc = callback.ResultDesc || "Payment failed";
          console.log("Payment failed:", { resultCode, resultDesc });

          await client.query(
            `UPDATE payments 
             SET status = 'failed', 
                 updated_at = NOW()
             WHERE checkout_request_id = $1`,
            [checkoutRequestID]
          );

          await client.query("COMMIT");
          console.log("Payment marked as failed");
        }

      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transaction error:", error);
        throw error;
      } finally {
        client.release();
      }

    } catch (error) {
      console.error("Callback processing error:", error);
      // Note: We already responded to M-Pesa, so we just log the error
    }
  });
};