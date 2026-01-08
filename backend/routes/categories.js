const express = require("express");
const router = express.Router();
const db = require("../db");

// ===============================
// GET all event categories with metadata
// ===============================
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.id, 
        c.name, 
        c.description, 
        c.icon,
        c.color,
        c.created_at,
        COUNT(e.id) AS event_count,
        COALESCE(SUM(CASE WHEN e.status = 'upcoming' THEN 1 ELSE 0 END), 0) AS upcoming_events
      FROM event_categories c
      LEFT JOIN events e ON c.id = e.category_id
      GROUP BY c.id, c.name, c.description, c.icon, c.color, c.created_at
      ORDER BY event_count DESC, c.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching event categories:", err);
    res.status(500).json({ error: "Failed to fetch event categories" });
  }
});

// ===============================
// GET single category by ID with stats
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        c.id, 
        c.name, 
        c.description, 
        c.icon,
        c.color,
        c.created_at,
        COUNT(e.id) AS event_count,
        COALESCE(SUM(CASE WHEN e.status = 'upcoming' THEN 1 ELSE 0 END), 0) AS upcoming_events,
        COALESCE(SUM(CASE WHEN e.event_date >= CURRENT_DATE THEN 1 ELSE 0 END), 0) AS future_events
      FROM event_categories c
      LEFT JOIN events e ON c.id = e.category_id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.description, c.icon, c.color, c.created_at
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching category by ID:", err);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

// ===============================
// GET popular categories (most events)
// ===============================
router.get("/popular/list", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await db.query(`
      SELECT 
        c.id, 
        c.name, 
        c.description,
        c.icon,
        c.color,
        COUNT(e.id) AS event_count,
        COUNT(DISTINCT b.id) AS total_bookings
      FROM event_categories c
      LEFT JOIN events e ON c.id = e.category_id
      LEFT JOIN bookings b ON e.id = b.event_id AND b.status != 'cancelled'
      GROUP BY c.id, c.name, c.description, c.icon, c.color
      HAVING COUNT(e.id) > 0
      ORDER BY event_count DESC, total_bookings DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching popular categories:", err);
    res.status(500).json({ error: "Failed to fetch popular categories" });
  }
});

// ===============================
// POST create new event category with metadata
// ===============================
router.post("/", async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Category name is required" });
    }

    // Check if category already exists
    const existingResult = await db.query(
      "SELECT id FROM event_categories WHERE name = $1",
      [name.trim()]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: "Category already exists" });
    }

    const result = await db.query(
      "INSERT INTO event_categories (name, description, icon, color) VALUES ($1, $2, $3, $4) RETURNING id, name, description, icon, color",
      [name.trim(), description || null, icon || null, color || '#3b82f6']
    );

    res.status(201).json({
      message: "Category created successfully",
      category: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error creating category:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// ===============================
// PUT update event category
// ===============================
router.put("/:id", async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;
    
    const existingResult = await db.query(
      "SELECT * FROM event_categories WHERE id = $1",
      [req.params.id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const existing = existingResult.rows[0];

    // Check if new name already exists (for different category)
    if (name && name.trim() !== existing.name) {
      const duplicateCheck = await db.query(
        "SELECT id FROM event_categories WHERE name = $1 AND id != $2",
        [name.trim(), req.params.id]
      );
      
      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({ error: "Category name already exists" });
      }
    }

    await db.query(
      "UPDATE event_categories SET name = $1, description = $2, icon = $3, color = $4 WHERE id = $5",
      [
        name || existing.name,
        description !== undefined ? description : existing.description,
        icon !== undefined ? icon : existing.icon,
        color || existing.color,
        req.params.id,
      ]
    );

    res.json({ message: "Category updated successfully" });
  } catch (err) {
    console.error("❌ Error updating category:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// ===============================
// DELETE event category (only if no events)
// ===============================
router.delete("/:id", async (req, res) => {
  try {
    // Check if category has events
    const eventsCheck = await db.query(
      "SELECT COUNT(*) as count FROM events WHERE category_id = $1",
      [req.params.id]
    );

    const eventCount = parseInt(eventsCheck.rows[0].count);
    
    if (eventCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category with ${eventCount} event(s). Please reassign or delete events first.` 
      });
    }

    const result = await db.query(
      "DELETE FROM event_categories WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// ===============================
// GET category analytics
// ===============================
router.get("/:id/analytics", async (req, res) => {
  try {
    const { id } = req.params;

    // Monthly event trend
    const trendResult = await db.query(`
      SELECT 
        TO_CHAR(event_date, 'YYYY-MM') as month,
        COUNT(*) as event_count,
        COUNT(DISTINCT b.id) as booking_count,
        COALESCE(SUM(b.seats), 0) as total_seats
      FROM events e
      LEFT JOIN bookings b ON e.id = b.event_id AND b.status != 'cancelled'
      WHERE e.category_id = $1
        AND e.event_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month ASC
    `, [id]);

    // Top organizers in this category
    const organizersResult = await db.query(`
      SELECT 
        u.id,
        u.fullname,
        COUNT(e.id) as event_count,
        COUNT(DISTINCT b.id) as total_bookings
      FROM events e
      JOIN usercredentials u ON e.created_by = u.id
      LEFT JOIN bookings b ON e.id = b.event_id AND b.status != 'cancelled'
      WHERE e.category_id = $1
      GROUP BY u.id, u.fullname
      ORDER BY event_count DESC
      LIMIT 5
    `, [id]);

    // Average ticket price
    const priceResult = await db.query(`
      SELECT 
        AVG(price) as avg_price,
        MIN(price) as min_price,
        MAX(price) as max_price
      FROM events
      WHERE category_id = $1 AND price > 0
    `, [id]);

    res.json({
      trend: trendResult.rows,
      top_organizers: organizersResult.rows,
      pricing: priceResult.rows[0]
    });
  } catch (err) {
    console.error("❌ Error fetching category analytics:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

module.exports = router;