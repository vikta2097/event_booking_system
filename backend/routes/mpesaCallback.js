// mpesaCallback.js
const { generateTicketQR } = require("../utils/ticketUtils");

module.exports = (app, db) => {
  app.post("/mpesa/callback", async (req, res) => {
    // M-Pesa requires immediate response
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    console.log("⚡ Incoming M-Pesa callback:", JSON.stringify(req.body, null, 2));

    try {
      const callback = req.body?.Body?.stkCallback;
      if (!callback) {
        console.error("Callback payload missing stkCallback");
        return;
      }

      const checkoutRequestID = callback.CheckoutRequestID;
      const resultCode = callback.ResultCode;
      const resultDesc = callback.ResultDesc || "";

      console.log(`Processing payment for CheckoutRequestID: ${checkoutRequestID}, ResultCode: ${resultCode}`);

      const client = await db.getClient();

      try {
        await client.query("BEGIN");

        // --- Fetch payment record ---
        const paymentRes = await client.query(
          `SELECT * FROM payments WHERE checkout_request_id = $1 FOR UPDATE`,
          [checkoutRequestID]
        );

        if (paymentRes.rows.length === 0) {
          throw new Error(`Payment record not found for CheckoutRequestID: ${checkoutRequestID}`);
        }

        const payment = paymentRes.rows[0];

        // --- Payment succeeded ---
        if (resultCode === 0) {
          const metadata = callback.CallbackMetadata?.Item || [];
          const amount = metadata.find(i => i.Name === "Amount")?.Value || 0;
          const receipt = metadata.find(i => i.Name === "MpesaReceiptNumber")?.Value || "";
          const phone = metadata.find(i => i.Name === "PhoneNumber")?.Value || "";

          console.log(`✅ Payment SUCCESS: Receipt=${receipt}, Amount=${amount}, Phone=${phone}`);

          // Update payment status
          await client.query(
            `UPDATE payments
             SET status = 'success',
                 mpesa_receipt = $1,
                 phone_number = $2,
                 paid_at = NOW()
             WHERE id = $3`,
            [receipt, phone, payment.id]
          );

          // Update booking status to confirmed
          await client.query(
            `UPDATE bookings SET status = 'confirmed' WHERE id = $1`,
            [payment.booking_id]
          );

          // Generate tickets if not already generated
          if (!payment.tickets_generated) {
            const bookedTickets = await client.query(
              `SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1`,
              [payment.booking_id]
            );

            console.log(`Generating tickets for booking ${payment.booking_id}...`);

            for (const bt of bookedTickets.rows) {
              for (let i = 0; i < bt.quantity; i++) {
                const qrCode = generateTicketQR();
                await client.query(
                  `INSERT INTO tickets (booking_id, ticket_type_id, qr_code, status, created_at)
                   VALUES ($1, $2, $3, 'valid', NOW())`,
                  [payment.booking_id, bt.ticket_type_id, qrCode]
                );
              }
              console.log(`Generated ${bt.quantity} ticket(s) for type ${bt.ticket_type_id}`);
            }

            // Mark tickets as generated
            await client.query(
              `UPDATE payments SET tickets_generated = true WHERE id = $1`,
              [payment.id]
            );
          }

        } else {
          // --- Payment failed or cancelled ---
          console.warn(`❌ Payment FAILED: ResultCode=${resultCode}, Desc=${resultDesc}`);

          await client.query(
            `UPDATE payments
             SET status = 'failed',
                 failure_reason = $1
             WHERE id = $2`,
            [resultDesc, payment.id]
          );
        }

        await client.query("COMMIT");
        console.log("Transaction committed successfully");

      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Transaction ROLLBACK due to error:", error);
      } finally {
        client.release();
      }

    } catch (error) {
      console.error("Error processing callback:", error);
    }
  });
};
