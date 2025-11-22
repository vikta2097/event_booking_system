const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, verifyAdmin } = require("../auth");
const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

// ======================
// POST /tickets/validate
// Validate and mark ticket as used (Admin/Staff only)
// ======================
router.post("/validate", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { qr_code } = req.body;

    if (!qr_code) {
      return res.status(400).json({ 
        valid: false, 
        message: "QR code is required" 
      });
    }

    await client.query("BEGIN");

    // Find ticket by QR code with event and booking info
    const ticketResult = await client.query(`
      SELECT 
        t.id,
        t.qr_code,
        t.status,
        t.used_at,
        t.booking_id,
        t.ticket_type_id,
        tt.name AS ticket_type_name,
        b.reference AS booking_reference,
        b.status AS booking_status,
        b.user_id,
        e.id AS event_id,
        e.title AS event_title,
        e.event_date,
        e.start_time,
        e.end_time,
        e.venue,
        e.location,
        u.fullname AS attendee_name,
        u.email AS attendee_email,
        u.phone AS attendee_phone
      FROM tickets t
      JOIN bookings b ON t.booking_id = b.id
      JOIN events e ON b.event_id = e.id
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      JOIN usercredentials u ON b.user_id = u.id
      WHERE t.qr_code = $1
      FOR UPDATE
    `, [qr_code]);

    // Ticket not found
    if (ticketResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ 
        valid: false, 
        message: "Invalid ticket - QR code not found" 
      });
    }

    const ticket = ticketResult.rows[0];

    // Check if booking is confirmed
    if (ticket.booking_status !== "confirmed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        valid: false, 
        message: `Booking not confirmed. Status: ${ticket.booking_status}`,
        ticket: {
          booking_reference: ticket.booking_reference,
          booking_status: ticket.booking_status
        }
      });
    }

    // Check if ticket already used
    if (ticket.status === "used") {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        valid: false, 
        message: "Ticket already used",
        ticket: {
          id: ticket.id,
          ticket_type: ticket.ticket_type_name,
          used_at: ticket.used_at,
          attendee_name: ticket.attendee_name,
          event_title: ticket.event_title
        }
      });
    }

    // Check if ticket is cancelled
    if (ticket.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        valid: false, 
        message: "Ticket has been cancelled" 
      });
    }

    // Check if event date matches today (optional - remove if you want early check-in)
    const eventDate = new Date(ticket.event_date).toDateString();
    const today = new Date().toDateString();
    
    if (eventDate !== today) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        valid: false, 
        message: `Ticket is for ${eventDate}, not today`,
        ticket: {
          event_title: ticket.event_title,
          event_date: ticket.event_date,
          attendee_name: ticket.attendee_name
        }
      });
    }

    // Mark ticket as used
    await client.query(`
      UPDATE tickets 
      SET status = 'used', used_at = NOW(), validated_by = $1 
      WHERE id = $2
    `, [req.user.id, ticket.id]);

    await client.query("COMMIT");

    // Return success with ticket details
    res.json({
      valid: true,
      message: "Ticket validated successfully",
      ticket: {
        id: ticket.id,
        ticket_type: ticket.ticket_type_name,
        booking_reference: ticket.booking_reference,
        event_title: ticket.event_title,
        event_date: ticket.event_date,
        start_time: ticket.start_time,
        venue: ticket.venue || ticket.location,
        attendee_name: ticket.attendee_name,
        attendee_email: ticket.attendee_email,
        validated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ticket validation error:", error);
    res.status(500).json({ 
      valid: false, 
      message: "Validation failed. Please try again." 
    });
  } finally {
    client.release();
  }
});

// ======================
// GET /tickets/validate/:qr_code
// Check ticket status without marking as used (preview)
// ======================
router.get("/validate/:qr_code", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { qr_code } = req.params;

    const ticketResult = await db.query(`
      SELECT 
        t.id,
        t.status,
        t.used_at,
        tt.name AS ticket_type_name,
        b.reference AS booking_reference,
        b.status AS booking_status,
        e.title AS event_title,
        e.event_date,
        e.start_time,
        e.venue,
        e.location,
        u.fullname AS attendee_name,
        u.email AS attendee_email
      FROM tickets t
      JOIN bookings b ON t.booking_id = b.id
      JOIN events e ON b.event_id = e.id
      JOIN ticket_types tt ON t.ticket_type_id = tt.id
      JOIN usercredentials u ON b.user_id = u.id
      WHERE t.qr_code = $1
    `, [qr_code]);

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ 
        found: false, 
        message: "Ticket not found" 
      });
    }

    const ticket = ticketResult.rows[0];

    res.json({
      found: true,
      ticket: {
        id: ticket.id,
        status: ticket.status,
        used_at: ticket.used_at,
        ticket_type: ticket.ticket_type_name,
        booking_reference: ticket.booking_reference,
        booking_status: ticket.booking_status,
        event_title: ticket.event_title,
        event_date: ticket.event_date,
        start_time: ticket.start_time,
        venue: ticket.venue || ticket.location,
        attendee_name: ticket.attendee_name,
        attendee_email: ticket.attendee_email
      }
    });

  } catch (error) {
    console.error("Ticket lookup error:", error);
    res.status(500).json({ 
      found: false, 
      message: "Lookup failed" 
    });
  }
});

