const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ======================
// CREATE a support ticket
// ======================
router.post("/", verifyToken, async (req, res) => {
  try {
    const { subject, message, priority } = req.body;
    const user_id = req.user.id;

    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    const result = await db.query(
      "INSERT INTO support_tickets (user_id, subject, message, priority, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [user_id, subject, message, priority || "low", "open"]
    );

    res.status(201).json({
      message: "Ticket submitted successfully",
      ticket_id: result.rows[0].id,
    });
  } catch (err) {
    console.error("Error creating ticket:", err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

// ======================
// GET all tickets
// Optional filters: status, priority
// ======================
router.get("/", verifyToken, async (req, res) => {
  try {
    const { status, priority } = req.query;
    const isAdmin = req.user.role === "admin";
    const userId = req.user.id;

    let query = `
      SELECT t.*, u.fullname AS user_name 
      FROM support_tickets t
      JOIN usercredentials u ON t.user_id = u.id
    `;
    const conditions = [];
    const values = [];
    let paramCount = 1;

    if (!isAdmin) {
      conditions.push(`t.user_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    }

    if (status) {
      conditions.push(`t.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    if (priority) {
      conditions.push(`t.priority = $${paramCount}`);
      values.push(priority);
      paramCount++;
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY t.created_at DESC";

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// ======================
// GET single ticket with replies
// ======================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const isAdmin = req.user.role === "admin";
    const userId = req.user.id;

    const ticketResult = await db.query(
      `SELECT t.*, u.fullname AS user_name, u.email AS user_email
       FROM support_tickets t
       JOIN usercredentials u ON t.user_id = u.id
       WHERE t.id = $1`,
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = ticketResult.rows[0];

    if (!isAdmin && ticket.user_id !== userId) {
      return res.status(403).json({ error: "Forbidden. Access denied." });
    }

    const repliesResult = await db.query(
      `SELECT r.*, u.fullname AS sender_name
       FROM support_replies r
       JOIN usercredentials u ON r.sender_id = u.id
       WHERE r.ticket_id = $1
       ORDER BY r.created_at ASC`,
      [ticketId]
    );

    ticket.replies = repliesResult.rows;
    res.json(ticket);
  } catch (err) {
    console.error("Error fetching ticket:", err);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

// ======================
// POST reply to a ticket
// ======================
router.post("/:id/reply", verifyToken, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const sender_id = req.user.id;
    const sender_role = req.user.role;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ticketResult = await db.query(
      "SELECT * FROM support_tickets WHERE id = $1", 
      [ticketId]
    );
    
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (sender_role !== "admin" && ticketResult.rows[0].user_id !== sender_id) {
      return res.status(403).json({ error: "Forbidden. Cannot reply to others' tickets." });
    }

    await db.query(
      "INSERT INTO support_replies (ticket_id, sender_id, sender_role, message) VALUES ($1, $2, $3, $4)",
      [ticketId, sender_id, sender_role, message]
    );

    res.status(201).json({ message: "Reply added successfully" });
  } catch (err) {
    console.error("Error adding reply:", err);
    res.status(500).json({ error: "Failed to add reply" });
  }
});

// ======================
// UPDATE ticket status (Admin only)
// ======================
router.put("/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const validStatus = ["open", "in_progress", "resolved", "closed"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await db.query(
      "UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, ticketId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ======================
// DELETE ticket (Admin only)
// ======================
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const ticketId = req.params.id;
    
    const result = await db.query(
      "DELETE FROM support_tickets WHERE id = $1", 
      [ticketId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({ message: "Ticket deleted successfully" });
  } catch (err) {
    console.error("Error deleting ticket:", err);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

// ======================
// PUBLIC: Submit Contact Us message
// ======================
router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message, priority } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const result = await db.query(
      `INSERT INTO contact_messages 
       (name, email, subject, message, priority, status) 
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [name, email, subject, message, priority || "low", "new"]
    );

    res.status(201).json({
      message: "Message sent successfully! We'll get back to you soon.",
      contact_id: result.rows[0].id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ======================
// ADMIN: Get all Contact Us messages
// ======================
router.get("/contact", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, priority } = req.query;
    let query = "SELECT * FROM contact_messages WHERE 1=1";
    const values = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount}`;
      values.push(status);
      paramCount++;
    }
    if (priority) {
      query += ` AND priority = $${paramCount}`;
      values.push(priority);
      paramCount++;
    }
    query += " ORDER BY created_at DESC";

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ======================
// ADMIN: Update Contact Us message status
// ======================
router.put("/contact/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatus = ["new", "in_progress", "resolved", "closed"];
    if (!status || !validStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await db.query(
      "UPDATE contact_messages SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Message not found" });
    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ======================
// ADMIN: Delete Contact Us message
// ======================
router.delete("/contact/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("DELETE FROM contact_messages WHERE id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Message not found" });
    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});


module.exports = router;