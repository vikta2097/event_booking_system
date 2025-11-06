// backend/routes/admin.js
const express = require("express");
const router = express.Router();
const { verifyToken } = require("../auth"); // ensure this middleware verifies and attaches req.user

// ✅ Simple admin dashboard route
router.get("/dashboard", verifyToken, (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({
      success: true,
      message: `Welcome back, ${req.user.name || "Admin"}!`,
    });
  } catch (error) {
    console.error("Error in admin dashboard:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
