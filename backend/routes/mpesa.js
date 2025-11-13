const axios = require("axios");
require("dotenv").config();
const moment = require("moment");

const getAccessToken = async () => {
  const { MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_ENV } = process.env;
  const url =
    MPESA_ENV === "production"
      ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
      : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");

  const res = await axios.get(url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  return res.data.access_token;
};

const stkPush = async ({ amount, phone, accountRef, callbackUrl }) => {
  const token = await getAccessToken();
  const timestamp = moment().format("YYYYMMDDHHmmss");
  const { MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_ENV } = process.env;

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
    CallBackURL: callbackUrl,
    AccountReference: accountRef,
    TransactionDesc: "Event booking payment",
  };

  const res = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.data;
};

module.exports = { stkPush };
