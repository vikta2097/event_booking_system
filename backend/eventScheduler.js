/*const cron = require("node-cron");
const db = require("./db");

// Runs every minute
cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running event status updater...`);

  try {
    // Expired events
    const expiredResult = await db.query(
      `UPDATE events
       SET status = 'expired'
       WHERE 
         (event_date < CURRENT_DATE)
         OR (event_date = CURRENT_DATE AND end_time < CURRENT_TIME)
         AND status != 'expired'`
    );

    console.log(`Expired events updated: ${expiredResult.rowCount}`);

    // Ongoing events
    const ongoingResult = await db.query(
      `UPDATE events
       SET status = 'ongoing'
       WHERE 
         event_date = CURRENT_DATE
         AND start_time <= CURRENT_TIME
         AND end_time >= CURRENT_TIME
         AND status != 'ongoing'`
    );

    console.log(`Ongoing events updated: ${ongoingResult.rowCount}`);

    // Upcoming events
    const upcomingResult = await db.query(
      `UPDATE events
       SET status = 'upcoming'
       WHERE 
         (event_date > CURRENT_DATE)
         OR (event_date = CURRENT_DATE AND start_time > CURRENT_TIME)
         AND status != 'upcoming'`
    );

    console.log(`Upcoming events updated: ${upcomingResult.rowCount}`);

  } catch (err) {
    console.error("Error updating event statuses:", err);
  }
});
*/
console.log("Event scheduler disabled for testing");