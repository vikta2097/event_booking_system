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
    const result = await db.query(
      "SELECT fullname, email, phone, profile_image AS avatar FROM usercredentials WHERE id = $1",
      [req.params.id]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

router.put("/profile/:id", verifyToken, async (req, res) => {
  const { fullname, email, phone } = req.body;
  try {
    await db.query(
      "UPDATE usercredentials SET fullname = $1, email = $2, phone = $3 WHERE id = $4",
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
    await db.query(
      "UPDATE usercredentials SET profile_image = $1 WHERE id = $2", 
      [req.file.filename, req.params.id]
    );
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
    const result = await db.query(
      "SELECT password_hash FROM usercredentials WHERE id = $1",
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ message: "Old password incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query(
      "UPDATE usercredentials SET password_hash = $1 WHERE id = $2", 
      [hashed, req.params.id]
    );
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
    const userPrefsResult = await db.query(
      "SELECT theme, privacy, system_preferences, twoFA FROM usercredentials WHERE id = $1",
      [req.params.id]
    );

    // Fetch user settings from user_settings
    const settingsResult = await db.query(
      "SELECT avatar, show_online, show_last_login, analytics, language, timezone, date_format FROM user_settings WHERE user_id = $1",
      [req.params.id]
    );

    const user = userPrefsResult.rows[0] || {};
    const pref = settingsResult.rows[0] || {};

    // Safely parse JSON only if it's a string
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
      twoFA: user.twofa || false,
      avatar: pref.avatar || null,
      show_online: pref.show_online ?? true,
      show_last_login: pref.show_last_login ?? true,
      analytics: pref.analytics ?? true,
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
    await db.query(
      "UPDATE usercredentials SET theme=$1, privacy=$2, system_preferences=$3, twoFA=$4 WHERE id=$5",
      [
        theme || "system",
        safeStringify(privacy || { showOnline: true, showLastLogin: true }),
        safeStringify(system_preferences || {}),
        twoFA || false,
        req.params.id,
      ]
    );

    // Check if user_settings exists
    const existsResult = await db.query(
      "SELECT id FROM user_settings WHERE user_id=$1",
      [req.params.id]
    );

    if (existsResult.rows.length > 0) {
      // Update existing
      await db.query(
        `UPDATE user_settings 
         SET avatar=$1, show_online=$2, show_last_login=$3, analytics=$4, language=$5, timezone=$6, date_format=$7 
         WHERE user_id=$8`,
        [
          avatar || null,
          show_online ?? true,
          show_last_login ?? true,
          analytics ?? true,
          language || "en",
          timezone || "Africa/Nairobi",
          date_format || "YYYY-MM-DD",
          req.params.id,
        ]
      );
    } else {
      // Insert new
      await db.query(
        `INSERT INTO user_settings 
         (user_id, avatar, show_online, show_last_login, analytics, language, timezone, date_format) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.params.id,
          avatar || null,
          show_online ?? true,
          show_last_login ?? true,
          analytics ?? true,
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
    await db.query(
      "UPDATE usercredentials SET status = $1 WHERE id = $2", 
      ['inactive', req.params.id]
    );
    res.json({ message: "Account deactivated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deactivating account" });
  }
});

router.delete("/account/:id", verifyToken, async (req, res) => {
  try {
    await db.query("DELETE FROM usercredentials WHERE id = $1", [req.params.id]);
    await db.query("DELETE FROM user_settings WHERE user_id = $1", [req.params.id]);
    res.json({ message: "Account deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting account" });
  }
});

// ============ SYSTEM CONFIG ============
router.get("/system-config", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT appName, maintenanceMode, defaultRole FROM system_config LIMIT 1"
    );
    res.json(result.rows[0] || { appName: "EMS", maintenanceMode: false, defaultRole: "user" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching system config" });
  }
});

router.put("/system-config/:id", verifyToken, async (req, res) => {
  const { appName, maintenanceMode, defaultRole } = req.body;
  try {
    await db.query(
      "UPDATE system_config SET appName=$1, maintenanceMode=$2, defaultRole=$3 WHERE id=$4",
      [appName, maintenanceMode, defaultRole, req.params.id]
    );
    res.json({ message: "System configuration updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating system config" });
  }
});

module.exports = router;