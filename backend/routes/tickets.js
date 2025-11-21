// Add this endpoint to your tickets route file (e.g., routes/tickets.js)

const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

// POST /tickets/send-email/:bookingId
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

    if (booking.booking_status !== "confirmed") {
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
          cid: `ticket-${ticket.id}`, // Content ID for embedding in HTML
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
            <h1 style="margin: 0;">🎫 Your Tickets</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Hello ${booking.fullname},</p>
            <p>Thank you for your booking! Here are your tickets for:</p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin: 0 0 10px 0; color: #333;">${booking.event_title}</h2>
              <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${eventDate}</p>
              <p style="margin: 5px 0;"><strong>⏰ Time:</strong> ${booking.start_time} - ${booking.end_time}</p>
              <p style="margin: 5px 0;"><strong>📍 Venue:</strong> ${booking.location}</p>
              <p style="margin: 5px 0;"><strong>🔖 Booking Reference:</strong> #${booking.reference}</p>
            </div>

            <h3>Your Tickets</h3>
            ${ticketsHtml}

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin: 0 0 10px 0;">⚠️ Important Information</h4>
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
            <p style="margin: 0;">© ${new Date().getFullYear()} Event Booking. All rights reserved.</p>
          </div>
        </div>
      `,
      attachments: ticketAttachments,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Tickets sent to your email successfully" });
  } catch (err) {
    console.error("❌ Send tickets email error:", err);
    res.status(500).json({ message: "Failed to send tickets email" });
  }
});

module.exports = router;