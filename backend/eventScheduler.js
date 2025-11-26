const cron = require("node-cron");
const db = require("./db"); // Your MySQL/Postgres/Mongo connection

// Run every minute (for real deployment, you can change frequency)
cron.schedule("* * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running event status updater...`);

  try {
    // Update expired events
    const expiredResult = await db.query(
      `UPDATE events 
       SET status = 'expired' 
       WHERE end_date < NOW() AND status != 'expired'`
    );
    console.log(`Expired events updated: ${expiredResult.affectedRows || 0}`);

    // Update ongoing events
    const ongoingResult = await db.query(
      `UPDATE events 
       SET status = 'ongoing' 
       WHERE start_date <= NOW() AND end_date >= NOW() AND status != 'ongoing'`
    );
    console.log(`Ongoing events updated: ${ongoingResult.affectedRows || 0}`);

    // Update upcoming events (optional if you allow manual changes)
    const upcomingResult = await db.query(
      `UPDATE events 
       SET status = 'upcoming' 
       WHERE start_date > NOW() AND status != 'upcoming'`
    );
    console.log(`Upcoming events updated: ${upcomingResult.affectedRows || 0}`);

  } catch (err) {
    console.error("Error updating event statuses:", err);
  }
});
