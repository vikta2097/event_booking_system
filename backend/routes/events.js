const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ======================
// GET all events (public)
// ======================
router.get("/", async (req, res) => {
  try {
    const [events] = await db.promise.query(`
      SELECT 
        e.*,
        c.name AS category_name
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      ORDER BY e.event_date DESC, e.start_time ASC
    `);
    res.json(events);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ======================
// GET single event by ID (public)
// ======================
router.get("/:id", async (req, res) => {
  try {
    const [events] = await db.promise.query(
      `
      SELECT 
        e.*,
        c.name AS category_name
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      WHERE e.id = ?
    `,
      [req.params.id]
    );

    if (events.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(events[0]);
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

    // Validate category if provided
    if (category_id) {
      const [cat] = await db.promise.query(
        "SELECT id FROM event_categories WHERE id = ?",
        [category_id]
      );
      if (cat.length === 0) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
    }

    const [result] = await db.promise.query(
      `INSERT INTO events
      (title, description, category_id, location, event_date, start_time, end_time, capacity, price, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        req.user.id, // ✅ token-driven
      ]
    );

    res.status(201).json({ message: "Event created successfully", event_id: result.insertId });
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

    // Check event exists
    const [existing] = await db.promise.query("SELECT * FROM events WHERE id = ?", [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: "Event not found" });

    const event = existing[0];

    // Only creator or admin can update
    if (req.user.id !== event.created_by && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: not allowed to update this event" });
    }

    // Validate category
    if (category_id) {
      const [cat] = await db.promise.query("SELECT id FROM event_categories WHERE id = ?", [category_id]);
      if (cat.length === 0) return res.status(400).json({ error: "Invalid category ID" });
    }

    const updateFields = [];
    const values = [];

    if (title) { updateFields.push("title = ?"); values.push(title); }
    if (description !== undefined) { updateFields.push("description = ?"); values.push(description); }
    if (category_id !== undefined) { updateFields.push("category_id = ?"); values.push(category_id); }
    if (location !== undefined) { updateFields.push("location = ?"); values.push(location); }
    if (event_date) { updateFields.push("event_date = ?"); values.push(event_date); }
    if (start_time) { updateFields.push("start_time = ?"); values.push(start_time); }
    if (end_time) { updateFields.push("end_time = ?"); values.push(end_time); }
    if (capacity !== undefined) { updateFields.push("capacity = ?"); values.push(capacity); }
    if (price !== undefined) { updateFields.push("price = ?"); values.push(price); }
    if (status) { updateFields.push("status = ?"); values.push(status); }

    if (updateFields.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(req.params.id);

    await db.promise.query(`UPDATE events SET ${updateFields.join(", ")} WHERE id = ?`, values);

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
    const [existing] = await db.promise.query("SELECT * FROM events WHERE id = ?", [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: "Event not found" });

    const event = existing[0];

    // Only creator or admin
    if (req.user.id !== event.created_by && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: not allowed to delete this event" });
    }

    const [result] = await db.promise.query("DELETE FROM events WHERE id = ?", [req.params.id]);
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

module.exports = router;
