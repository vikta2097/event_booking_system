const cron = require("node-cron");
const db = require("./db");
const nodemailer = require("nodemailer");

// Email transporter configuration
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
};

// ======================
// Event Status Updater - Runs every minute
// ======================
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
         AND status != 'expired'
       RETURNING id, title`
    );

    if (expiredResult.rowCount > 0) {
      console.log(`✅ Expired events updated: ${expiredResult.rowCount}`);
      expiredResult.rows.forEach(event => {
        console.log(`   - ${event.title} (ID: ${event.id})`);
      });
    }

    // Ongoing events
    const ongoingResult = await db.query(
      `UPDATE events
       SET status = 'ongoing'
       WHERE 
         event_date = CURRENT_DATE
         AND start_time <= CURRENT_TIME
         AND end_time >= CURRENT_TIME
         AND status != 'ongoing'
       RETURNING id, title`
    );

    if (ongoingResult.rowCount > 0) {
      console.log(`🟢 Ongoing events updated: ${ongoingResult.rowCount}`);
      ongoingResult.rows.forEach(event => {
        console.log(`   - ${event.title} (ID: ${event.id})`);
      });
    }

    // Upcoming events
    const upcomingResult = await db.query(
      `UPDATE events
       SET status = 'upcoming'
       WHERE 
         (event_date > CURRENT_DATE)
         OR (event_date = CURRENT_DATE AND start_time > CURRENT_TIME)
         AND status NOT IN ('upcoming', 'cancelled')
       RETURNING id, title`
    );

    if (upcomingResult.rowCount > 0) {
      console.log(`🔵 Upcoming events updated: ${upcomingResult.rowCount}`);
    }

  } catch (err) {
    console.error("❌ Error updating event statuses:", err);
  }
});

// ======================
// Event Reminders - Runs every hour
// ======================
cron.schedule("0 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Sending event reminders...`);

  try {
    // Find events happening in 24 hours
    const upcomingEvents = await db.query(`
      SELECT DISTINCT
        e.id,
        e.title,
        e.event_date,
        e.start_time,
        e.location,
        e.venue,
        b.id AS booking_id,
        b.reference,
        u.email,
        u.fullname,
        COUNT(t.id) AS ticket_count
      FROM events e
      JOIN bookings b ON e.id = b.event_id
      JOIN usercredentials u ON b.user_id = u.id
      LEFT JOIN tickets t ON b.id = t.booking_id
      WHERE 
        e.event_date = CURRENT_DATE + INTERVAL '1 day'
        AND b.status = 'confirmed'
        AND NOT EXISTS (
          SELECT 1 FROM event_reminders er 
          WHERE er.booking_id = b.id AND er.reminder_type = '24h'
        )
      GROUP BY e.id, e.title, e.event_date, e.start_time, e.location, e.venue,
               b.id, b.reference, u.email, u.fullname
    `);

    if (upcomingEvents.rows.length > 0) {
      const transporter = createEmailTransporter();

      for (const event of upcomingEvents.rows) {
        try {
          const eventDate = new Date(event.event_date).toLocaleDateString("en-GB", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: event.email,
            subject: `Reminder: ${event.title} - Tomorrow!`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #ff9800; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">⏰ Event Reminder</h1>
                </div>
                
                <div style="padding: 20px;">
                  <p>Hello ${event.fullname},</p>
                  <p><strong>Your event is happening tomorrow!</strong></p>
                  
                  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h2 style="margin: 0 0 10px 0; color: #333;">${event.title}</h2>
                    <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${eventDate}</p>
                    <p style="margin: 5px 0;"><strong>⏰ Time:</strong> ${event.start_time}</p>
                    <p style="margin: 5px 0;"><strong>📍 Location:</strong> ${event.venue || event.location}</p>
                    <p style="margin: 5px 0;"><strong>🎫 Tickets:</strong> ${event.ticket_count}</p>
                    <p style="margin: 5px 0;"><strong>📋 Booking Ref:</strong> #${event.reference}</p>
                  </div>

                  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin: 0 0 10px 0;">📌 Important Reminders</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li>Arrive at least 30 minutes early</li>
                      <li>Bring your tickets (QR codes or manual codes)</li>
                      <li>Bring a valid ID for verification</li>
                      <li>Check traffic and parking information</li>
                    </ul>
                  </div>

                  <p>See you tomorrow! 🎉</p>
                </div>

                <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                  <p style="margin: 0;">&copy; ${new Date().getFullYear()} Event Booking. All rights reserved.</p>
                </div>
              </div>
            `,
          });

          // Mark reminder as sent
          await db.query(
            `INSERT INTO event_reminders (booking_id, reminder_type, sent_at) 
             VALUES ($1, '24h', NOW())`,
            [event.booking_id]
          );

          console.log(`✅ Reminder sent to ${event.email} for ${event.title}`);
        } catch (emailErr) {
          console.error(`❌ Failed to send reminder to ${event.email}:`, emailErr);
        }
      }

      console.log(`📧 Total reminders sent: ${upcomingEvents.rows.length}`);
    } else {
      console.log(`ℹ️  No upcoming events requiring reminders`);
    }
  } catch (err) {
    console.error("❌ Error sending event reminders:", err);
  }
});

// ======================
// Capacity Alerts - Runs every 30 minutes
// ======================
cron.schedule("*/30 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Checking event capacities...`);

  try {
    // Find events at 80% capacity
    const capacityAlerts = await db.query(`
      SELECT 
        e.id,
        e.title,
        e.capacity,
        e.event_date,
        COALESCE(SUM(b.seats), 0) AS booked_seats,
        ((COALESCE(SUM(b.seats), 0)::float / NULLIF(e.capacity, 0)) * 100) AS capacity_percent,
        u.email AS organizer_email,
        u.fullname AS organizer_name
      FROM events e
      JOIN usercredentials u ON e.created_by = u.id
      LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
      WHERE 
        e.status = 'upcoming'
        AND e.capacity > 0
        AND NOT EXISTS (
          SELECT 1 FROM capacity_alerts ca 
          WHERE ca.event_id = e.id AND ca.alert_threshold = 80
        )
      GROUP BY e.id, e.title, e.capacity, e.event_date, u.email, u.fullname
      HAVING ((COALESCE(SUM(b.seats), 0)::float / NULLIF(e.capacity, 0)) * 100) >= 80
    `);

    if (capacityAlerts.rows.length > 0) {
      const transporter = createEmailTransporter();

      for (const alert of capacityAlerts.rows) {
        try {
          const eventDate = new Date(alert.event_date).toLocaleDateString("en-GB");
          const remaining = alert.capacity - alert.booked_seats;

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: alert.organizer_email,
            subject: `⚠️ Capacity Alert: ${alert.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #ff5722; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">⚠️ Capacity Alert</h1>
                </div>
                
                <div style="padding: 20px;">
                  <p>Hello ${alert.organizer_name},</p>
                  <p>Your event <strong>"${alert.title}"</strong> is almost at full capacity!</p>
                  
                  <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <h2 style="margin: 0 0 10px 0; color: #333;">${Math.round(alert.capacity_percent)}% Full</h2>
                    <p style="margin: 5px 0; font-size: 18px;"><strong>${alert.booked_seats}</strong> / ${alert.capacity} seats booked</p>
                    <p style="margin: 5px 0; color: #d32f2f;"><strong>${remaining} seats remaining</strong></p>
                  </div>

                  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>📅 Event Date:</strong> ${eventDate}</p>
                    <p style="margin: 5px 0;"><strong>🎫 Tickets Sold:</strong> ${alert.booked_seats}</p>
                    <p style="margin: 5px 0;"><strong>📊 Capacity:</strong> ${Math.round(alert.capacity_percent)}%</p>
                  </div>

                  <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin: 0 0 10px 0;">💡 Next Steps</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li>Consider increasing venue capacity if possible</li>
                      <li>Monitor booking trends closely</li>
                      <li>Prepare contingency plans for sold-out scenarios</li>
                      <li>Update event description if capacity changes</li>
                    </ul>
                  </div>
                </div>

                <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                  <p style="margin: 0;">&copy; ${new Date().getFullYear()} Event Booking. All rights reserved.</p>
                </div>
              </div>
            `,
          });

          // Mark alert as sent
          await db.query(
            `INSERT INTO capacity_alerts (event_id, alert_threshold, alerted_at) 
             VALUES ($1, 80, NOW())`,
            [alert.id]
          );

          console.log(`⚠️  Capacity alert sent for ${alert.title} (${Math.round(alert.capacity_percent)}%)`);
        } catch (emailErr) {
          console.error(`❌ Failed to send capacity alert:`, emailErr);
        }
      }
    } else {
      console.log(`ℹ️  No events requiring capacity alerts`);
    }
  } catch (err) {
    console.error("❌ Error checking capacities:", err);
  }
});

