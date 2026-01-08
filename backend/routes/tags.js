const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");

// ===============================
// GET all tags
// ===============================
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, 
        name, 
        created_at,
        (SELECT COUNT(*) FROM event_tags WHERE tag_id = tags.id) as usage_count
      FROM tags
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching tags:", err);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// ===============================
// GET single tag by ID
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        t.id, 
        t.name, 
        t.created_at,
        COUNT(et.event_id) as usage_count
      FROM tags t
      LEFT JOIN event_tags et ON t.id = et.tag_id
      WHERE t.id = $1
      GROUP BY t.id, t.name, t.created_at
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching tag:", err);
    res.status(500).json({ error: "Failed to fetch tag" });
  }
});

// ===============================
// POST create new tag
// ===============================
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Tag name is required" });
    }

    // Check if tag already exists
    const existingResult = await db.query(
      "SELECT id FROM tags WHERE LOWER(name) = LOWER($1)",
      [name.trim()]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: "Tag already exists" });
    }

    const result = await db.query(
      "INSERT INTO tags (name) VALUES ($1) RETURNING id, name, created_at",
      [name.trim()]
    );

    res.status(201).json({
      message: "Tag created successfully",
      tag: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error creating tag:", err);
    res.status(500).json({ error: "Failed to create tag" });
  }
});

// ===============================
// PUT update tag
// ===============================
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Tag name is required" });
    }

    const existingResult = await db.query(
      "SELECT * FROM tags WHERE id = $1",
      [req.params.id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Check if new name already exists (for different tag)
    const duplicateCheck = await db.query(
      "SELECT id FROM tags WHERE LOWER(name) = LOWER($1) AND id != $2",
      [name.trim(), req.params.id]
    );
    
    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({ error: "Tag name already exists" });
    }

    await db.query(
      "UPDATE tags SET name = $1 WHERE id = $2",
      [name.trim(), req.params.id]
    );

    res.json({ message: "Tag updated successfully" });
  } catch (err) {
    console.error("❌ Error updating tag:", err);
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// ===============================
// DELETE tag
// ===============================
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Check if tag is being used
    const usageCheck = await db.query(
      "SELECT COUNT(*) as count FROM event_tags WHERE tag_id = $1",
      [req.params.id]
    );

    const usageCount = parseInt(usageCheck.rows[0].count);
    
    if (usageCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete tag used by ${usageCount} event(s). Please remove from events first.` 
      });
    }

    const result = await db.query(
      "DELETE FROM tags WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json({ message: "Tag deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting tag:", err);
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

// ===============================
// GET popular tags (most used)
// ===============================
router.get("/popular/list", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await db.query(`
      SELECT 
        t.id, 
        t.name,
        COUNT(et.event_id) as usage_count
      FROM tags t
      LEFT JOIN event_tags et ON t.id = et.tag_id
      GROUP BY t.id, t.name
      HAVING COUNT(et.event_id) > 0
      ORDER BY usage_count DESC, t.name ASC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching popular tags:", err);
    res.status(500).json({ error: "Failed to fetch popular tags" });
  }
});

module.exports = router;