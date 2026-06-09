const axios = require("axios");
require("dotenv").config();
const moment = require("moment");

// ── Validate required env vars at startup so failures are obvious ──
const REQUIRED_ENV = [
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_PASSKEY",
  "MPESA_CALLBACK_URL",
];

const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(
    `❌ M-Pesa: Missing required environment variables: ${missingEnv.join(", ")}`
  );
  // Don't throw — let the server start, surface error per-request instead
}

// ─────────────────────────────────────────────
// Internal: base URLs
// ─────────────────────────────────────────────
const baseUrl = () =>
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ─────────────────────────────────────────────
// Get M-Pesa access token
// ─────────────────────────────────────────────
const getAccessToken = async () => {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET } = process.env;

  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error(
      "MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET is not set in environment"
    );
  }

  const url = `${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`;
  const auth = Buffer.from(
    `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
  ).toString("base64");

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 15000,
    });

    if (!res.data?.access_token) {
      throw new Error(
        `Safaricom returned no access_token. Response: ${JSON.stringify(res.data)}`
      );
    }

    return res.data.access_token;
  } catch (err) {
    // Preserve the full Safaricom error body in the thrown message
    const safaricomMsg =
      err.response?.data?.errorMessage ||
      err.response?.data?.error_description ||
      JSON.stringify(err.response?.data) ||
      err.message;

    console.error("❌ M-Pesa getAccessToken failed:", safaricomMsg);
    throw new Error(`M-Pesa auth failed: ${safaricomMsg}`);
  }
};

// ─────────────────────────────────────────────
// Trigger STK Push
// ─────────────────────────────────────────────
const stkPush = async ({ amount, phone, accountRef }) => {
  const {
    MPESA_SHORTCODE,
    MPESA_PASSKEY,
    MPESA_CALLBACK_URL,
  } = process.env;

  if (!MPESA_SHORTCODE || !MPESA_PASSKEY || !MPESA_CALLBACK_URL) {
    throw new Error(
      "STK Push cannot proceed: MPESA_SHORTCODE, MPESA_PASSKEY, or MPESA_CALLBACK_URL is not set"
    );
  }

  const token = await getAccessToken();
  const timestamp = moment().format("YYYYMMDDHHmmss");
  const password = Buffer.from(
    MPESA_SHORTCODE + MPESA_PASSKEY + timestamp
  ).toString("base64");

  const url = `${baseUrl()}/mpesa/stkpush/v1/processrequest`;

  const body = {
    BusinessShortCode: MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.ceil(amount), // M-Pesa only accepts integers
    PartyA: phone,
    PartyB: MPESA_SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: MPESA_CALLBACK_URL,
    AccountReference: accountRef,
    TransactionDesc: "Event booking payment",
  };

  console.log("➡️  STK Push to:", url);
  console.log("➡️  Body (sanitised):", { ...body, Password: "****" });

  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    console.log("⬅️  STK Push response:", res.data);

    if (!res.data?.CheckoutRequestID) {
      throw new Error(
        `Safaricom STK Push missing CheckoutRequestID. Full response: ${JSON.stringify(res.data)}`
      );
    }

    return res.data;
  } catch (err) {
    // Surface the real Safaricom error rather than swallowing it
    const safaricomMsg =
      err.response?.data?.errorMessage ||
      err.response?.data?.ResultDesc ||
      JSON.stringify(err.response?.data) ||
      err.message;

    console.error("❌ STK Push failed:", safaricomMsg);
    // Attach the raw response so payments.js can forward it to the client
    const wrapped = new Error(`STK Push failed: ${safaricomMsg}`);
    wrapped.safaricomData = err.response?.data;
    wrapped.statusCode = err.response?.status;
    throw wrapped;
  }
};

// ─────────────────────────────────────────────
// Query STK Push status from Safaricom
// Used as a callback-missed fallback
// ─────────────────────────────────────────────
const querySTK = async (checkoutRequestId) => {
  const { MPESA_SHORTCODE, MPESA_PASSKEY } = process.env;

  if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
    throw new Error(
      "querySTK cannot proceed: MPESA_SHORTCODE or MPESA_PASSKEY is not set"
    );
  }

  const token = await getAccessToken();
  const timestamp = moment().format("YYYYMMDDHHmmss");
  const password = Buffer.from(
    MPESA_SHORTCODE + MPESA_PASSKEY + timestamp
  ).toString("base64");

  const url = `${baseUrl()}/mpesa/stkpushquery/v1/query`;

  try {
    const res = await axios.post(
      url,
      {
        BusinessShortCode: MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("⬅️  STK Query response:", res.data);
    return res.data;
  } catch (err) {
    const safaricomMsg =
      err.response?.data?.errorMessage ||
      err.response?.data?.ResultDesc ||
      JSON.stringify(err.response?.data) ||
      err.message;

    console.error("❌ STK Query failed:", safaricomMsg);
    const wrapped = new Error(`STK Query failed: ${safaricomMsg}`);
    wrapped.safaricomData = err.response?.data;
    throw wrapped;
  }
};

module.exports = { stkPush, querySTK };