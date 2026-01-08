const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// ======================
// GET all upcoming events (public) with advanced filtering
// ======================
router.get("/", async (req, res) => {
  try {
    const {
      category,
      tags,
      venue,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      status,
      sortBy,
      search,
      page = 1,
      limit = 12,
      exclude
    } = req.query;

    let query = `
      SELECT 
        e.*,
        c.name AS category_name,
        u.fullname AS organizer_name,
        u.profile_image AS organizer_profile,
        u.email AS organizer_email,
        STRING_AGG(DISTINCT t.name, ', ') AS tags_display,
        COALESCE(SUM(b.seats), 0) AS total_seats_booked,
        COUNT(DISTINCT v.user_id) AS view_count
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      LEFT JOIN event_tags et ON e.id = et.event_id
      LEFT JOIN tags t ON et.tag_id = t.id
      LEFT JOIN bookings b ON e.id = b.event_id AND b.status != 'cancelled'
      LEFT JOIN event_views v ON e.id = v.event_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filter by category
    if (category) {
      query += ` AND e.category_id = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Filter by tags (comma-separated)
    if (tags) {
      const tagArray = tags.split(',');
      query += ` AND EXISTS (
        SELECT 1 FROM event_tags et2 
        JOIN tags t2 ON et2.tag_id = t2.id 
        WHERE et2.event_id = e.id 
        AND t2.name = ANY($${paramIndex})
      )`;
      params.push(tagArray);
      paramIndex++;
    }

    // Filter by venue/location
    if (venue) {
      query += ` AND (e.location ILIKE $${paramIndex} OR e.venue ILIKE $${paramIndex})`;
      params.push(`%${venue}%`);
      paramIndex++;
    }

    // Filter by price range
    if (minPrice) {
      query += ` AND e.price >= $${paramIndex}`;
      params.push(parseFloat(minPrice));
      paramIndex++;
    }
    if (maxPrice) {
      query += ` AND e.price <= $${paramIndex}`;
      params.push(parseFloat(maxPrice));
      paramIndex++;
    }

    // Filter by date range
    if (startDate) {
      query += ` AND e.event_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      query += ` AND e.event_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Filter by status
    if (status) {
      query += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    } else {
      query += ` AND e.status = 'upcoming' AND e.event_date >= CURRENT_DATE`;
    }

    // Search functionality
    if (search) {
      query += ` AND (
        e.title ILIKE $${paramIndex} OR 
        e.description ILIKE $${paramIndex} OR 
        e.location ILIKE $${paramIndex} OR
        u.fullname ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Exclude specific event
    if (exclude) {
      query += ` AND e.id != $${paramIndex}`;
      params.push(exclude);
      paramIndex++;
    }

    // Group by
    query += ` GROUP BY e.id, c.name, u.fullname, u.profile_image, u.email`;

    // Sort by
    switch (sortBy) {
      case "date_desc":
        query += ` ORDER BY e.event_date DESC, e.start_time DESC`;
        break;
      case "price_asc":
        query += ` ORDER BY e.price ASC`;
        break;
      case "price_desc":
        query += ` ORDER BY e.price DESC`;
        break;
      case "popular":
        query += ` ORDER BY view_count DESC, total_seats_booked DESC`;
        break;
      case "name_asc":
        query += ` ORDER BY e.title ASC`;
        break;
      default: // date_asc
        query += ` ORDER BY e.event_date ASC, e.start_time ASC`;
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    // Add popularity flag and early bird status
    const enhancedEvents = result.rows.map(event => ({
      ...event,
      is_trending: event.view_count > 100,
      is_early_bird: event.early_bird_deadline && new Date(event.early_bird_deadline) > new Date()
    }));

    res.json({ events: enhancedEvents, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ======================
// GET recommendations for user
// ======================
router.get("/recommendations", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's booking history to find preferred categories and tags
    const historyResult = await db.query(`
      SELECT DISTINCT e.category_id, STRING_AGG(DISTINCT t.id::text, ',') as tag_ids
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      LEFT JOIN event_tags et ON e.id = et.event_id
      LEFT JOIN tags t ON et.tag_id = t.id
      WHERE b.user_id = $1
      GROUP BY e.category_id
    `, [userId]);

    if (historyResult.rows.length === 0) {
      return res.json({ recommendations: [] });
    }

    const categories = historyResult.rows.map(r => r.category_id).filter(Boolean);
    const tagIds = historyResult.rows
      .map(r => r.tag_ids)
      .filter(Boolean)
      .join(',')
      .split(',')
      .filter(Boolean);

    // Find similar events
    let query = `
      SELECT DISTINCT e.*, c.name AS category_name, u.fullname AS organizer_name
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      LEFT JOIN event_tags et ON e.id = et.event_id
      WHERE e.status = 'upcoming' 
      AND e.event_date >= CURRENT_DATE
      AND e.id NOT IN (SELECT event_id FROM bookings WHERE user_id = $1)
    `;

    const params = [userId];

    if (categories.length > 0 || tagIds.length > 0) {
      query += ` AND (e.category_id = ANY($2) OR et.tag_id = ANY($3))`;
      params.push(categories, tagIds.map(Number));
    }

    query += ` ORDER BY e.event_date ASC LIMIT 10`;

    const result = await db.query(query, params);
    res.json({ recommendations: result.rows });
  } catch (err) {
    console.error("Error fetching recommendations:", err);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// ======================
// Track event view
// ======================
router.post("/:id/track-view", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await db.query(`
      INSERT INTO event_views (event_id, user_id, viewed_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (event_id, user_id) DO UPDATE SET viewed_at = NOW()
    `, [id, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error tracking view:", err);
    res.status(500).json({ error: "Failed to track view" });
  }
});

// ======================
// Favorite event
// ======================
router.post("/:id/favorite", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await db.query(`
      INSERT INTO event_favorites (event_id, user_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT DO NOTHING
    `, [id, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error favoriting event:", err);
    res.status(500).json({ error: "Failed to favorite event" });
  }
});

// ======================
// Unfavorite event
// ======================
router.delete("/:id/favorite", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await db.query(`
      DELETE FROM event_favorites WHERE event_id = $1 AND user_id = $2
    `, [id, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error unfavoriting event:", err);
    res.status(500).json({ error: "Failed to unfavorite event" });
  }
});

// ======================
// Get favorites
// ======================
router.get("/favorites", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(`
      SELECT e.*, c.name AS category_name, u.fullname AS organizer_name
      FROM event_favorites ef
      JOIN events e ON ef.event_id = e.id
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      WHERE ef.user_id = $1
      ORDER BY ef.created_at DESC
    `, [userId]);

    res.json({ favorites: result.rows.map(r => r.id) });
  } catch (err) {
    console.error("Error fetching favorites:", err);
    res.status(500).json({ error: "Failed to fetch favorites" });
  }
});

// ======================
// Check if event is favorited
// ======================
router.get("/:id/is-favorite", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await db.query(`
      SELECT EXISTS(SELECT 1 FROM event_favorites WHERE event_id = $1 AND user_id = $2)
    `, [id, userId]);

    res.json({ is_favorite: result.rows[0].exists });
  } catch (err) {
    console.error("Error checking favorite:", err);
    res.status(500).json({ error: "Failed to check favorite" });
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
        u.profile_image AS organizer_profile,
        STRING_AGG(DISTINCT t.id::text, ',') AS tag_ids,
        STRING_AGG(DISTINCT t.name, ', ') AS tags_display
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      LEFT JOIN event_tags et ON e.id = et.event_id
      LEFT JOIN tags t ON et.tag_id = t.id
      GROUP BY e.id, c.name, u.fullname, u.profile_image
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
        COALESCE(SUM(b.seats), 0) AS total_seats_booked,
        STRING_AGG(DISTINCT t.id::text, ',') AS tag_ids
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      LEFT JOIN bookings b ON b.event_id = e.id AND b.status != 'cancelled'
      LEFT JOIN event_tags et ON e.id = et.event_id
      LEFT JOIN tags t ON et.tag_id = t.id
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
        u.profile_image AS organizer_profile,
        u.email AS organizer_email,
        STRING_AGG(DISTINCT t.name, ', ') AS tags_display,
        COALESCE(SUM(b.seats), 0) AS total_seats_booked
      FROM events e
      LEFT JOIN event_categories c ON e.category_id = c.id
      LEFT JOIN usercredentials u ON e.created_by = u.id
      LEFT JOIN event_tags et ON e.id = et.event_id
      LEFT JOIN tags t ON et.tag_id = t.id
      LEFT JOIN bookings b ON e.id = b.event_id AND b.status != 'cancelled'
      WHERE e.id = $1
      GROUP BY e.id, c.name, u.fullname, u.profile_image, u.email
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
  const client = await db.getClient();

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
      map_link,
      tag_ids,
      is_early_bird,
      early_bird_price,
      early_bird_deadline
    } = req.body;

    if (!title || !event_date || !start_time || !end_time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (category_id) {
      const catResult = await client.query(
        "SELECT id FROM event_categories WHERE id = $1",
        [category_id]
      );
      if (catResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid category ID" });
      }
    }

    await client.query("BEGIN");

    const result = await client.query(`
      INSERT INTO events
      (title, description, category_id, location, event_date, start_time, end_time, capacity, price, status, created_by, image, venue, organizer_email, parking_info, map_link, is_early_bird, early_bird_price, early_bird_deadline)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
      map_link || null,
      is_early_bird || false,
      early_bird_price || null,
      early_bird_deadline || null
    ]);

    const eventId = result.rows[0].id;

    // Insert tags
    if (tag_ids) {
      const tagArray = tag_ids.split(',').filter(Boolean);
      for (const tagId of tagArray) {
        await client.query(`
          INSERT INTO event_tags (event_id, tag_id) VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [eventId, parseInt(tagId)]);
      }
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Event created successfully",
      event_id: eventId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating event:", err);
    res.status(500).json({ error: "Failed to create event" });
  } finally {
    client.release();
  }
});

// ======================
// BULK UPLOAD events
// ======================
router.post("/bulk-upload", verifyToken, verifyAdmin, upload.single("file"), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const filePath = req.file.path;
    const events = [];

    await client.query("BEGIN");

    // Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => events.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    // Insert events
    for (const event of events) {
      await client.query(`
        INSERT INTO events
        (title, description, category_id, location, event_date, start_time, end_time, capacity, price, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        event.title,
        event.description || null,
        event.category_id || null,
        event.location || null,
        event.event_date,
        event.start_time,
        event.end_time,
        parseInt(event.capacity) || 0,
        parseFloat(event.price) || 0,
        event.status || "upcoming",
        req.user.id
      ]);
    }

    await client.query("COMMIT");

    // Clean up file
    fs.unlinkSync(filePath);

    res.json({ message: `Successfully uploaded ${events.length} events` });
  } catch (err) {
    await client.query("ROLLBACK");
    if (req.file) fs.unlinkSync(req.file.path);
    console.error("Bulk upload error:", err);
    res.status(500).json({ error: "Bulk upload failed" });
  } finally {
    client.release();
  }
});

// ======================
// UPDATE event
// ======================
router.put("/:id", verifyToken, async (req, res) => {
  const client = await db.getClient();

  try {
    const existingResult = await client.query("SELECT * FROM events WHERE id = $1", [req.params.id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const event = existingResult.rows[0];
    if (req.user.id !== event.created_by && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: not allowed to update this event" });
    }

    await client.query("BEGIN");

    const fields = [
      "title","description","category_id","location","event_date","start_time","end_time",
      "capacity","price","status","image","venue","organizer_email","parking_info","map_link",
      "is_early_bird","early_bird_price","early_bird_deadline"
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

    if (updates.length > 0) {
      values.push(req.params.id);
      await client.query(`UPDATE events SET ${updates.join(", ")} WHERE id = $${i}`, values);
    }

    // Update tags
    if (req.body.tag_ids !== undefined) {
      await client.query(`DELETE FROM event_tags WHERE event_id = $1`, [req.params.id]);
      
      if (req.body.tag_ids) {
        const tagArray = req.body.tag_ids.split(',').filter(Boolean);
        for (const tagId of tagArray) {
          await client.query(`
            INSERT INTO event_tags (event_id, tag_id) VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [req.params.id, parseInt(tagId)]);
        }
      }
    }

    await client.query("COMMIT");

    res.json({ message: "Event updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating event:", err);
    res.status(500).json({ error: "Failed to update event" });
  } finally {
    client.release();
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