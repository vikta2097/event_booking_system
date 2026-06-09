import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import api from "../api";
import "../styles/BookingSuccess.css";

const BookingSuccess = ({ user }) => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [waitingForConfirm, setWaitingForConfirm] = useState(false);
  const isMounted = useRef(true);
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);
  const MAX_WAIT = 40; // 40 × 3s = 2 minutes

  // GET /bookings/:id returns b.* so the column is "status", not "booking_status".
  // "booking_status" is only aliased in the list endpoint. This helper normalises both.
  const getStatus = (data) => data?.status ?? data?.booking_status ?? "";

  useEffect(() => {
    isMounted.current = true;

    const fetchBooking = async () => {
      try {
        const response = await api.get(`/bookings/${bookingId}`);
        const bookingData = response.data;

        if (!bookingData) {
          if (isMounted.current) setError("Booking not found.");
          return;
        }

        // ── Already confirmed: load everything and show success ──
        if (getStatus(bookingData) === "confirmed") {
          const [eventRes, ticketsRes] = await Promise.all([
            api.get(`/events/${bookingData.event_id}`),
            api.get(`/tickets/by-booking/${bookingData.id}`),
          ]);
          const ticketsData = Array.isArray(ticketsRes.data) ? ticketsRes.data : [];
          if (isMounted.current) {
            setEvent(eventRes.data);
            setBooking({ ...bookingData, tickets: ticketsData });
          }
          return;
        }

        // ── Cancelled: go home ──
        if (getStatus(bookingData) === "cancelled") {
          if (isMounted.current) setError("This booking has been cancelled.");
          return;
        }

        // ── Pending: wait and poll — DO NOT redirect back to payment ──
        if (isMounted.current) setWaitingForConfirm(true);

        pollRef.current = setInterval(async () => {
          if (!isMounted.current) return;
          pollCountRef.current += 1;

          if (pollCountRef.current >= MAX_WAIT) {
            clearInterval(pollRef.current);
            if (isMounted.current) {
              setWaitingForConfirm(false);
              setError("Payment confirmation is taking longer than expected. Please check your M-Pesa messages. If you paid, your booking will confirm shortly — refresh this page.");
            }
            return;
          }

          try {
            const res = await api.get(`/bookings/${bookingId}`);
            if (getStatus(res.data) === "confirmed") {
              clearInterval(pollRef.current);
              const [eventRes, ticketsRes] = await Promise.all([
                api.get(`/events/${res.data.event_id}`),
                api.get(`/tickets/by-booking/${res.data.id}`),
              ]);
              const ticketsData = Array.isArray(ticketsRes.data) ? ticketsRes.data : [];
              if (isMounted.current) {
                setEvent(eventRes.data);
                setBooking({ ...res.data, tickets: ticketsData });
                setWaitingForConfirm(false);
              }
            }
          } catch (pollErr) {
            console.error("Poll error:", pollErr);
          }
        }, 3000);

      } catch (err) {
        console.error("Error fetching booking:", err);
        if (isMounted.current) setError("Failed to load booking details.");
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    fetchBooking();

    return () => {
      isMounted.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [bookingId]); // ← removed navigate from deps so this never re-runs on nav

  // Add to Calendar
  const handleAddToCalendar = () => {
    if (!booking || !event) return;
    
    const startDate = new Date(`${booking.event_date}T${booking.start_time}`);
    const endDate = new Date(`${booking.event_date}T${booking.end_time || booking.start_time}`);
    
    const formatDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const title = encodeURIComponent(booking.event_title);
    const location = encodeURIComponent(event.venue || event.location || '');
    const details = encodeURIComponent(
      `Booking Reference: ${booking.reference}\n` +
      `Tickets: ${booking.seats}\n` +
      `${event.parking_info ? `Parking: ${event.parking_info}\n` : ''}` +
      `Total: KES ${Number(booking.total_amount).toLocaleString()}`
    );
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${details}&location=${location}`;
    
    window.open(googleCalendarUrl, '_blank');
  };

  // Get Directions
  const handleGetDirections = () => {
    if (event?.map_link) {
      window.open(event.map_link, '_blank');
    } else if (event?.venue || event?.location) {
      const query = encodeURIComponent(event.venue || event.location);
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(googleMapsUrl, '_blank');
    } else {
      alert("Location information not available");
    }
  };

  // Contact Organizer
  const handleContactOrganizer = () => {
    if (event?.organizer_email) {
      window.location.href = `mailto:${event.organizer_email}?subject=Inquiry about ${booking.event_title}&body=Booking Reference: ${booking.reference}`;
    } else {
      alert("Organizer contact information not available");
    }
  };

  // ── Helper: SVG element → HTMLImageElement ──────────────────────────────
  const svgToImage = (svgElement) =>
    new Promise((resolve, reject) => {
      try {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const finalSvg = svgData.includes("xmlns")
          ? svgData
          : svgData.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
        const blob = new Blob([finalSvg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG load failed")); };
        img.src = url;
      } catch (err) { reject(err); }
    });

  // ── Helper: wrap text onto canvas within maxWidth ───────────────────────
  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = String(text).split(" ");
    let line = "";
    let currentY = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  };

  // ── Helper: draw one fully-detailed ticket card onto canvas ─────────────
  const drawTicketOnCanvas = async (ctx, ticket, offsetX, offsetY, W, H) => {
    const R = 12;

    // Card shadow
    ctx.shadowColor = "rgba(0,0,0,0.10)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // Card background
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(offsetX + R, offsetY);
    ctx.lineTo(offsetX + W - R, offsetY);
    ctx.quadraticCurveTo(offsetX + W, offsetY, offsetX + W, offsetY + R);
    ctx.lineTo(offsetX + W, offsetY + H - R);
    ctx.quadraticCurveTo(offsetX + W, offsetY + H, offsetX + W - R, offsetY + H);
    ctx.lineTo(offsetX + R, offsetY + H);
    ctx.quadraticCurveTo(offsetX, offsetY + H, offsetX, offsetY + H - R);
    ctx.lineTo(offsetX, offsetY + R);
    ctx.quadraticCurveTo(offsetX, offsetY, offsetX + R, offsetY);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Card border
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Green header bar
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.moveTo(offsetX + R, offsetY);
    ctx.lineTo(offsetX + W - R, offsetY);
    ctx.quadraticCurveTo(offsetX + W, offsetY, offsetX + W, offsetY + R);
    ctx.lineTo(offsetX + W, offsetY + 58);
    ctx.lineTo(offsetX, offsetY + 58);
    ctx.lineTo(offsetX, offsetY + R);
    ctx.quadraticCurveTo(offsetX, offsetY, offsetX + R, offsetY);
    ctx.closePath();
    ctx.fill();

    // Check circle in header
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(offsetX + 34, offsetY + 29, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 17px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✓", offsetX + 34, offsetY + 35);

    // Header text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.fillText("TICKET CONFIRMED", offsetX + 58, offsetY + 24);
    ctx.font = "11px Arial";
    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.fillText("Present at venue for entry", offsetX + 58, offsetY + 40);

    let curY = offsetY + 78;

    // Event title
    ctx.fillStyle = "#111827";
    ctx.font = "bold 17px Arial";
    ctx.textAlign = "center";
    curY = wrapText(ctx, booking.event_title || "Event", offsetX + W / 2, curY, W - 32, 22);
    curY += 6;

    // Divider
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offsetX + 20, curY);
    ctx.lineTo(offsetX + W - 20, curY);
    ctx.stroke();
    curY += 14;

    // Info rows
    const dateStr = booking.event_date
      ? new Date(booking.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : "TBA";
    const infoRows = [
      ["DATE",   dateStr],
      ["VENUE",  event?.venue || booking.location || "TBA"],
      ["TYPE",   ticket.ticket_type_name || ticket.name || "General"],
      ["QTY",    String(ticket.quantity || 1)],
      ["AMOUNT", "KES " + Number((ticket.price || 0) * (ticket.quantity || 1)).toLocaleString()],
    ];

    ctx.textAlign = "left";
    for (const [label, value] of infoRows) {
      ctx.font = "bold 9px Arial";
      ctx.fillStyle = "#9ca3af";
      ctx.fillText(label, offsetX + 20, curY);
      ctx.font = "13px Arial";
      ctx.fillStyle = "#1f2937";
      curY = wrapText(ctx, value, offsetX + 20, curY + 13, W - 40, 16);
      curY += 5;
    }

    // Perforation dashes
    curY += 6;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offsetX + 16, curY);
    ctx.lineTo(offsetX + W - 16, curY);
    ctx.stroke();
    ctx.restore();
    curY += 14;

    // QR code
    const qrSize = 140;
    const qrX = offsetX + (W - qrSize) / 2;
    const svg = document.getElementById("qr-" + ticket.id);
    if (svg) {
      try {
        const qrImg = await svgToImage(svg);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(qrX - 6, curY - 6, qrSize + 12, qrSize + 12);
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = 1;
        ctx.strokeRect(qrX - 6, curY - 6, qrSize + 12, qrSize + 12);
        ctx.drawImage(qrImg, qrX, curY, qrSize, qrSize);
      } catch (_) {
        ctx.fillStyle = "#f3f4f6";
        ctx.fillRect(qrX, curY, qrSize, qrSize);
        ctx.fillStyle = "#9ca3af";
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.fillText("QR unavailable", offsetX + W / 2, curY + qrSize / 2);
      }
    }
    curY += qrSize + 10;

    // QR hint
    ctx.font = "10px Arial";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.fillText("Scan QR code at venue", offsetX + W / 2, curY);
    curY += 16;

    // Manual code
    if (ticket.manual_code) {
      ctx.font = "bold 9px Arial";
      ctx.fillStyle = "#9ca3af";
      ctx.textAlign = "center";
      ctx.fillText("MANUAL ENTRY CODE", offsetX + W / 2, curY);
      curY += 12;

      ctx.fillStyle = "#f9fafb";
      const codeBoxW = W - 40;
      ctx.fillRect(offsetX + 20, curY, codeBoxW, 28);
      ctx.strokeStyle = "#d1d5db";
      ctx.lineWidth = 1;
      ctx.strokeRect(offsetX + 20, curY, codeBoxW, 28);
      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.fillText(ticket.manual_code, offsetX + W / 2, curY + 19);
      curY += 36;
    }

    // Footer reference
    ctx.font = "9px Arial";
    ctx.fillStyle = "#d1d5db";
    ctx.textAlign = "center";
    ctx.fillText("Ref: " + (booking.reference || ""), offsetX + W / 2, offsetY + H - 10);
  };

  // ── Download a single ticket ─────────────────────────────────────────────
  const handleDownloadTicket = async (ticket) => {
    try {
      const W = 360;
      const H = 600;
      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);

      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0, 0, W, H);

      await drawTicketOnCanvas(ctx, ticket, 16, 16, W - 32, H - 32);

      canvas.toBlob((blob) => {
        if (!blob) { alert("Failed to create ticket image."); return; }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const safeName = (ticket.ticket_type_name || "Ticket").replace(/[^a-z0-9_\- ]/gi, "");
        link.download = "Ticket-" + safeName + "-" + (booking?.reference || bookingId) + ".png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    } catch (err) {
      console.error("Download ticket error:", err);
      alert(err.message || "Failed to download ticket.");
    }
  };

  // ── Download all tickets on one sheet ───────────────────────────────────
  const handleDownloadAllTickets = async () => {
    if (!booking?.tickets?.length) { alert("No tickets to download."); return; }
    try {
      const TW = 320;
      const TH = 600;
      const PAD = 24;
      const cols = Math.min(booking.tickets.length, 2);
      const rows = Math.ceil(booking.tickets.length / cols);
      const HEADER = 84;

      const W = cols * TW + (cols + 1) * PAD;
      const H = HEADER + rows * TH + (rows + 1) * PAD;

      const canvas = document.createElement("canvas");
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);

      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0, 0, W, H);

      // Sheet header
      ctx.fillStyle = "#10b981";
      ctx.fillRect(0, 0, W, HEADER);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.fillText(booking.event_title || "Event Tickets", W / 2, 30);
      ctx.font = "13px Arial";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const ds = booking.event_date
        ? new Date(booking.event_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })
        : "";
      ctx.fillText(ds + (booking.location ? "  ·  " + booking.location : ""), W / 2, 52);
      ctx.font = "11px Arial";
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fillText("Ref: " + (booking.reference || bookingId), W / 2, 70);

      for (let i = 0; i < booking.tickets.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = PAD + col * (TW + PAD);
        const y = HEADER + PAD + row * (TH + PAD);
        await drawTicketOnCanvas(ctx, booking.tickets[i], x, y, TW, TH);
      }

      canvas.toBlob((blob) => {
        if (!blob) { alert("Failed to create tickets image."); return; }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "All-Tickets-" + (booking.reference || bookingId) + ".png";
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    } catch (err) {
      console.error("Download all tickets error:", err);
      alert("Failed to download tickets. Please try again.");
    }
  };

  const handleEmailTickets = async () => {
    if (!booking) {
      alert("Booking not loaded yet.");
      return;
    }

    setEmailSending(true);
    setEmailSent(false);

    try {
      await api.post(`/tickets/send-email/${bookingId}`);
      setEmailSent(true);
      alert("Tickets have been sent to your email!");
    } catch (err) {
      console.error("Email error:", err);
      alert(err?.response?.data?.message || "Failed to send tickets to email. Please try again.");
    } finally {
      if (isMounted.current) setEmailSending(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading)
    return (
      <div className="booking-success">
        <div className="loading-spinner" />
        <p>Loading booking details...</p>
      </div>
    );

  if (waitingForConfirm)
    return (
      <div className="booking-success">
        <div className="loading-spinner" />
        <h3>Confirming your payment...</h3>
        <p>We received your M-Pesa payment and are confirming your booking.</p>
        <p>This usually takes a few seconds — please don't close this page.</p>
        <small style={{ color: "#6b7280" }}>
          Checking... ({pollCountRef.current}/{MAX_WAIT})
        </small>
      </div>
    );

  if (error)
    return (
      <div className="booking-success error-container">
        <div className="error-icon">⚠️</div>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn-home" style={{ marginRight: "10px" }}>
          Refresh Page
        </button>
        <button onClick={() => navigate("/dashboard")} className="btn-home">
          Return Home
        </button>
      </div>
    );

  if (!booking)
    return (
      <div className="booking-success error-container">
        <h2>Booking Not Found</h2>
        <p>The booking you're looking for doesn't exist.</p>
        <button onClick={() => navigate("/dashboard")} className="btn-home">
          Return Home
        </button>
      </div>
    );

  return (
    <div className="booking-success">
      <div className="success-header">
        <div className="success-icon">✓</div>
        <h2>Payment Successful!</h2>
        <p className="success-message">Your booking has been confirmed. Check your email for details.</p>
      </div>

      {/* Quick Action Buttons */}
      <div className="quick-actions-bar">
        <button onClick={handleAddToCalendar} className="quick-action-btn">
          📅 Add to Calendar
        </button>
        <button onClick={handleGetDirections} className="quick-action-btn">
          📍 Get Directions
        </button>
        {event?.organizer_email && (
          <button onClick={handleContactOrganizer} className="quick-action-btn">
            📧 Contact Organizer
          </button>
        )}
      </div>

      <div className="booking-info-card">
        <div className="booking-header">
          <h3>{booking.event_title}</h3>
          <span className="booking-ref">#{booking.reference}</span>
        </div>

        <div className="booking-details">
          <div className="detail-row">
            <span className="label">Date:</span>
            <span className="value">
              {booking.event_date
                ? new Date(booking.event_date).toLocaleDateString("en-GB", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "TBA"}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Time:</span>
            <span className="value">
              {booking.start_time || "TBA"} - {booking.end_time || "TBA"}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Venue:</span>
            <span className="value">{event?.venue || booking.location || "TBA"}</span>
          </div>
          <div className="detail-row">
            <span className="label">Total Paid:</span>
            <span className="value amount">
              KES {Number(booking.total_amount || 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Event Venue Information Card */}
        {event && (event.venue || event.parking_info || event.map_link) && (
          <div className="venue-info-card">
            <h4>📍 Venue Information</h4>
            <div className="venue-details">
              {event.venue && (
                <div className="venue-item">
                  <span className="venue-label">Venue:</span>
                  <span className="venue-value">{event.venue}</span>
                </div>
              )}
              {event.location && (
                <div className="venue-item">
                  <span className="venue-label">Location:</span>
                  <span className="venue-value">{event.location}</span>
                </div>
              )}
              {event.parking_info && (
                <div className="venue-item parking-info">
                  <span className="venue-label">🅿️ Parking:</span>
                  <span className="venue-value">{event.parking_info}</span>
                </div>
              )}
            </div>
            {event.map_link && (
              <button className="btn-directions-large" onClick={handleGetDirections}>
                🗺️ Open in Google Maps
              </button>
            )}
          </div>
        )}

        {/* Organizer Contact Card */}
        {event && event.organizer_email && (
          <div className="organizer-contact-card">
            <h4>📧 Need Help?</h4>
            <p>Contact the event organizer if you have any questions</p>
            <button className="btn-contact-organizer" onClick={handleContactOrganizer}>
              Email Organizer
            </button>
          </div>
        )}

        {booking.tickets && booking.tickets.length > 0 && (
          <div className="tickets-section">
            <h4>Your Tickets</h4>
            <ul className="tickets-list">
              {booking.tickets.map((ticket) => (
                <li key={ticket.id} className="ticket-item">
                  <div className="ticket-top">
                    <div>
                      <span className="ticket-type">{ticket.ticket_type_name || "General Ticket"}</span>
                      <span className="ticket-quantity">x {ticket.quantity || 1}</span>
                    </div>
                    {ticket.price && (
                      <div className="ticket-price">
                        KES {(ticket.price * (ticket.quantity || 1)).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {ticket.manual_code && (
                    <div className="manual-code-section">
                      <label>🔑 Manual Entry Code:</label>
                      <div className="manual-code-display">
                        <code>{ticket.manual_code}</code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(ticket.manual_code);
                            alert('Code copied to clipboard!');
                          }}
                          className="btn-copy-code"
                          title="Copy code"
                        >
                          📋
                        </button>
                      </div>
                      <p className="manual-code-hint">
                        Enter this code at the venue if QR scan isn't available
                      </p>
                    </div>
                  )}

                  <div id={`ticket-${ticket.id}`} className="ticket-qr">
                    <QRCodeSVG id={`qr-${ticket.id}`} value={ticket.qr_code} size={150} level="H" includeMargin />
                    <p className="qr-hint">Scan QR code at venue</p>
                  </div>

                  <div className="ticket-actions">
                    <button onClick={() => handleDownloadTicket(ticket)} className="btn-download-ticket">
                      📥 Download Ticket
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="actions">
          <button onClick={handlePrint} className="btn-print">
            🖨️ Print All Tickets
          </button>
          <button onClick={handleDownloadAllTickets} className="btn-download-all">
            📥 Download All Tickets
          </button>
          <button onClick={handleEmailTickets} className="btn-email" disabled={emailSending}>
            {emailSending ? "Sending..." : emailSent ? "✓ Email Sent" : "📧 Email Tickets"}
          </button>
          <button onClick={() => navigate("/dashboard/my-bookings")} className="btn-secondary">
            View My Bookings
          </button>
          <button onClick={() => navigate("/dashboard")} className="btn-home">
            Return Home
          </button>
        </div>
      </div>

      <div className="important-info">
        <h4>Important Information</h4>
        <ul>
          <li>Please arrive at least 30 minutes before the event starts</li>
          <li>Bring a valid ID for verification</li>
          <li>This ticket is non-transferable</li>
          <li>Save or screenshot the QR codes for entry</li>
          <li>Check your email for full booking details</li>
          {event?.parking_info && <li>Parking: {event.parking_info}</li>}
        </ul>
      </div>
    </div>
  );
};

export default BookingSuccess;