const express = require("express");
const router = express.Router();
const db = require("../db");
const { getIO } = require("../socket");

/*******************************
 *  UTILITY FUNCTIONS
 *******************************/

async function sendNotification(
  userId,
  title,
  message,
  type = "system",
  meta = {}
) {
  try {
    const query = `
      INSERT INTO notifications (user_id, title, message, type, meta)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at;
    `;

    const values = [
      userId,
      title,
      message,
      type,
      JSON.stringify(meta),
    ];

    const result = await db.query(query, values);
    const inserted = result.rows[0];

    // REAL-TIME EMIT
    const io = getIO();
    io.to(`user_${userId}`).emit("notification", {
      id: inserted.id,
      title,
      message,
      type,
      meta,
      created_at: inserted.created_at,
      is_read: false,
    });

    return inserted.id;
  } catch (err) {
    console.error("Notification error:", err);
    throw err;
  }
}

async function broadcastNotification(
  title,
  message,
  type = "broadcast",
  meta = {}
) {
  const users = await db.query(
    `SELECT id FROM usercredentials WHERE role != 'admin'`
  );

  const ids = [];

  for (const u of users.rows) {
    const id = await sendNotification(
      u.id,
      title,
      message,
      type,
      meta
    );
    ids.push(id);
  }

  const io = getIO();
  io.emit("broadcast_notification", {
    title,
    message,
    type,
    meta,
    created_at: new Date(),
  });

  return ids;
}

/*******************************
 * BUSINESS HELPERS
 *******************************/

async function getUnreadCount(userId) {
  const result = await db.query(
    `SELECT COUNT(*) FROM notifications 
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );

  return parseInt(result.rows[0].count, 10);
}

/*******************************
 * ROUTES
 *******************************/

// GET notifications
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unread_only } = req.query;

    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;

    const params = [userId];

    if (unread_only === "true") {
      query += " AND is_read = FALSE";
    }

    query += " ORDER BY created_at DESC LIMIT $2 OFFSET $3";
    params.push(limit, offset);

    const result = await db.query(query, params);
    const unread = await getUnreadCount(userId);

    res.json({
      notifications: result.rows,
      unread_count: unread,
      total: result.rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// unread count
router.get("/unread-count", async (req, res) => {
  const count = await getUnreadCount(req.user.id);
  res.json({ unread_count: count });
});

// mark read
router.put("/:id/read", async (req, res) => {
  const result = await db.query(
    `UPDATE notifications 
     SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [req.params.id, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Not found" });
  }

  getIO()
    .to(`user_${req.user.id}`)
    .emit("notification_read", { id: req.params.id });

  res.json({ success: true });
});

// mark all read
router.put("/read-all", async (req, res) => {
  await db.query(
    `UPDATE notifications 
     SET is_read = TRUE 
     WHERE user_id = $1`,
    [req.user.id]
  );

  getIO()
    .to(`user_${req.user.id}`)
    .emit("notifications_read_all");

  res.json({ success: true });
});

// delete one
router.delete("/:id", async (req, res) => {
  const result = await db.query(
    `DELETE FROM notifications
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [req.params.id, req.user.id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "Not found" });
  }

  getIO()
    .to(`user_${req.user.id}`)
    .emit("notification_deleted", { id: req.params.id });

  res.json({ success: true });
});

// delete all
router.delete("/", async (req, res) => {
  await db.query(
    `DELETE FROM notifications WHERE user_id = $1`,
    [req.user.id]
  );

  getIO()
    .to(`user_${req.user.id}`)
    .emit("notifications_cleared");

  res.json({ success: true });
});

// admin send
router.post("/send", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const { user_id, title, message, type, meta } = req.body;

  const id = await sendNotification(
    user_id,
    title,
    message,
    type,
    meta
  );

  res.json({ success: true, id });
});

// broadcast
router.post("/broadcast", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const ids = await broadcastNotification(
    req.body.title,
    req.body.message,
    req.body.type,
    req.body.meta
  );

  res.json({ success: true, count: ids.length });
});

module.exports = router;