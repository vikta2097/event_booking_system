const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ======================
// GET ticket types for an event (public, accurate availability)
// ======================
router.get("/events/:eventId/ticket-types", async (req, res) => {
  const { eventId } = req.params;
  try {
    const result = await db.query(`
      SELECT 
        tt.id,
        tt.name,
        tt.description,
        tt.price,
        tt.quantity_available,
        tt.quantity_sold
      FROM ticket_types tt
      WHERE tt.event_id = $1
      ORDER BY tt.id ASC
    `, [eventId]);

    const ticketTypes = result.rows.map(t => ({
      ...t,
      quantity_sold: parseInt(t.quantity_sold),
      quantity_available: parseInt(t.quantity_available)
    }));

    res.json({ ticket_types: ticketTypes });
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
    const result = await db.query(`
      SELECT id, event_id, name, description, price, quantity_available, quantity_sold
      FROM ticket_types 
      WHERE id = $1
    `, [req.params.id]);

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
// CREATE ticket type (admin or event creator)
// ======================
router.post("/events/:eventId/ticket-types", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, description, price, quantity_available } = req.body;

    if (!name || price === undefined || quantity_available === undefined) {
      return res.status(400).json({ error: "Name, price, and quantity_available are required" });
    }
    if (price < 0) return res.status(400).json({ error: "Price cannot be negative" });
    if (quantity_available < 1) return res.status(400).json({ error: "Quantity must be at least 1" });

    // Check event exists and permission
    const eventResult = await db.query(`SELECT created_by FROM events WHERE id = $1`, [eventId]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: "Event not found" });

    const event = eventResult.rows[0];
    if (req.user.role !== "admin" && req.user.id !== event.created_by) {
      return res.status(403).json({ error: "Only event creator or admin can add ticket types" });
    }

    const insert = await db.query(`
      INSERT INTO ticket_types 
        (event_id, name, description, price, quantity_available, quantity_sold)
      VALUES ($1, $2, $3, $4, $5, 0)
      RETURNING *
    `, [eventId, name, description || null, parseFloat(price), parseInt(quantity_available)]);

    res.status(201).json({ message: "Ticket type created", ticketType: insert.rows[0] });
  } catch (err) {
    console.error("Error creating ticket type:", err);
    res.status(500).json({ error: "Failed to create ticket type", details: err.message });
  }
});

// ======================
// UPDATE ticket type
// ======================
router.put("/ticket-types/:id", verifyToken, async (req, res) => {
  try {
    const { name, description, price, quantity_available } = req.body;

    // Fetch ticket type + event
    const check = await db.query(`
      SELECT tt.*, e.created_by
      FROM ticket_types tt
      JOIN events e ON tt.event_id = e.id
      WHERE tt.id = $1
    `, [req.params.id]);

    if (check.rows.length === 0) return res.status(404).json({ error: "Ticket type not found" });

    const ticketType = check.rows[0];
    if (req.user.role !== "admin" && req.user.id !== ticketType.created_by) {
      return res.status(403).json({ error: "Permission denied" });
    }

    if (quantity_available !== undefined && parseInt(quantity_available) < ticketType.quantity_sold) {
      return res.status(400).json({ error: `Cannot reduce quantity below ${ticketType.quantity_sold} already sold` });
    }

    const updates = [];
    const values = [];
    let i = 1;

    if (name) { updates.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (price !== undefined) { updates.push(`price = $${i++}`); values.push(parseFloat(price)); }
    if (quantity_available !== undefined) { updates.push(`quantity_available = $${i++}`); values.push(parseInt(quantity_available)); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(req.params.id);
    const updateQuery = `UPDATE ticket_types SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`;
    const updated = await db.query(updateQuery, values);

    res.json({ message: "Ticket type updated", ticketType: updated.rows[0] });
  } catch (err) {
    console.error("Error updating ticket type:", err);
    res.status(500).json({ error: "Failed to update ticket type" });
  }
});

// ======================
// DELETE ticket type
// ======================
router.delete("/ticket-types/:id", verifyToken, async (req, res) => {
  try {
    // Prevent deletion if any tickets exist
    const checkBookings = await db.query(`
      SELECT COUNT(*) as count FROM booking_tickets WHERE ticket_type_id = $1
    `, [req.params.id]);

    if (parseInt(checkBookings.rows[0].count) > 0) {
      return res.status(400).json({ error: "Cannot delete ticket type with existing bookings" });
    }

    const check = await db.query(`
      SELECT tt.*, e.created_by
      FROM ticket_types tt
      JOIN events e ON tt.event_id = e.id
      WHERE tt.id = $1
    `, [req.params.id]);

    if (check.rows.length === 0) return res.status(404).json({ error: "Ticket type not found" });

    const ticketType = check.rows[0];
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
