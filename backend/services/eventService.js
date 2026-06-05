const db = require("../db");

/**
 * Safely deletes an event with all dependencies
 */
async function deleteEvent(eventId, user) {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // 1. Fetch event
    const { rows } = await client.query(
      "SELECT * FROM events WHERE id = $1",
      [eventId]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, status: 404, message: "Event not found" };
    }

    const event = rows[0];

    // 2. Authorization check
    const isOwner = user.id === event.created_by;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      await client.query("ROLLBACK");
      return { success: false, status: 403, message: "Forbidden" };
    }

    // 3. Delete dependent records (safe order)
    await client.query("DELETE FROM event_tags WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM event_views WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM event_favorites WHERE event_id = $1", [eventId]);
    await client.query("DELETE FROM bookings WHERE event_id = $1", [eventId]);

    // 4. Delete main event
    await client.query("DELETE FROM events WHERE id = $1", [eventId]);

    await client.query("COMMIT");

    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");

    return {
      success: false,
      status: 500,
      message: "Delete failed",
      error: err.message,
    };
  } finally {
    client.release();
  }
}

module.exports = {
  deleteEvent,
};