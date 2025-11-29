// utils/ticketUtils.js - UPDATED VERSION
const crypto = require("crypto");

/**
 * Generate a unique QR code string
 * Format: TKT-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (36+ chars)
 */
const generateTicketQR = () => {
  return "TKT-" + crypto.randomBytes(16).toString("hex").toUpperCase();
};

/**
 * Generate a human-readable manual entry code
 * Format: XXXX-XXXX-XXXX (12 chars, easy to type)
 * Uses numbers and uppercase letters (excluding confusing chars like O, 0, I, 1)
 */
const generateManualCode = () => {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // Exclude 0, O, 1, I
  let code = "";
  
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) {
      code += "-"; // Add separator every 4 chars
    }
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  
  return code;
};

/**
 * Generate both QR code and manual entry code
 * Returns object with both codes
 */
const generateTicketCodes = () => {
  return {
    qr_code: generateTicketQR(),
    manual_code: generateManualCode()
  };
};

module.exports = {
  generateTicketQR,
  generateManualCode,
  generateTicketCodes
};