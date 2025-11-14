const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("../db");
const { verifyToken } = require("../auth");
require("dotenv").config();

const router = express.Router();

//
// Utility Functions
//
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return /^(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{6,}$/.test(password);
}

//
// REGISTER
//
router.post("/register", async (req, res) => {
  const { email, password, fullname, phone } = req.body;

  if (!email || !password || !fullname) {
    return res
      .status(400)
      .json({ message: "Email, password, and fullname are required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 6 characters long and include a number, lowercase letter, and special character",
    });
  }

  const userRole = "user"; // force role to 'user'

  try {
    // Check existing email
    const existingResult = await db.query(
      "SELECT id FROM usercredentials WHERE email = $1",
      [email]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO usercredentials (fullname, email, password_hash, phone, role) VALUES ($1, $2, $3, $4, $5)",
      [fullname, email, hashedPassword, phone || null, userRole]
    );

    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("❌ Registration error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//
// LOGIN
//
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const result = await db.query(
      "SELECT * FROM usercredentials WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        fullname: user.fullname,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        phone: user.phone,
        profile_image: user.profile_image,
        status: user.status,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//
// FORGOT PASSWORD
//
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const result = await db.query(
      "SELECT id FROM usercredentials WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    const resetLink = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/reset-password/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Reset Your Password",
      html: `<p>Hello,</p>
             <p>Click <a href="${resetLink}">here</a> to reset your password. 
             This link will expire in 15 minutes.</p>
             <p>If you didn't request a password reset, ignore this message.</p>`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Reset link sent to email" });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//
// RESET PASSWORD
//
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || !isValidPassword(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 6 characters with a lowercase letter, number, and special character",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "UPDATE usercredentials SET password_hash = $1 WHERE email = $2",
      [hashedPassword, decoded.email]
    );

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    res.status(400).json({ message: "Invalid or expired token" });
  }
});

//
// GET CURRENT USER
//
router.get("/me", verifyToken, async (req, res) => {
  const { id } = req.user;

  try {
    const result = await db.query(
      "SELECT id, fullname, email, role, phone, profile_image, status FROM usercredentials WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Fetch current user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;