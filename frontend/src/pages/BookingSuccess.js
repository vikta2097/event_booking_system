// src/components/BookingSuccess.js
import React, { useEffect, useRef, useState } from "react";
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

  // Helper: convert an SVG element to an Image (returns HTMLImageElement)
  const svgToImage = (svgElement) =>
    new Promise((resolve, reject) => {
      try {
        const svgData = new XMLSerializer().serializeToString(svgElement);

        // Add XML namespace if missing (helps some browsers)
        const hasNS = svgData.indexOf("xmlns") !== -1;
        const finalSvg = hasNS ? svgData : svgData.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

        const blob = new Blob([finalSvg], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const img = new Image();

        // For browsers that enforce tainted canvas when images are cross-origin:
        // we are using an object URL so crossOrigin is unnecessary — but keep fallback if needed.
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load SVG as image"));
        };
        img.src = url;
      } catch (err) {
        reject(err);
      }
    });

  // Download a single ticket as PNG (async)
  const handleDownloadTicket = async (ticket) => {
    try {
      // Select the QR SVG by the stable id (set below on the QR component)
      const svg = document.getElementById(`qr-${ticket.id}`);
      if (!svg) {
        alert("QR code not found — please ensure it is visible on screen and try again.");
        return;
      }

      const img = await svgToImage(svg);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Use the natural image size to preserve sharpness
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
        // revoke objectURL after a short delay so download can start
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    } catch (err) {
      console.error("Download single ticket error:", err);
      alert(err.message || "Failed to download ticket. Please try again.");
    }
  };

  // Download all tickets combined into one PNG
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

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header
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

        // Ticket title
        ctx.fillStyle = "#333";
        ctx.font = "bold 16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ticket.ticket_type_name || "General", x + ticketWidth / 2, y + 28);

        // QR Image (safely load & draw)
        const svg = document.getElementById(`qr-${ticket.id}`);
        if (svg) {
          try {
            // await each image so drawing order is deterministic
            // eslint-disable-next-line no-await-in-loop
            const img = await svgToImage(svg);
            // draw scaled QR into ticket area (centered)
            const qrSize = Math.min(200, ticketWidth - 40);
            const qrX = x + (ticketWidth - qrSize) / 2;
            const qrY = y + 50;
            ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
          } catch (imgErr) {
            console.warn(`Failed to render QR for ticket ${ticket.id}`, imgErr);
            // continue drawing the rest (fail gracefully)
          }
        } else {
          // no svg found: optional placeholder or text
          ctx.font = "12px Arial, sans-serif";
          ctx.fillStyle = "#999";
          ctx.fillText("QR not available", x + ticketWidth / 2, y + ticketHeight / 2);
        }

        // Quantity & reference
        ctx.font = "14px Arial, sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(`Qty: ${ticket.quantity || 1}`, x + ticketWidth / 2, y + 280);

        ctx.font = "12px Arial, sans-serif";
        ctx.fillStyle = "#666";
        ctx.fillText(`Ref: ${booking.reference || bookingId}`, x + ticketWidth / 2, y + 305);
      }

      // Create blob and trigger download
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
            <span className="value">{booking.location || "TBA"}</span>
          </div>
          <div className="detail-row">
            <span className="label">Total Paid:</span>
            <span className="value amount">
              KES {Number(booking.total_amount || 0).toLocaleString()}
            </span>
          </div>
        </div>

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

                  <div id={`ticket-${ticket.id}`} className="ticket-qr">
                    {/* stable id so our DOM selection is reliable */}
                    <QRCodeSVG id={`qr-${ticket.id}`} value={ticket.qr_code} size={150} level="H" includeMargin />
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
        </ul>
      </div>
    </div>
  );
};

export default BookingSuccess;
