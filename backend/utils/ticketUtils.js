// utils/ticketUtils.js
const crypto = require("crypto");

const generateTicketQR = () => {
  return `TICKET-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

module.exports = { generateTicketQR };