// ======================
// PUT /tickets/unvalidate/:id
// Undo validation (Admin only - in case of mistake)
// ======================
router.put("/unvalidate/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE tickets 
      SET status = 'valid', used_at = NULL, validated_by = NULL 
      WHERE id = $1 AND status = 'used'
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Ticket not found or not in used status" 
      });
    }

    res.json({ 
      success: true, 
      message: "Ticket validation reversed" 
    });

  } catch (error) {
    console.error("Unvalidate error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to reverse validation" 
    });
  }
});

// ======================
// GET /tickets/event/:eventId/stats
// Get validation stats for an event (Admin only)
// ======================
router.get("/event/:eventId/stats", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;

    const statsResult = await db.query(`
      SELECT 
        COUNT(*) AS total_tickets,
        COUNT(CASE WHEN t.status = 'used' THEN 1 END) AS checked_in,
        COUNT(CASE WHEN t.status = 'valid' THEN 1 END) AS pending,
        COUNT(CASE WHEN t.status = 'cancelled' THEN 1 END) AS cancelled
      FROM tickets t
      JOIN bookings b ON t.booking_id = b.id
      WHERE b.event_id = $1
    `, [eventId]);

    const stats = statsResult.rows[0];

    res.json({
      total_tickets: parseInt(stats.total_tickets),
      checked_in: parseInt(stats.checked_in),
      pending: parseInt(stats.pending),
      cancelled: parseInt(stats.cancelled),
      check_in_rate: stats.total_tickets > 0 
        ? ((stats.checked_in / stats.total_tickets) * 100).toFixed(1) + '%' 
        : '0%'
    });

  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// ======================
// POST /tickets/generate/:bookingId
// Generate tickets for a confirmed booking (Admin only)
// ======================
router.post("/generate/:bookingId", verifyToken, verifyAdmin, async (req, res) => {
  const client = await db.getClient();
  const { bookingId } = req.params;

  try {
    await client.query("BEGIN");

    // Check booking is confirmed
    const bookingRes = await client.query(
      "SELECT * FROM bookings WHERE id = $1 AND status = 'confirmed'",
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      throw new Error("Booking not found or not confirmed");
    }

    // Check if tickets already exist
    const existingTickets = await client.query(
      "SELECT id FROM tickets WHERE booking_id = $1",
      [bookingId]
    );

    if (existingTickets.rows.length > 0) {
      throw new Error("Tickets already generated for this booking");
    }

    // Get booked ticket types
    const bookedTickets = await client.query(
      "SELECT ticket_type_id, quantity FROM booking_tickets WHERE booking_id = $1",
      [bookingId]
    );

    if (bookedTickets.rows.length === 0) {
      throw new Error("No ticket types found for this booking");
    }

    // Generate tickets
    const crypto = require("crypto");
    let totalGenerated = 0;

    for (const bt of bookedTickets.rows) {
      for (let i = 0; i < bt.quantity; i++) {
        const qrCode = "TKT-" + crypto.randomBytes(16).toString("hex").toUpperCase();
        await client.query(
          "INSERT INTO tickets (booking_id, ticket_type_id, qr_code, status) VALUES ($1, $2, $3, 'valid')",
          [bookingId, bt.ticket_type_id, qrCode]
        );
        totalGenerated++;
      }
    }

    // Update payment record
    await client.query(
      "UPDATE payments SET tickets_generated = true WHERE booking_id = $1",
      [bookingId]
    );

    await client.query("COMMIT");

    res.json({ 
      message: "Tickets generated successfully",
      tickets_generated: totalGenerated
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Generate tickets error:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ======================
// GET /tickets/by-booking/:bookingId
// Get all tickets for a booking
// ======================
router.get("/by-booking/:bookingId", verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin";

  try {
    const bookingCheck = await db.query(
      "SELECT user_id FROM bookings WHERE id = $1",
      [bookingId]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (!isAdmin && bookingCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await db.query(`
      SELECT 
        t.id, 
        t.qr_code, 
        t.ticket_type_id, 
        t.status,
        tt.name AS ticket_type_name, 
        tt.price,
        bt.quantity
      FROM tickets t
      LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id
      LEFT JOIN booking_tickets bt ON bt.booking_id = t.booking_id 
        AND bt.ticket_type_id = t.ticket_type_id
      WHERE t.booking_id = $1
    `, [bookingId]);

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching tickets:", err);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// ======================
// POST /tickets/send-email/:bookingId
// Send tickets via email
// ======================
router.post("/send-email/:bookingId", verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  const userId = req.user.id;

  try {
    // Get booking details
    const bookingResult = await db.query(
      `SELECT b.*, e.title as event_title, e.event_date, e.start_time, e.end_time, e.location,
              u.email, u.fullname
       FROM bookings b
       JOIN events e ON b.event_id = e.id
       JOIN usercredentials u ON b.user_id = u.id
       WHERE b.id = $1 AND b.user_id = $2`,
      [bookingId, userId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== "confirmed") {
      return res.status(400).json({ message: "Booking is not confirmed yet" });
    }

    // Get tickets for this booking
    const ticketsResult = await db.query(
      `SELECT t.*, tt.name as ticket_type_name, tt.price
       FROM tickets t
       LEFT JOIN ticket_types tt ON t.ticket_type_id = tt.id
       WHERE t.booking_id = $1`,
      [bookingId]
    );

    const tickets = ticketsResult.rows;

    if (tickets.length === 0) {
      return res.status(404).json({ message: "No tickets found for this booking" });
    }

    // Generate QR code images as base64
    const ticketAttachments = await Promise.all(
      tickets.map(async (ticket, index) => {
        const qrDataUrl = await QRCode.toDataURL(ticket.qr_code, {
          width: 300,
          margin: 2,
        });
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
        return {
          filename: `ticket-${index + 1}-${ticket.ticket_type_name || "general"}.png`,
          content: base64Data,
          encoding: "base64",
          cid: `ticket-${ticket.id}`,
        };
      })
    );

    // Format date
    const eventDate = new Date(booking.event_date).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Build ticket HTML
    const ticketsHtml = tickets
      .map(
        (ticket, index) => `
        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px;">
          <h4 style="margin: 0 0 10px 0;">${ticket.ticket_type_name || "General Admission"}</h4>
          <p style="margin: 5px 0;">Quantity: ${ticket.quantity || 1}</p>
          <p style="margin: 5px 0;">Price: KES ${(ticket.price * (ticket.quantity || 1)).toLocaleString()}</p>
          <div style="text-align: center; margin-top: 15px;">
            <img src="cid:ticket-${ticket.id}" alt="QR Code" style="width: 200px; height: 200px;" />
          </div>
          <p style="text-align: center; font-size: 12px; color: #666;">
            Scan this QR code at the venue
          </p>
        </div>
      `
      )
      .join("");

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: booking.email,
      subject: `Your Tickets for ${booking.event_title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #4CAF50; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Your Tickets</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Hello ${booking.fullname},</p>
            <p>Thank you for your booking! Here are your tickets for:</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin: 0 0 10px 0; color: #333;">${booking.event_title}</h2>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate}</p>
              <p style="margin: 5px 0;"><strong>Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
              <p style="margin: 5px 0;"><strong>Venue:</strong> ${booking.location}</p>
              <p style="margin: 5px 0;"><strong>Booking Reference:</strong> #${booking.reference}</p>
            </div>

            <h3>Your Tickets</h3>
            ${ticketsHtml}

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0;">Important Information</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Please arrive at least 30 minutes before the event</li>
                <li>Bring a valid ID for verification</li>
                <li>This ticket is non-transferable</li>
                <li>Save or screenshot the QR codes for entry</li>
              </ul>
            </div>

            <p>If you have any questions, please contact our support team.</p>
            <p>Enjoy the event!</p>
          </div>

          <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} Event Booking. All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: ticketAttachments,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Tickets sent to your email successfully" });
  } catch (err) {
    console.error("Send tickets email error:", err);
    res.status(500).json({ message: "Failed to send tickets email" });
  }
});

module.exports = router;