// ======================
// Cleanup Old Data - Runs daily at 2 AM
// ======================
cron.schedule("0 2 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running data cleanup...`);

  try {
    // Archive events older than 1 year
    const archiveResult = await db.query(`
      UPDATE events
      SET status = 'archived'
      WHERE 
        event_date < CURRENT_DATE - INTERVAL '1 year'
        AND status = 'expired'
      RETURNING id, title
    `);

    if (archiveResult.rowCount > 0) {
      console.log(`🗄️  Archived ${archiveResult.rowCount} old events`);
    }

    // Clean up old event views (older than 6 months)
    const viewsResult = await db.query(`
      DELETE FROM event_views
      WHERE viewed_at < CURRENT_DATE - INTERVAL '6 months'
    `);

    if (viewsResult.rowCount > 0) {
      console.log(`🧹 Cleaned up ${viewsResult.rowCount} old event views`);
    }

    // Clean up expired payment attempts (older than 30 days)
    const paymentsResult = await db.query(`
      DELETE FROM payments
      WHERE 
        status IN ('failed', 'pending')
        AND created_at < CURRENT_DATE - INTERVAL '30 days'
    `);

    if (paymentsResult.rowCount > 0) {
      console.log(`💳 Cleaned up ${paymentsResult.rowCount} old payment records`);
    }

    // Clean up old fraud alerts (older than 90 days)
    const fraudResult = await db.query(`
      DELETE FROM fraud_alerts
      WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
    `);

    if (fraudResult.rowCount > 0) {
      console.log(`🔒 Cleaned up ${fraudResult.rowCount} old fraud alerts`);
    }

    console.log(`✅ Data cleanup completed successfully`);
  } catch (err) {
    console.error("❌ Error during data cleanup:", err);
  }
});

