// mpesaCallback.js

module.exports = (app, db) => {
  app.post("/mpesa/callback", async (req, res) => {
    try {
      const callback = req.body.Body.stkCallback;

      const checkoutRequestID = callback.CheckoutRequestID;
      const resultCode = callback.ResultCode;

      if (resultCode === 0) {
        const metadata = callback.CallbackMetadata.Item;

        const amount = metadata.find(i => i.Name === "Amount")?.Value;
        const receipt = metadata.find(i => i.Name === "MpesaReceiptNumber")?.Value;
        const phone = metadata.find(i => i.Name === "PhoneNumber")?.Value;

        await db("payments")
          .where("checkout_request_id", checkoutRequestID)
          .update({
            status: "success",
            transaction_id: receipt,
            phone,
            updated_at: new Date(),
          });

        return res.json({ message: "Payment updated successfully" });
      }

      // Failed payment
      await db("payments")
        .where("checkout_request_id", checkoutRequestID)
        .update({
          status: "failed",
          updated_at: new Date(),
        });

      res.json({ message: "Payment marked as failed" });

    } catch (error) {
      console.error("Callback error:", error);
      res.status(500).send("Callback processing error");
    }
  });
};
