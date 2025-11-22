const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ======================
// GET all events (public - only upcoming events)
// ======================
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        c.name AS category_name
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      WHERE e.status = 'upcoming' 
        AND e.event_date >= CURRENT_DATE
      ORDER BY e.event_date ASC, e.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ======================
// GET all events (admin - includes all statuses)
// ======================
router.get("/admin/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        c.name AS category_name
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      ORDER BY e.event_date DESC, e.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching all events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ======================
// GET ticket types for a specific event
// ======================
// GET /api/events/:eventId/ticket-types
router.get("/:eventId/ticket-types", async (req, res) => {
  const { eventId } = req.params;

  try {
    // Check if event exists
    const eventCheck = await db.query(
      "SELECT id, title FROM events WHERE id = $1",
      [eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Fetch ticket types for the event
    const ticketTypes = await db.query(
      `SELECT 
         tt.id,
         tt.name,
         tt.price,
         tt.capacity,
         COUNT(t.id) AS tickets_sold
       FROM ticket_types tt
       LEFT JOIN tickets t ON t.ticket_type_id = tt.id
       WHERE tt.event_id = $1
       GROUP BY tt.id`,
      [eventId]
    );

    if (ticketTypes.rows.length === 0) {
      return res.status(404).json({ error: "No ticket types found for this event" });
    }

    // Format response with availability, ensuring remaining tickets are never negative
    const result = ticketTypes.rows.map(tt => {
      const sold = parseInt(tt.tickets_sold);
      const capacity = parseInt(tt.capacity);
      return {
        id: tt.id,
        name: tt.name,
        price: parseFloat(tt.price),
        capacity: capacity,
        tickets_sold: sold,
        tickets_remaining: Math.max(0, capacity - sold) // <-- prevents negatives
      };
    });

    res.json({
      event: eventCheck.rows[0].title,
      ticket_types: result
    });
  } catch (err) {
    console.error("Error fetching ticket types:", err);
    res.status(500).json({ error: "Failed to fetch ticket types" });
  }
});

// ======================
// GET single event by ID (public)
// ======================
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT 
        e.*,
        c.name AS category_name
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      WHERE e.id = $1
    `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// ======================
// POST create new event (authenticated users)
// ======================
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      location,
      event_date,
      start_time,
      end_time,
      capacity,
      price,
      status,
    } = req.body;

    if (!title || !event_date || !start_time || !end_time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (category_id) {
      const catResult = await db.query(
        "SELECT id FROM event_categories WHERE id = $1",
        [category_id]
      );
      if (catResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
    }

    const result = await db.query(
      `INSERT INTO events
      (title, description, category_id, location, event_date, start_time, end_time, capacity, price, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        title,
        description || null,
        category_id || null,
        location || null,
        event_date,
        start_time,
        end_time,
        capacity || 0,
        price || 0.0,
        status || "upcoming",
        req.user.id,
      ]
    );

    res.status(201).json({ 
      message: "Event created successfully", 
      event_id: result.rows[0].id 
    });
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// ======================
// PUT update event (creator or admin only)
// ======================
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      location,
      event_date,
      start_time,
      end_time,
      capacity,
      price,
      status,
    } = req.body;

    const existingResult = await db.query(
      "SELECT * FROM events WHERE id = $1", 
      [req.params.id]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = existingResult.rows[0];

    if (req.user.id !== event.created_by && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: not allowed to update this event" });
    }

    if (category_id) {
      const catResult = await db.query(
        "SELECT id FROM event_categories WHERE id = $1", 
        [category_id]
      );
      if (catResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (title) { updateFields.push(`title = $${paramCount}`); values.push(title); paramCount++; }
    if (description !== undefined) { updateFields.push(`description = $${paramCount}`); values.push(description); paramCount++; }
    if (category_id !== undefined) { updateFields.push(`category_id = $${paramCount}`); values.push(category_id); paramCount++; }
    if (location !== undefined) { updateFields.push(`location = $${paramCount}`); values.push(location); paramCount++; }
    if (event_date) { updateFields.push(`event_date = $${paramCount}`); values.push(event_date); paramCount++; }
    if (start_time) { updateFields.push(`start_time = $${paramCount}`); values.push(start_time); paramCount++; }
    if (end_time) { updateFields.push(`end_time = $${paramCount}`); values.push(end_time); paramCount++; }
    if (capacity !== undefined) { updateFields.push(`capacity = $${paramCount}`); values.push(capacity); paramCount++; }
    if (price !== undefined) { updateFields.push(`price = $${paramCount}`); values.push(price); paramCount++; }
    if (status) { updateFields.push(`status = $${paramCount}`); values.push(status); paramCount++; }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.params.id);

    await db.query(
      `UPDATE events SET ${updateFields.join(", ")} WHERE id = $${paramCount}`, 
      values
    );

    res.json({ message: "Event updated successfully" });
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// ======================
// DELETE event (creator or admin only)
// ======================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const existingResult = await db.query(
      "SELECT * FROM events WHERE id = $1", 
      [req.params.id]
    );
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = existingResult.rows[0];

    if (req.user.id !== event.created_by && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: not allowed to delete this event" });
    }

    await db.query("DELETE FROM events WHERE id = $1", [req.params.id]);
    
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

module.exports = router;
