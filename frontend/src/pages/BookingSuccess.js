import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import api from "../api";
import "../styles/BookingSuccess.css";

const BookingSuccess = ({ user }) => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await api.get(`/bookings/${bookingId}`);
        const bookingData = response.data;

        if (bookingData.booking_status !== "confirmed") {
          setError("This booking has not been confirmed yet. Please complete payment.");
          setTimeout(() => navigate(`/dashboard/payment/${bookingId}`), 3000);
          return;
        }

        const ticketsRes = await api.get(`/tickets/by-booking/${bookingData.id}`);
        const ticketsData = ticketsRes.data;

        setBooking({ ...bookingData, tickets: ticketsData });
      } catch (err) {
        console.error("Error fetching booking:", err);
        setError("Failed to load booking details.");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId, navigate]);

  // Download single ticket as PNG
  const handleDownloadTicket = (ticket) => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const svg = document.querySelector(`#ticket-${ticket.id} svg`);
      if (!svg) return alert("QR code not found");

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = function () {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(function (blob) {
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `Ticket-${ticket.ticket_type_name || "Ticket"}-${booking.reference}.png`;
          link.click();
          URL.revokeObjectURL(url);
        });
      };
      img.src = url;
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download ticket. Please try again.");
    }
  };

  // Download all tickets as a single image
  const handleDownloadAllTickets = async () => {
    if (!booking?.tickets?.length) return;

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const ticketWidth = 300;
      const ticketHeight = 400;
      const padding = 20;
      const cols = Math.min(booking.tickets.length, 3);
      const rows = Math.ceil(booking.tickets.length / cols);

      canvas.width = cols * (ticketWidth + padding) + padding;
      canvas.height = rows * (ticketHeight + padding) + padding + 100;

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header
      ctx.fillStyle = "#333";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText(booking.event_title, canvas.width / 2, 40);

      ctx.font = "16px Arial";
      ctx.fillText(
        `${new Date(booking.event_date).toLocaleDateString()} | ${booking.location}`,
        canvas.width / 2,
        70
      );

      // Draw each ticket
      for (let i = 0; i < booking.tickets.length; i++) {
        const ticket = booking.tickets[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * (ticketWidth + padding);
        const y = 100 + padding + row * (ticketHeight + padding);

        // Ticket background
        ctx.fillStyle = "#f9f9f9";
        ctx.fillRect(x, y, ticketWidth, ticketHeight);
        ctx.strokeStyle = "#ddd";
        ctx.strokeRect(x, y, ticketWidth, ticketHeight);

        // Ticket type
        ctx.fillStyle = "#333";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(ticket.ticket_type_name || "General", x + ticketWidth / 2, y + 30);

        // QR Code
        const svg = document.querySelector(`#ticket-${ticket.id} svg`);
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(svgBlob);

          await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, x + 50, y + 50, 200, 200);
              URL.revokeObjectURL(url);
              resolve();
            };
            img.src = url;
          });
        }

        // Quantity
        ctx.font = "14px Arial";
        ctx.fillText(`Qty: ${ticket.quantity || 1}`, x + ticketWidth / 2, y + 280);

        // Reference
        ctx.font = "12px Arial";
        ctx.fillStyle = "#666";
        ctx.fillText(`Ref: ${booking.reference}`, x + ticketWidth / 2, y + 310);
      }

      // Download
      canvas.toBlob((blob) => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `All-Tickets-${booking.reference}.png`;
        link.click();
      });
    } catch (err) {
      console.error("Download all error:", err);
      alert("Failed to download tickets. Please try again.");
    }
  };

  // Send tickets to email
  const handleEmailTickets = async () => {
    setEmailSending(true);
    setEmailSent(false);

    try {
      await api.post(`/tickets/send-email/${bookingId}`);
      setEmailSent(true);
      alert("Tickets have been sent to your email!");
    } catch (err) {
      console.error("Email error:", err);
      alert(err.response?.data?.message || "Failed to send tickets to email. Please try again.");
    } finally {
      setEmailSending(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading)
    return (
      <div className="booking-success">
        <div className="loading-spinner"></div>
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
        <p className="success-message">
          Your booking has been confirmed. Check your email for details.
        </p>
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
              {new Date(booking.event_date).toLocaleDateString("en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Time:</span>
            <span className="value">
              {booking.start_time} - {booking.end_time}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Venue:</span>
            <span className="value">{booking.location}</span>
          </div>
          <div className="detail-row">
            <span className="label">Total Paid:</span>
            <span className="value amount">
              KES {parseFloat(booking.total_amount).toLocaleString()}
            </span>
          </div>
        </div>

        {booking.tickets && booking.tickets.length > 0 && (
          <div className="tickets-section">
            <h4>Your Tickets</h4>
            <ul className="tickets-list">
              {booking.tickets.map((ticket) => (
                <li key={ticket.id} className="ticket-item">
                  <span className="ticket-type">
                    {ticket.ticket_type_name || "General Ticket"}
                  </span>
                  <span className="ticket-quantity">x {ticket.quantity || 1}</span>
                  {ticket.price && (
                    <span className="ticket-price">
                      KES {(ticket.price * (ticket.quantity || 1)).toLocaleString()}
                    </span>
                  )}
                  <div id={`ticket-${ticket.id}`} className="ticket-qr">
                    <QRCodeSVG
                      value={ticket.qr_code}
                      size={150}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <button
                    onClick={() => handleDownloadTicket(ticket)}
                    className="btn-download-ticket"
                  >
                    📥 Download Ticket
                  </button>
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
          <button
            onClick={handleEmailTickets}
            className="btn-email"
            disabled={emailSending}
          >
            {emailSending ? "Sending..." : emailSent ? "✓ Email Sent" : "📧 Email Tickets"}
          </button>
          <button
            onClick={() => navigate("/dashboard/my-bookings")}
            className="btn-secondary"
          >
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
        </ul>
      </div>
    </div>
  );
};

export default BookingSuccess;