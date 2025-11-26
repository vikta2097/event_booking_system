const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const { verifyToken } = require("../auth");

// ---------------------------
// Avatar Upload Configuration
// ---------------------------
const storage = multer.diskStorage({
  destination: "./uploads/avatars/",
  filename: (req, file, cb) => {
    cb(null, "avatar_" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ---------------------------
// GET ALL USER SETTINGS
// ---------------------------
router.get("/user/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;

    const result = await db.query(
      `SELECT fullname, email, phone, profile_image AS avatar,
              theme,
              privacy,
              system_preferences,
              twofa
       FROM usercredentials
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const user = result.rows[0];

    res.json({
      profile: {
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      },
      appearance: {
        theme: user.theme,
        language: user.system_preferences?.language || "en",
        timezone: user.system_preferences?.timezone || "Africa/Nairobi",
        dateFormat: user.system_preferences?.dateFormat || "YYYY-MM-DD",
      },
      privacy: user.privacy || {
        showOnline: true,
        showLastLogin: true,
        analytics: true,
      },
      notifications: user.system_preferences?.notifications || {
        emailNotifications: true,
        pushNotifications: true,
        taskReminders: true,
        weeklyReports: false,
      },
      security: {
        twoFA: user.twofa,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// ---------------------------
// UPDATE PROFILE
// ---------------------------
router.put("/profile/:id", verifyToken, async (req, res) => {
  try {
    const { fullname, email, phone } = req.body;
    const userId = req.params.id;

    await db.query(
      `UPDATE usercredentials
       SET fullname=$1, email=$2, phone=$3, updated_at=NOW()
       WHERE id=$4`,
      [fullname, email, phone, userId]
    );

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ---------------------------
// UPDATE APPEARANCE SETTINGS
// ---------------------------
router.put("/appearance/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { theme, language, timezone, dateFormat } = req.body;

    await db.query(
      `UPDATE usercredentials
       SET theme=$1,
           system_preferences = jsonb_set(
             COALESCE(system_preferences, '{}'),
             '{language}', to_jsonb($2::text)
           ) || jsonb_set(
             COALESCE(system_preferences, '{}'),
             '{timezone}', to_jsonb($3::text)
           ) || jsonb_set(
             COALESCE(system_preferences, '{}'),
             '{dateFormat}', to_jsonb($4::text)
           ),
           updated_at=NOW()
       WHERE id = $5`,
      [theme, language, timezone, dateFormat, userId]
    );

    res.json({ message: "Appearance updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update appearance" });
  }
});

// ---------------------------
// UPDATE PRIVACY SETTINGS
// ---------------------------
router.put("/privacy/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const privacy = req.body;

    await db.query(
      `UPDATE usercredentials
       SET privacy=$1, updated_at=NOW()
       WHERE id=$2`,
      [privacy, userId]
    );

    res.json({ message: "Privacy settings updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update privacy" });
  }
});

// ---------------------------
// UPDATE NOTIFICATIONS
// ---------------------------
router.put("/notifications/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const notifications = req.body;

    await db.query(
      `UPDATE usercredentials
       SET system_preferences = jsonb_set(
           COALESCE(system_preferences, '{}'),
           '{notifications}',
           $1,
           true
       ),
       updated_at=NOW()
       WHERE id=$2`,
      [notifications, userId]
    );

    res.json({ message: "Notifications updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// ---------------------------
// CHANGE PASSWORD
// ---------------------------
router.put("/password/:id", verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.params.id;

    const user = await db.query(
      "SELECT password_hash FROM usercredentials WHERE id=$1",
      [userId]
    );

    const valid = await bcrypt.compare(oldPassword, user.rows[0].password_hash);
    if (!valid)
      return res.status(400).json({ message: "Current password incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE usercredentials
       SET password_hash=$1, updated_at=NOW()
       WHERE id=$2`,
      [hashed, userId]
    );

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ---------------------------
// UPLOAD AVATAR
// ---------------------------
router.post("/avatar/:id", verifyToken, upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.params.id;

    await db.query(
      `UPDATE usercredentials
       SET profile_image=$1, updated_at=NOW()
       WHERE id=$2`,
      [req.file.filename, userId]
    );

    res.json({ filename: req.file.filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

// ---------------------------
// ENABLE/DISABLE 2FA
// ---------------------------
router.put("/2fa/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { enabled } = req.body;

    await db.query(
      `UPDATE usercredentials
       SET twofa=$1, updated_at=NOW()
       WHERE id=$2`,
      [enabled, userId]
    );

    res.json({ message: enabled ? "2FA enabled" : "2FA disabled" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to toggle 2FA" });
  }
});

module.exports = router;
