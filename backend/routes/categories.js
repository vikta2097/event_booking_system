const express = require("express");
const router = express.Router();
const db = require("../db");

// ===============================
// GET all event categories
// ===============================
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, description, created_at FROM event_categories ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching event categories:", err);
    res.status(500).json({ error: "Failed to fetch event categories" });
  }
});

// ===============================
// GET single category by ID
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, name, description, created_at FROM event_categories WHERE id = $1",
      [req.params.id]
    );

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
// POST create new event category
// ===============================
router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;

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
      "INSERT INTO event_categories (name, description) VALUES ($1, $2) RETURNING id",
      [name.trim(), description || null]
    );

    res.status(201).json({
      message: "Category created successfully",
      category: { id: result.rows[0].id, name, description },
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
    const { name, description } = req.body;
    
    const existingResult = await db.query(
      "SELECT * FROM event_categories WHERE id = $1",
      [req.params.id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    const existing = existingResult.rows[0];

    await db.query(
      "UPDATE event_categories SET name = $1, description = $2 WHERE id = $3",
      [
        name || existing.name,
        description || existing.description,
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
// DELETE event category
// ===============================
router.delete("/:id", async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM event_categories WHERE id = $1",
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

module.exports = router;