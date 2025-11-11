const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ======================
// CREATE a support ticket
// ======================
router.post("/", verifyToken, async (req, res) => {
  try {
    const { subject, description, priority } = req.body;
    const user_id = req.user.id;

    if (!subject || !description) {
      return res.status(400).json({ error: "subject and description are required" });
    }

    const [result] = await db.promise.query(
      "INSERT INTO support_tickets (user_id, subject, description, priority) VALUES (?, ?, ?, ?)",
      [user_id, subject, description, priority || "low"]
    );

    res.status(201).json({
      message: "Ticket created",
      ticket_id: result.insertId,
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

    if (!isAdmin) {
      conditions.push("t.user_id = ?");
      values.push(userId);
    }

    if (status) {
      conditions.push("t.status = ?");
      values.push(status);
    }
    if (priority) {
      conditions.push("t.priority = ?");
      values.push(priority);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY t.created_at DESC";

    const [tickets] = await db.promise.query(query, values);
    res.json(tickets);
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

    const [tickets] = await db.promise.query(
      `SELECT t.*, u.fullname AS user_name, u.email AS user_email
       FROM support_tickets t
       JOIN usercredentials u ON t.user_id = u.id
       WHERE t.id = ?`,
      [ticketId]
    );

    if (tickets.length === 0) return res.status(404).json({ error: "Ticket not found" });

    const ticket = tickets[0];

    // Check access for regular users
    if (!isAdmin && ticket.user_id !== userId) {
      return res.status(403).json({ error: "Forbidden. Access denied." });
    }

    // Fetch replies
    const [replies] = await db.promise.query(
      `SELECT r.*, u.fullname AS sender_name
       FROM support_replies r
       JOIN usercredentials u ON r.sender_id = u.id
       WHERE r.ticket_id = ?
       ORDER BY r.created_at ASC`,
      [ticketId]
    );

    ticket.replies = replies;
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

    if (!message) return res.status(400).json({ error: "message required" });

    // Check ticket exists
    const [tickets] = await db.promise.query(
      "SELECT * FROM support_tickets WHERE id = ?", 
      [ticketId]
    );
    
    if (tickets.length === 0) return res.status(404).json({ error: "Ticket not found" });

    // Regular users can only reply to their own ticket
    if (sender_role !== "admin" && tickets[0].user_id !== sender_id) {
      return res.status(403).json({ error: "Forbidden. Cannot reply to others' tickets." });
    }

    await db.promise.query(
      "INSERT INTO support_replies (ticket_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)",
      [ticketId, sender_id, sender_role, message]
    );

    res.status(201).json({ message: "Reply added" });
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

    if (!status) return res.status(400).json({ error: "Status required" });

    const validStatus = ["open", "in_progress", "resolved", "closed"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const [result] = await db.promise.query(
      "UPDATE support_tickets SET status = ? WHERE id = ?",
      [status, ticketId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Ticket not found" });

    res.json({ message: "Status updated" });
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
    
    const [result] = await db.promise.query(
      "DELETE FROM support_tickets WHERE id = ?", 
      [ticketId]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "Ticket not found" });

    res.json({ message: "Ticket deleted" });
  } catch (err) {
    console.error("Error deleting ticket:", err);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

module.exports = router;
