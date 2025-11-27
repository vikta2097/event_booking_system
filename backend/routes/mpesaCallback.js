// mpesaCallback.js - IMPROVED VERSION
const { generateTicketQR } = require("../utils/ticketUtils");

module.exports = (app, db) => {
  app.post("/mpesa/callback", async (req, res) => {
    // M-Pesa requires immediate 200 response
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const timestamp = new Date().toISOString();
    console.log(`\n${"=".repeat(80)}`);
    console.log(`⚡ M-Pesa Callback Received at ${timestamp}`);
    console.log(`${"=".repeat(80)}`);
    console.log("Full Payload:", JSON.stringify(req.body, null, 2));

    try {
      const callback = req.body?.Body?.stkCallback;
      
      if (!callback) {
        console.error("❌ ERROR: Callback payload missing stkCallback");
        return;
      }

      const checkoutRequestID = callback.CheckoutRequestID;
      const resultCode = callback.ResultCode;
      const resultDesc = callback.ResultDesc || "";

      console.log("\n📋 Callback Details:");
      console.log(`   CheckoutRequestID: ${checkoutRequestID}`);
      console.log(`   ResultCode: ${resultCode}`);
      console.log(`   ResultDesc: ${resultDesc}`);

      const client = await db.getClient();

      try {
        await client.query("BEGIN");
        console.log("\n🔄 Transaction started");

        // Fetch payment record
        const paymentRes = await client.query(
          `SELECT * FROM payments WHERE checkout_request_id = $1 FOR UPDATE`,
          [checkoutRequestID]
        );

        if (paymentRes.rows.length === 0) {
          throw new Error(`❌ Payment record not found for CheckoutRequestID: ${checkoutRequestID}`);
        }

        const payment = paymentRes.rows[0];
        console.log(`\n💳 Found Payment Record:`);
        console.log(`   Payment ID: ${payment.id}`);
        console.log(`   Booking ID: ${payment.booking_id}`);
        console.log(`   Current Status: ${payment.status}`);

        // Payment succeeded
        if (resultCode === 0) {
          const metadata = callback.CallbackMetadata?.Item || [];
          const amount = metadata.find(i => i.Name === "Amount")?.Value || 0;
          const receipt = metadata.find(i => i.Name === "MpesaReceiptNumber")?.Value || "";
          const phone = metadata.find(i => i.Name === "PhoneNumber")?.Value || "";

          console.log(`\n✅ PAYMENT SUCCESS:`);
          console.log(`   Amount: KES ${amount}`);
          console.log(`   Receipt: ${receipt}`);
          console.log(`   Phone: ${phone}`);

          // Update payment
          await client.query(
            `UPDATE payments
             SET status = 'success',
                 mpesa_receipt = $1,
                 phone_number = $2,
                 paid_at = NOW()
             WHERE id = $3`,
            [receipt, phone, payment.id]
          );
          console.log(`   ✓ Payment status updated to 'success'`);

          // Update booking
          await client.query(
            `UPDATE bookings SET status = 'confirmed' WHERE id = $1`,
            [payment.booking_id]
          );
          console.log(`   ✓ Booking status updated to 'confirmed'`);

          // Generate tickets if not already generated
          if (!payment.tickets_generated) {
            console.log(`\n🎟️  Generating tickets...`);
            
            const bookedTickets = await client.query(
              `SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1`,
              [payment.booking_id]
            );

            if (bookedTickets.rows.length === 0) {
              console.warn(`   ⚠️  No ticket types found for booking ${payment.booking_id}`);
            }

            let totalTicketsGenerated = 0;

            for (const bt of bookedTickets.rows) {
              for (let i = 0; i < bt.quantity; i++) {
                const qrCode = generateTicketQR();
                await client.query(
                  `INSERT INTO tickets (booking_id, ticket_type_id, qr_code, status, created_at)
                   VALUES ($1, $2, $3, 'valid', NOW())`,
                  [payment.booking_id, bt.ticket_type_id, qrCode]
                );
                totalTicketsGenerated++;
              }
              console.log(`   ✓ Generated ${bt.quantity} ticket(s) for type ${bt.ticket_type_id}`);
            }

            // Mark tickets as generated
            await client.query(
              `UPDATE payments SET tickets_generated = true WHERE id = $1`,
              [payment.id]
            );
            console.log(`   ✓ Total tickets generated: ${totalTicketsGenerated}`);
            console.log(`   ✓ Tickets marked as generated in payment record`);

          } else {
            console.log(`   ℹ️  Tickets already generated for this payment`);
          }

        } else {
          // Payment failed
          console.warn(`\n❌ PAYMENT FAILED:`);
          console.warn(`   ResultCode: ${resultCode}`);
          console.warn(`   Description: ${resultDesc}`);

          await client.query(
            `UPDATE payments
             SET status = 'failed',
                 failure_reason = $1
             WHERE id = $2`,
            [resultDesc, payment.id]
          );
          console.log(`   ✓ Payment marked as failed`);
        }

        await client.query("COMMIT");
        console.log(`\n✅ Transaction committed successfully`);
        console.log(`${"=".repeat(80)}\n`);

      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`\n❌ Transaction ROLLBACK due to error:`);
        console.error(error);
        console.log(`${"=".repeat(80)}\n`);
      } finally {
        client.release();
      }

    } catch (error) {
      console.error(`\n❌ Fatal error processing callback:`);
      console.error(error);
      console.log(`${"=".repeat(80)}\n`);
    }
  });
};