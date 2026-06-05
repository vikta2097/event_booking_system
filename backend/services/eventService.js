const db = require("../db");

/**
 * Deletes an event (strict ownership/admin check only)
 */
async function deleteEvent(eventId, user) {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // 1. Fetch only ownership field (minimal query)
    const result = await client.query(
      "SELECT created_by FROM events WHERE id = $1",
      [eventId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return {
        success: false,
        status: 404,
        message: "Event not found",
      };
    }

    const event = result.rows[0];

    // 2. Authorization
    const isOwner = event.created_by === user.id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      await client.query("ROLLBACK");
      return {
        success: false,
        status: 403,
        message: "Forbidden",
      };
    }

    // 3. Delete ONLY event (rely on DB CASCADE or FK rules)
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