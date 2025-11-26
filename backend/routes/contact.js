const express = require("express");
const router = express.Router();
const db = require("../db");

// ======================
// PUBLIC: Submit contact form
// ======================
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message, priority } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        error: "Name, email, subject, and message are required" 
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // Insert into contact_messages table
    const result = await db.query(
      `INSERT INTO contact_messages 
       (name, email, subject, message, priority, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id`,
      [name, email, subject, message, priority || "low", "new"]
    );

    // Optional: Send email notification to admin
    // await sendEmailNotification(email, name, subject, message);

    res.status(201).json({
      message: "Thank you for contacting us! We'll get back to you soon.",
      contact_id: result.rows[0].id,
    });
  } catch (err) {
    console.error("Error submitting contact form:", err);
    res.status(500).json({ error: "Failed to submit contact form" });
  }
});

// ======================
// ADMIN: Get all contact messages
// ======================
router.get("/", async (req, res) => {
  try {
    // Note: You should add authentication middleware to protect this route
    // For now, assuming it's protected by verifyAdmin middleware in main app

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
    console.error("Error fetching contact messages:", err);
    res.status(500).json({ error: "Failed to fetch contact messages" });
  }
});

// ======================
// ADMIN: Get single contact message
// ======================
router.get("/:id", async (req, res) => {
  try {
    const messageId = req.params.id;

    const result = await db.query(
      "SELECT * FROM contact_messages WHERE id = $1",
      [messageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching contact message:", err);
    res.status(500).json({ error: "Failed to fetch contact message" });
  }
});

// ======================
// ADMIN: Update contact message status
// ======================
router.put("/:id/status", async (req, res) => {
  try {
    const messageId = req.params.id;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const validStatus = ["new", "in_progress", "resolved", "closed"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await db.query(
      "UPDATE contact_messages SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, messageId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ======================
// ADMIN: Delete contact message
// ======================
router.delete("/:id", async (req, res) => {
  try {
    const messageId = req.params.id;

    const result = await db.query(
      "DELETE FROM contact_messages WHERE id = $1",
      [messageId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json({ message: "Contact message deleted successfully" });
  } catch (err) {
    console.error("Error deleting contact message:", err);
    res.status(500).json({ error: "Failed to delete contact message" });
  }
});

module.exports = router;