// ======================
// Analytics Aggregation - Runs daily at 3 AM
// ======================
cron.schedule("0 3 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Aggregating analytics data...`);

  try {
    // Aggregate daily stats
    await db.query(`
      INSERT INTO daily_stats (date, total_events, total_bookings, total_revenue, active_users)
      SELECT 
        CURRENT_DATE - INTERVAL '1 day' as date,
        COUNT(DISTINCT e.id) as total_events,
        COUNT(DISTINCT b.id) as total_bookings,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        COUNT(DISTINCT b.user_id) as active_users
      FROM events e
      LEFT JOIN bookings b ON e.id = b.event_id 
        AND DATE(b.created_at) = CURRENT_DATE - INTERVAL '1 day'
        AND b.status = 'confirmed'
      LEFT JOIN payments p ON b.id = p.booking_id 
        AND p.status = 'paid'
      ON CONFLICT (date) DO UPDATE SET
        total_events = EXCLUDED.total_events,
        total_bookings = EXCLUDED.total_bookings,
        total_revenue = EXCLUDED.total_revenue,
        active_users = EXCLUDED.active_users
    `);

    console.log(`📊 Daily analytics aggregated successfully`);
  } catch (err) {
    console.error("❌ Error aggregating analytics:", err);
  }
});

// ======================
// Log Scheduler Status
// ======================
console.log("✅ Event Scheduler initialized successfully");
console.log("📅 Scheduled tasks:");
console.log("   - Event status updates: Every minute");
console.log("   - Event reminders: Every hour");
console.log("   - Capacity alerts: Every 30 minutes");
console.log("   - Data cleanup: Daily at 2 AM");
console.log("   - Analytics aggregation: Daily at 3 AM");

module.exports = {
  // Export any functions if needed
};