const express = require("express");
const router = express.Router();
const multer = require("multer");
const bcrypt = require("bcrypt");
const db = require("../db");
const { verifyToken } = require("../auth");
const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config();

// =====================
// Multer setup for avatar uploads
// =====================
const avatarPath = path.join(__dirname, "../uploads/avatars");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, avatarPath);
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split(".").pop();
    cb(null, `${req.user.id}_${Date.now()}.${ext}`);
  },
});
const upload = multer({ storage });

// =====================
// In-memory 2FA OTP store
// { userId: { otp, expiresAt } }
// =====================
const otpStore = {};

// =====================
// Nodemailer transporter
// =====================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// =====================
// PROFILE ROUTES
// =====================
router.get("/profile/:id", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise.query(
      "SELECT id, fullname, email, phone, role, status, profile_image, theme, privacy, system_preferences FROM usercredentials WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const user = rows[0];

    // Parse JSON fields safely
    user.privacy = user.privacy ? JSON.parse(user.privacy) : { showOnline: true, showLastLogin: true, analytics: false };
    user.system_preferences = user.system_preferences ? JSON.parse(user.system_preferences) : { language: "en", timezone: "Africa/Nairobi", dateFormat: "DD/MM/YYYY" };
    user.avatarUrl = user.profile_image ? `/uploads/avatars/${user.profile_image}` : null;

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/profile/:id", verifyToken, async (req, res) => {
  const { fullname, email, phone } = req.body;
  try {
    await db.promise.query(
      "UPDATE usercredentials SET fullname = ?, email = ?, phone = ? WHERE id = ?",
      [fullname, email, phone, req.params.id]
    );
    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.post("/profile/image/:id", verifyToken, upload.single("avatar"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  try {
    const filename = req.file.filename;
    await db.promise.query(
      "UPDATE usercredentials SET profile_image = ? WHERE id = ?",
      [filename, req.params.id]
    );
    res.json({ message: "Avatar uploaded", filename, url: `/uploads/avatars/${filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to upload avatar" });
  }
});

// =====================
// PASSWORD
// =====================
router.put("/password/:id", verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const [rows] = await db.promise.query("SELECT password_hash FROM usercredentials WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!match) return res.status(400).json({ message: "Old password incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.promise.query("UPDATE usercredentials SET password_hash = ? WHERE id = ?", [hashed, req.params.id]);
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating password" });
  }
});

// =====================
// 2FA EMAIL OTP
// =====================
router.post("/2fa/:id", verifyToken, async (req, res) => {
  const { enabled } = req.body;
  const userId = req.params.id;

  if (!enabled) {
    delete otpStore[userId];
    return res.json({ enabled: false });
  }

  const [rows] = await db.promise.query("SELECT email FROM usercredentials WHERE id = ?", [userId]);
  if (!rows.length) return res.status(404).json({ message: "User not found" });

  const email = rows[0].email;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  otpStore[userId] = { otp, expiresAt };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your 2FA OTP Code",
      html: `<p>Your OTP code is: <b>${otp}</b></p><p>Valid for 5 minutes.</p>`,
    });
    res.json({ enabled: true, message: "OTP sent to email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP email" });
  }
});

router.post("/2fa/verify/:id", verifyToken, (req, res) => {
  const { otp } = req.body;
  const record = otpStore[req.params.id];
  if (!record) return res.status(400).json({ message: "No OTP found" });
  if (record.expiresAt < Date.now()) return res.status(400).json({ message: "OTP expired" });
  if (record.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

  delete otpStore[req.params.id];
  res.json({ message: "OTP verified successfully" });
});

// =====================
// THEME, PRIVACY, SYSTEM PREFERENCES
// =====================
router.get("/theme/:id", verifyToken, async (req, res) => {
  const [rows] = await db.promise.query("SELECT theme FROM usercredentials WHERE id = ?", [req.params.id]);
  res.json({ theme: rows[0]?.theme || "system" });
});

router.put("/theme/:id", verifyToken, async (req, res) => {
  await db.promise.query("UPDATE usercredentials SET theme = ? WHERE id = ?", [req.body.theme, req.params.id]);
  res.json({ message: "Theme updated" });
});

router.get("/privacy/:id", verifyToken, async (req, res) => {
  const [rows] = await db.promise.query("SELECT privacy FROM usercredentials WHERE id = ?", [req.params.id]);
  res.json(rows[0]?.privacy ? JSON.parse(rows[0].privacy) : { showOnline: true, showLastLogin: true, analytics: false });
});

router.put("/privacy/:id", verifyToken, async (req, res) => {
  await db.promise.query("UPDATE usercredentials SET privacy = ? WHERE id = ?", [JSON.stringify(req.body), req.params.id]);
  res.json({ message: "Privacy updated" });
});

router.get("/system/:id", verifyToken, async (req, res) => {
  const [rows] = await db.promise.query("SELECT system_preferences FROM usercredentials WHERE id = ?", [req.params.id]);
  res.json(rows[0]?.system_preferences ? JSON.parse(rows[0].system_preferences) : { language: "en", timezone: "Africa/Nairobi", dateFormat: "DD/MM/YYYY" });
});

router.put("/system/:id", verifyToken, async (req, res) => {
  await db.promise.query("UPDATE usercredentials SET system_preferences = ? WHERE id = ?", [JSON.stringify(req.body), req.params.id]);
  res.json({ message: "System preferences updated" });
});

// =====================
// ADMIN: SYSTEM CONFIG
// =====================
router.get("/system-config", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

  let [rows] = await db.promise.query("SELECT * FROM system_config LIMIT 1");

  if (!rows.length) {
    // Insert default config if table empty
    await db.promise.query("INSERT INTO system_config (id, appName, maintenanceMode, defaultRole) VALUES (1, 'EMS App', 0, 'user')");
    [rows] = await db.promise.query("SELECT * FROM system_config LIMIT 1");
  }

  res.json(rows[0]);
});

router.put("/system-config", verifyToken, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  const { appName, maintenanceMode, defaultRole } = req.body;
  await db.promise.query(
    "UPDATE system_config SET appName = ?, maintenanceMode = ?, defaultRole = ? WHERE id = 1",
    [appName, maintenanceMode, defaultRole]
  );
  res.json({ message: "System configuration updated" });
});

module.exports = router;
