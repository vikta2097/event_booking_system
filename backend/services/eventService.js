const db = require("../db");

/**
 * Deletes an event and all dependent records in the correct FK order.
 *
 * Dependency chain that must be unwound:
 *   events
 *     └── ticket_types
 *     └── bookings
 *           └── booking_tickets  (refs ticket_types + bookings)
 *           └── payments         (refs bookings)  ← was breaking cascade
 *     └── event_tags
 */
async function deleteEvent(eventId, user) {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    // 1. Ownership check
    const result = await client.query(
      "SELECT created_by FROM events WHERE id = $1",
      [eventId]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, status: 404, message: "Event not found" };
    }

    const isOwner = result.rows[0].created_by === user.id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      await client.query("ROLLBACK");
      return { success: false, status: 403, message: "Forbidden" };
    }

    // 2. Collect booking IDs for this event (needed to target child rows)
    const bookingsRes = await client.query(
      "SELECT id FROM bookings WHERE event_id = $1",
      [eventId]
    );
    const bookingIds = bookingsRes.rows.map((r) => r.id);

    if (bookingIds.length > 0) {
      // 3a. Delete payments (refs bookings)
      await client.query(
        "DELETE FROM payments WHERE booking_id = ANY($1::int[])",
        [bookingIds]
      );

      // 3b. Delete booking_tickets (refs bookings + ticket_types)
      await client.query(
        "DELETE FROM booking_tickets WHERE booking_id = ANY($1::int[])",
        [bookingIds]
      );

      // 3c. Delete bookings
      await client.query(
        "DELETE FROM bookings WHERE id = ANY($1::int[])",
        [bookingIds]
      );
    }

    // 4. Delete ticket_types (safe now that booking_tickets are gone)
    await client.query(
      "DELETE FROM ticket_types WHERE event_id = $1",
      [eventId]
    );

    // 5. Delete event_tags
    await client.query(
      "DELETE FROM event_tags WHERE event_id = $1",
      [eventId]
    );

    // 6. Finally delete the event itself
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

module.exports = { deleteEvent };