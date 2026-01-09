import React, { useEffect, useRef, useState } from "react";
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
  const isMounted = useRef(true);

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

        if (bookingData.booking_status !== "confirmed") {
          if (isMounted.current) {
            setError("This booking has not been confirmed yet. Redirecting to payment...");
            setTimeout(() => navigate(`/dashboard/payment/${bookingId}`), 3000);
          }
          return;
        }

        // Fetch event details for additional info
        const eventRes = await api.get(`/events/${bookingData.event_id}`);
        setEvent(eventRes.data);

        const ticketsRes = await api.get(`/tickets/by-booking/${bookingData.id}`);
        const ticketsData = Array.isArray(ticketsRes.data) ? ticketsRes.data : [];

        if (isMounted.current) setBooking({ ...bookingData, tickets: ticketsData });
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
    };
  }, [bookingId, navigate]);

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

  // Helper: convert an SVG element to an Image
  const svgToImage = (svgElement) =>
    new Promise((resolve, reject) => {
      try {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const hasNS = svgData.indexOf("xmlns") !== -1;
        const finalSvg = hasNS ? svgData : svgData.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

        const blob = new Blob([finalSvg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG as image"));
        };
        img.src = url;
      } catch (err) {
        reject(err);
      }
    });

  // Download a single ticket
  const handleDownloadTicket = async (ticket) => {
    try {
      const svg = document.getElementById(`qr-${ticket.id}`);
      if (!svg) {
        alert("QR code not found – please ensure it is visible on screen and try again.");
        return;
      }

      const img = await svgToImage(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const width = img.width || 300;
      const height = img.height || 300;
      canvas.width = width;
      canvas.height = height;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          alert("Failed to create image blob. Please try again.");
          return;
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const safeName = (ticket.ticket_type_name || "Ticket").replace(/[^a-z0-9_\- ]/gi, "");
        link.download = `Ticket-${safeName}-${booking?.reference || bookingId}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    } catch (err) {
      console.error("Download single ticket error:", err);
      alert(err.message || "Failed to download ticket. Please try again.");
    }
  };

  // Download all tickets combined
  const handleDownloadAllTickets = async () => {
    if (!booking?.tickets?.length) {
      alert("No tickets to download.");
      return;
    }

    try {
      const ticketWidth = 300;
      const ticketHeight = 400;
      const padding = 20;
      const cols = Math.min(booking.tickets.length, 3);
      const rows = Math.ceil(booking.tickets.length / cols);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = cols * (ticketWidth + padding) + padding;
      canvas.height = rows * (ticketHeight + padding) + padding + 120;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#333";
      ctx.font = "bold 24px Arial, sans-serif";
      ctx.textAlign = "center";
      const title = booking.event_title || "Event";
      ctx.fillText(title, canvas.width / 2, 40);

      ctx.font = "16px Arial, sans-serif";
      const dateStr = booking.event_date
        ? new Date(booking.event_date).toLocaleDateString()
        : "";
      ctx.fillText(`${dateStr} | ${booking.location || ""}`, canvas.width / 2, 70);

      for (let i = 0; i < booking.tickets.length; i++) {
        const ticket = booking.tickets[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * (ticketWidth + padding);
        const y = 100 + padding + row * (ticketHeight + padding);

        ctx.fillStyle = "#f9f9f9";
        ctx.fillRect(x, y, ticketWidth, ticketHeight);
        ctx.strokeStyle = "#ddd";
        ctx.strokeRect(x, y, ticketWidth, ticketHeight);

        ctx.fillStyle = "#333";
        ctx.font = "bold 16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ticket.ticket_type_name || "General", x + ticketWidth / 2, y + 28);

        const svg = document.getElementById(`qr-${ticket.id}`);
        if (svg) {
          try {
            const img = await svgToImage(svg);
            const qrSize = Math.min(200, ticketWidth - 40);
            const qrX = x + (ticketWidth - qrSize) / 2;
            const qrY = y + 50;
            ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
          } catch (imgErr) {
            console.warn(`Failed to render QR for ticket ${ticket.id}`, imgErr);
          }
        }

        ctx.font = "14px Arial, sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(`Qty: ${ticket.quantity || 1}`, x + ticketWidth / 2, y + 280);

        ctx.font = "12px Arial, sans-serif";
        ctx.fillStyle = "#666";
        ctx.fillText(`Ref: ${booking.reference || bookingId}`, x + ticketWidth / 2, y + 305);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          alert("Failed to create combined ticket image. Please try individually.");
          return;
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `All-Tickets-${booking.reference || bookingId}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    } catch (err) {
      console.error("Download all tickets error:", err);
      alert("Failed to download all tickets. Please try again.");
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

  if (error)
    return (
      <div className="booking-success error-container">
        <div className="error-icon">⚠️</div>
        <h2>Error</h2>
        <p>{error}</p>
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