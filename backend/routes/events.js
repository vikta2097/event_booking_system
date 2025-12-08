const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ======================
// GET all upcoming events (public)
// ======================
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        c.name AS category_name,
        u.fullname AS organizer_name,
        u.profile_image AS organizer_profile
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
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
// GET all events (admin)
// ======================
router.get("/admin/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        c.name AS category_name,
        u.fullname AS organizer_name,
        u.profile_image AS organizer_profile
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      ORDER BY e.event_date DESC, e.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching all events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ======================
// GET events created by organizer
// ======================
router.get("/organizer/my-events", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== "organizer" && userRole !== "admin") {
      return res.status(403).json({ error: "Access denied. Organizer role required." });
    }

    const result = await db.query(`
      SELECT 
        e.*,
        c.name AS category_name,
        u.fullname AS organizer_name,
        u.profile_image AS organizer_profile,
        COUNT(DISTINCT b.id) AS total_bookings,
        COALESCE(SUM(b.seats), 0) AS total_seats_booked
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      LEFT JOIN bookings b ON b.event_id = e.id AND b.status != 'cancelled'
      WHERE e.created_by = $1
      GROUP BY e.id, c.name, u.fullname, u.profile_image
      ORDER BY e.event_date DESC, e.start_time ASC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching organizer events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ======================
// GET single event
// ======================
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        e.*,
        c.name AS category_name,
        u.fullname AS organizer_name,
        u.profile_image AS organizer_profile
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      WHERE e.id = $1
    `, [req.params.id]);

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
// CREATE new event
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
      image,
      venue,
      organizer_email,
      parking_info,
      map_link
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

    const result = await db.query(`
      INSERT INTO events
      (title, description, category_id, location, event_date, start_time, end_time, capacity, price, status, created_by, image, venue, organizer_email, parking_info, map_link)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id
    `, [
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
      image || null,
      venue || null,
      organizer_email || null,
      parking_info || null,
      map_link || null
    ]);

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
// UPDATE event
// ======================
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const existingResult = await db.query("SELECT * FROM events WHERE id = $1", [req.params.id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = existingResult.rows[0];
    if (req.user.id !== event.created_by && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: not allowed to update this event" });
    }

    const fields = [
      "title","description","category_id","location","event_date","start_time","end_time",
      "capacity","price","status","image","venue","organizer_email","parking_info","map_link"
    ];

    const updates = [];
    const values = [];
    let i = 1;

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${i++}`);
        values.push(req.body[f]);
      }
    });

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(req.params.id);
    await db.query(`UPDATE events SET ${updates.join(", ")} WHERE id = $${i}`, values);

    res.json({ message: "Event updated successfully" });
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// ======================
// DELETE event
// ======================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const existingResult = await db.query("SELECT * FROM events WHERE id = $1", [req.params.id]);
    if (existingResult.rows.length === 0) return res.status(404).json({ error: "Event not found" });

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
