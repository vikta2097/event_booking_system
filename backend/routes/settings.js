const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken } = require("../auth");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ============ AVATAR UPLOAD ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/avatars");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `avatar_${req.params.id}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage });

// ============ PROFILE ============
router.get("/profile/:id", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise.query(
      "SELECT fullname, email, phone, profile_image AS avatar FROM usercredentials WHERE id = ?",
      [req.params.id]
    );
    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching profile" });
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
    res.status(500).json({ message: "Error updating profile" });
  }
});

router.post("/profile/image/:id", verifyToken, upload.single("avatar"), async (req, res) => {
  try {
    await db.promise.query("UPDATE usercredentials SET profile_image = ? WHERE id = ?", [
      req.file.filename,
      req.params.id,
    ]);
    res.json({ message: "Avatar updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading avatar" });
  }
});

// ============ PASSWORD ============
router.put("/password/:id", verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const [rows] = await db.promise.query(
      "SELECT password_hash FROM usercredentials WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ message: "Old password incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.promise.query("UPDATE usercredentials SET password_hash = ? WHERE id = ?", [
      hashed,
      req.params.id,
    ]);
    res.json({ message: "Password updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating password" });
  }
});

// ============ USER PREFERENCES ============
router.get("/preferences/:id", verifyToken, async (req, res) => {
  try {
    // Fetch user preferences from usercredentials
    const [userPrefs] = await db.promise.query(
      "SELECT theme, privacy, system_preferences, twoFA FROM usercredentials WHERE id = ?",
      [req.params.id]
    );

    // Fetch user settings from user_settings
    const [settings] = await db.promise.query(
      "SELECT avatar, show_online, show_last_login, analytics, language, timezone, date_format FROM user_settings WHERE user_id = ?",
      [req.params.id]
    );

    const user = userPrefs[0] || {};
    const pref = settings[0] || {};

    // Safely parse JSON only if it’s a string
    const safeParse = (value, defaultVal) => {
      if (!value) return defaultVal;
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return defaultVal;
        }
      }
      return value; // already an object
    };

    res.json({
      theme: user.theme || "system",
      privacy: safeParse(user.privacy, { showOnline: true, showLastLogin: true }),
      system_preferences: safeParse(user.system_preferences, {}),
      twoFA: user.twoFA || 0,
      avatar: pref.avatar || null,
      show_online: pref.show_online ?? 1,
      show_last_login: pref.show_last_login ?? 1,
      analytics: pref.analytics ?? 1,
      language: pref.language || "en",
      timezone: pref.timezone || "Africa/Nairobi",
      date_format: pref.date_format || "YYYY-MM-DD",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching preferences" });
  }
});

router.put("/preferences/:id", verifyToken, async (req, res) => {
  try {
    const {
      theme,
      privacy,
      system_preferences,
      twoFA,
      avatar,
      show_online,
      show_last_login,
      analytics,
      language,
      timezone,
      date_format,
    } = req.body;

    // Utility to safely stringify objects
    const safeStringify = (value) => {
      if (typeof value === "object") return JSON.stringify(value);
      return value ?? "{}";
    };

    // Update usercredentials table
    await db.promise.query(
      "UPDATE usercredentials SET theme=?, privacy=?, system_preferences=?, twoFA=? WHERE id=?",
      [
        theme || "system",
        safeStringify(privacy || { showOnline: true, showLastLogin: true }),
        safeStringify(system_preferences || {}),
        twoFA || 0,
        req.params.id,
      ]
    );

    // Check if user_settings exists
    const [exists] = await db.promise.query(
      "SELECT id FROM user_settings WHERE user_id=?",
      [req.params.id]
    );

    if (exists.length) {
      // Update existing
      await db.promise.query(
        `UPDATE user_settings 
         SET avatar=?, show_online=?, show_last_login=?, analytics=?, language=?, timezone=?, date_format=? 
         WHERE user_id=?`,
        [
          avatar || null,
          show_online ?? 1,
          show_last_login ?? 1,
          analytics ?? 1,
          language || "en",
          timezone || "Africa/Nairobi",
          date_format || "YYYY-MM-DD",
          req.params.id,
        ]
      );
    } else {
      // Insert new
      await db.promise.query(
        `INSERT INTO user_settings 
         (user_id, avatar, show_online, show_last_login, analytics, language, timezone, date_format) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.params.id,
          avatar || null,
          show_online ?? 1,
          show_last_login ?? 1,
          analytics ?? 1,
          language || "en",
          timezone || "Africa/Nairobi",
          date_format || "YYYY-MM-DD",
        ]
      );
    }

    res.json({ message: "Preferences updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating preferences" });
  }
});

// ============ ACCOUNT ============
router.post("/deactivate/:id", verifyToken, async (req, res) => {
  try {
    await db.promise.query("UPDATE usercredentials SET status = 'inactive' WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ message: "Account deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deactivating account" });
  }
});

router.delete("/account/:id", verifyToken, async (req, res) => {
  try {
    await db.promise.query("DELETE FROM usercredentials WHERE id = ?", [req.params.id]);
    await db.promise.query("DELETE FROM user_settings WHERE user_id = ?", [req.params.id]);
    res.json({ message: "Account deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting account" });
  }
});

// ============ SYSTEM CONFIG ============
router.get("/system-config", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise.query(
      "SELECT appName, maintenanceMode, defaultRole FROM system_config LIMIT 1"
    );
    res.json(rows[0] || { appName: "EMS", maintenanceMode: 0, defaultRole: "user" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching system config" });
  }
});

router.put("/system-config/:id", verifyToken, async (req, res) => {
  const { appName, maintenanceMode, defaultRole } = req.body;
  try {
    await db.promise.query(
      "UPDATE system_config SET appName=?, maintenanceMode=?, defaultRole=? WHERE id=?",
      [appName, maintenanceMode, defaultRole, req.params.id]
    );
    res.json({ message: "System configuration updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating system config" });
  }
});

module.exports = router;
