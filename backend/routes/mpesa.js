const axios = require("axios");
require("dotenv").config();
const moment = require("moment");

// Get M-Pesa access token
const getAccessToken = async () => {
  try {
    const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_ENV } = process.env;
    const url =
      MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
        : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");

    const res = await axios.get(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.data.access_token) {
      throw new Error("No access token returned from M-Pesa");
    }

    return res.data.access_token;
  } catch (err) {
    console.error("❌ Failed to get M-Pesa access token:", err.response?.data || err.message);
    throw new Error("Failed to get M-Pesa access token");
  }
};

// Trigger STK Push
const stkPush = async ({ amount, phone, accountRef }) => {
  try {
    const token = await getAccessToken();
    const timestamp = moment().format("YYYYMMDDHHmmss");
    const { MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_ENV, MPESA_CALLBACK_URL } = process.env;

    const password = Buffer.from(MPESA_SHORTCODE + MPESA_PASSKEY + timestamp).toString("base64");

    const url =
      MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
        : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

    const body = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: accountRef,
      TransactionDesc: "Event booking payment",
    };

    console.log("➡️ STK Push request body:", { ...body, Password: "****" });

    const res = await axios.post(url, body, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("⬅️ STK Push response:", res.data);

    if (!res.data.CheckoutRequestID) {
      throw new Error(`STK Push failed: ${JSON.stringify(res.data)}`);
    }

    return res.data;
  } catch (err) {
    console.error("❌ STK Push error:", err.response?.data || err.message);
    throw new Error("M-Pesa STK Push failed");
  }
};

module.exports = { stkPush };
