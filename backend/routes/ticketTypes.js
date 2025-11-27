const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ======================
// GET ticket types for an event (public)
// ======================
router.get("/events/:eventId/ticket-types", async (req, res) => {
  try {
    const { eventId } = req.params;

    const query = `
      SELECT 
        id,
        event_id,
        name,
        description,
        price,
        quantity_available,
        quantity_sold
      FROM ticket_types
      WHERE event_id = $1
      ORDER BY price ASC
    `;

    const result = await db.query(query, [eventId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching ticket types:", err);
    res.status(500).json({ error: "Failed to fetch ticket types" });
  }
});

// ======================
// GET single ticket type
// ======================
router.get("/ticket-types/:id", async (req, res) => {
  try {
    const query = `
      SELECT * FROM ticket_types WHERE id = $1
    `;
    const result = await db.query(query, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket type not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching ticket type:", err);
    res.status(500).json({ error: "Failed to fetch ticket type" });
  }
});

// ======================
// POST create ticket type (admin/event creator only)
// ======================
router.post("/events/:eventId/ticket-types", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, description, price, quantity_available } = req.body;

    if (!name || price === undefined || !quantity_available) {
      return res.status(400).json({ 
        error: "Name, price, and quantity are required" 
      });
    }

    // Verify event exists and user has permission
    const eventQuery = `SELECT created_by FROM events WHERE id = $1`;
    const eventResult = await db.query(eventQuery, [eventId]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = eventResult.rows[0];
    if (req.user.role !== "admin" && req.user.id !== event.created_by) {
      return res.status(403).json({ 
        error: "Only event creator or admin can add ticket types" 
      });
    }

    const query = `
      INSERT INTO ticket_types 
      (event_id, name, description, price, quantity_available, quantity_sold)
      VALUES ($1, $2, $3, $4, $5, 0)
      RETURNING *
    `;

    const result = await db.query(query, [
      eventId,
      name,
      description || null,
      price,
      quantity_available
    ]);

    res.status(201).json({
      message: "Ticket type created successfully",
      ticketType: result.rows[0]
    });
  } catch (err) {
    console.error("Error creating ticket type:", err);
    res.status(500).json({ error: "Failed to create ticket type" });
  }
});

// ======================
// PUT update ticket type
// ======================
router.put("/ticket-types/:id", verifyToken, async (req, res) => {
  try {
    const { name, description, price, quantity_available } = req.body;

    // Get ticket type and verify permissions
    const checkQuery = `
      SELECT tt.*, e.created_by 
      FROM ticket_types tt
      JOIN events e ON tt.event_id = e.id
      WHERE tt.id = $1
    `;
    const checkResult = await db.query(checkQuery, [req.params.id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket type not found" });
    }

    const ticketType = checkResult.rows[0];
    if (req.user.role !== "admin" && req.user.id !== ticketType.created_by) {
      return res.status(403).json({ error: "Permission denied" });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updateFields.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (quantity_available !== undefined) {
      updateFields.push(`quantity_available = $${paramCount++}`);
      values.push(quantity_available);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.id);

    const query = `
      UPDATE ticket_types 
      SET ${updateFields.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    res.json({
      message: "Ticket type updated successfully",
      ticketType: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating ticket type:", err);
    res.status(500).json({ error: "Failed to update ticket type" });
  }
});

// GET all tickets for an event
router.get("/events/:eventId/tickets", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;

    const query = `
      SELECT t.id, t.ticket_type_id, tt.name as ticket_name, t.booking_id,
             b.user_id, u.name as buyer_name, t.status, t.qr_code, t.created_at
      FROM tickets t
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      JOIN bookings b ON t.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE tt.event_id = $1
      ORDER BY t.created_at DESC
    `;

    const result = await db.query(query, [eventId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});


// ======================
// DELETE ticket type
// ======================
router.delete("/ticket-types/:id", verifyToken, async (req, res) => {
  try {
    // Check if any bookings exist for this ticket type
    const bookingCheck = await db.query(
      `SELECT COUNT(*) as count FROM booking_tickets WHERE ticket_type_id = $1`,
      [req.params.id]
    );

    if (parseInt(bookingCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: "Cannot delete ticket type with existing bookings" 
      });
    }

    // Verify permissions
    const checkQuery = `
      SELECT tt.*, e.created_by 
      FROM ticket_types tt
      JOIN events e ON tt.event_id = e.id
      WHERE tt.id = $1
    `;
    const checkResult = await db.query(checkQuery, [req.params.id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticket type not found" });
    }

    const ticketType = checkResult.rows[0];
    if (req.user.role !== "admin" && req.user.id !== ticketType.created_by) {
      return res.status(403).json({ error: "Permission denied" });
    }

    await db.query(`DELETE FROM ticket_types WHERE id = $1`, [req.params.id]);

    res.json({ message: "Ticket type deleted successfully" });
  } catch (err) {
    console.error("Error deleting ticket type:", err);
    res.status(500).json({ error: "Failed to delete ticket type" });
  }
});

module.exports = router;