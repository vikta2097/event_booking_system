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
        tt.quantity_sold,
        tt.is_early_bird,
        tt.early_bird_deadline,
        tt.is_group_discount,
        tt.group_size,
        tt.group_discount_percent,
        tt.created_at,
        (tt.quantity_available - tt.quantity_sold) AS remaining,
        CASE 
          WHEN tt.is_early_bird AND tt.early_bird_deadline >= CURRENT_DATE THEN true
          ELSE false
        END AS early_bird_active
      FROM ticket_types tt
      WHERE tt.event_id = $1
      ORDER BY tt.price ASC, tt.id ASC
    `, [eventId]);

    const ticketTypes = result.rows.map(t => ({
      ...t,
      quantity_sold: parseInt(t.quantity_sold),
      quantity_available: parseInt(t.quantity_available),
      remaining: parseInt(t.remaining),
      is_sold_out: parseInt(t.remaining) <= 0,
      is_low_stock: parseInt(t.remaining) > 0 && parseInt(t.remaining) <= 10
    }));

    res.json({ ticket_types: ticketTypes });
  } catch (err) {
    console.error("Error fetching ticket types:", err);
    res.status(500).json({ error: "Failed to fetch ticket types" });
  }
});

// ======================
// GET single ticket type with detailed info
// ======================
router.get("/ticket-types/:id", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        tt.id, 
        tt.event_id, 
        tt.name, 
        tt.description, 
        tt.price, 
        tt.quantity_available, 
        tt.quantity_sold,
        tt.is_early_bird,
        tt.early_bird_deadline,
        tt.is_group_discount,
        tt.group_size,
        tt.group_discount_percent,
        e.title AS event_title,
        e.event_date,
        (tt.quantity_available - tt.quantity_sold) AS remaining
      FROM ticket_types tt
      LEFT JOIN events e ON tt.event_id = e.id
      WHERE tt.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ticket type not found" });
    }

    const ticketType = result.rows[0];
    ticketType.remaining = parseInt(ticketType.remaining);
    ticketType.is_sold_out = ticketType.remaining <= 0;

    res.json(ticketType);
  } catch (err) {
    console.error("Error fetching ticket type:", err);
    res.status(500).json({ error: "Failed to fetch ticket type" });
  }
});

// ======================
// GET ticket type analytics
// ======================
router.get("/ticket-types/:id/analytics", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Sales over time
    const salesTrendResult = await db.query(`
      SELECT 
        DATE(b.created_at) as date,
        COUNT(*) as bookings,
        SUM(bt.quantity) as tickets_sold,
        SUM(bt.quantity * tt.price) as revenue
      FROM booking_tickets bt
      JOIN bookings b ON bt.booking_id = b.id
      JOIN ticket_types tt ON bt.ticket_type_id = tt.id
      WHERE bt.ticket_type_id = $1
        AND b.status != 'cancelled'
        AND b.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `, [id]);

    // Peak booking times
    const peakTimesResult = await db.query(`
      SELECT 
        EXTRACT(HOUR FROM b.created_at) as hour,
        COUNT(*) as booking_count
      FROM booking_tickets bt
      JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.ticket_type_id = $1
        AND b.status != 'cancelled'
      GROUP BY hour
      ORDER BY booking_count DESC
      LIMIT 5
    `, [id]);

    // Average purchase quantity
    const avgQuantityResult = await db.query(`
      SELECT 
        AVG(bt.quantity) as avg_quantity,
        MAX(bt.quantity) as max_quantity,
        MIN(bt.quantity) as min_quantity
      FROM booking_tickets bt
      JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.ticket_type_id = $1
        AND b.status != 'cancelled'
    `, [id]);

    res.json({
      sales_trend: salesTrendResult.rows,
      peak_booking_hours: peakTimesResult.rows,
      purchase_stats: avgQuantityResult.rows[0]
    });
  } catch (err) {
    console.error("Error fetching ticket type analytics:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ======================
// CREATE ticket type with enhanced features
// ======================
router.post("/events/:eventId/ticket-types", verifyToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { 
      name, 
      description, 
      price, 
      quantity_available,
      is_early_bird,
      early_bird_deadline,
      is_group_discount,
      group_size,
      group_discount_percent
    } = req.body;

    if (!name || price === undefined || quantity_available === undefined) {
      return res.status(400).json({ error: "Name, price, and quantity_available are required" });
    }
    if (price < 0) return res.status(400).json({ error: "Price cannot be negative" });
    if (quantity_available < 1) return res.status(400).json({ error: "Quantity must be at least 1" });

    // Validate early bird
    if (is_early_bird && !early_bird_deadline) {
      return res.status(400).json({ error: "Early bird deadline required when early bird pricing is enabled" });
    }

    // Validate group discount
    if (is_group_discount) {
      if (!group_size || !group_discount_percent) {
        return res.status(400).json({ error: "Group size and discount percent required for group discounts" });
      }
      if (group_discount_percent < 0 || group_discount_percent > 100) {
        return res.status(400).json({ error: "Discount percent must be between 0 and 100" });
      }
    }

    // Check event exists and permission
    const eventResult = await db.query(`SELECT created_by FROM events WHERE id = $1`, [eventId]);
    if (eventResult.rows.length === 0) return res.status(404).json({ error: "Event not found" });

    const event = eventResult.rows[0];
    if (req.user.role !== "admin" && req.user.id !== event.created_by) {
      return res.status(403).json({ error: "Only event creator or admin can add ticket types" });
    }

    const insert = await db.query(`
      INSERT INTO ticket_types 
        (event_id, name, description, price, quantity_available, quantity_sold, 
         is_early_bird, early_bird_deadline, is_group_discount, group_size, group_discount_percent)
      VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      eventId, 
      name, 
      description || null, 
      parseFloat(price), 
      parseInt(quantity_available),
      is_early_bird || false,
      early_bird_deadline || null,
      is_group_discount || false,
      group_size ? parseInt(group_size) : null,
      group_discount_percent ? parseFloat(group_discount_percent) : null
    ]);

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
    const { 
      name, 
      description, 
      price, 
      quantity_available,
      is_early_bird,
      early_bird_deadline,
      is_group_discount,
      group_size,
      group_discount_percent
    } = req.body;

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
      return res.status(400).json({ 
        error: `Cannot reduce quantity below ${ticketType.quantity_sold} already sold` 
      });
    }

    // Validate early bird
    if (is_early_bird && !early_bird_deadline) {
      return res.status(400).json({ error: "Early bird deadline required" });
    }

    // Validate group discount
    if (is_group_discount && (!group_size || !group_discount_percent)) {
      return res.status(400).json({ error: "Group size and discount percent required" });
    }

    const updates = [];
    const values = [];
    let i = 1;

    if (name) { updates.push(`name = $${i++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
    if (price !== undefined) { updates.push(`price = $${i++}`); values.push(parseFloat(price)); }
    if (quantity_available !== undefined) { 
      updates.push(`quantity_available = $${i++}`); 
      values.push(parseInt(quantity_available)); 
    }
    if (is_early_bird !== undefined) {
      updates.push(`is_early_bird = $${i++}`);
      values.push(is_early_bird);
    }
    if (early_bird_deadline !== undefined) {
      updates.push(`early_bird_deadline = $${i++}`);
      values.push(early_bird_deadline);
    }
    if (is_group_discount !== undefined) {
      updates.push(`is_group_discount = $${i++}`);
      values.push(is_group_discount);
    }
    if (group_size !== undefined) {
      updates.push(`group_size = $${i++}`);
      values.push(group_size ? parseInt(group_size) : null);
    }
    if (group_discount_percent !== undefined) {
      updates.push(`group_discount_percent = $${i++}`);
      values.push(group_discount_percent ? parseFloat(group_discount_percent) : null);
    }

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

// ======================
// GET available ticket types for booking (only non-sold-out)
// ======================
router.get("/events/:eventId/available-tickets", async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const result = await db.query(`
      SELECT 
        tt.id,
        tt.name,
        tt.description,
        tt.price,
        (tt.quantity_available - tt.quantity_sold) AS available,
        tt.is_early_bird,
        tt.early_bird_deadline,
        tt.is_group_discount,
        tt.group_size,
        tt.group_discount_percent,
        CASE 
          WHEN tt.is_early_bird AND tt.early_bird_deadline >= CURRENT_DATE THEN true
          ELSE false
        END AS early_bird_active
      FROM ticket_types tt
      WHERE tt.event_id = $1
        AND (tt.quantity_available - tt.quantity_sold) > 0
      ORDER BY tt.price ASC
    `, [eventId]);

    res.json({ available_tickets: result.rows });
  } catch (err) {
    console.error("Error fetching available tickets:", err);
    res.status(500).json({ error: "Failed to fetch available tickets" });
  }
});

module.exports = router;