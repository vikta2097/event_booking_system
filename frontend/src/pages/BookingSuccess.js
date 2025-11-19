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

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        // Fetch booking details
        const response = await api.get(`/bookings/${bookingId}`);
        const bookingData = response.data;

        // If booking not confirmed, redirect to payment
        if (bookingData.booking_status !== 'confirmed') {
          setError("This booking has not been confirmed yet. Please complete payment.");
          setTimeout(() => navigate(`/payment/${bookingId}`), 3000);
          return;
        }

        // Fetch tickets for this booking
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
        <button onClick={() => navigate("/")} className="btn-home">
          Return Home
        </button>
      </div>
    );

  if (!booking)
    return (
      <div className="booking-success error-container">
        <h2>Booking Not Found</h2>
        <p>The booking you're looking for doesn't exist.</p>
        <button onClick={() => navigate("/")} className="btn-home">
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
                  <span className="ticket-type">{ticket.ticket_type_name || "General Ticket"}</span>
                  <span className="ticket-quantity">x {ticket.quantity || 1}</span>
                  {ticket.price && (
                    <span className="ticket-price">
                      KES {(ticket.price * (ticket.quantity || 1)).toLocaleString()}
                    </span>
                  )}
                  <div id={`ticket-${ticket.id}`} className="ticket-qr">
                    <QRCodeSVG value={ticket.qr_code} size={150} level="H" includeMargin={true} />
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
          <button onClick={() => navigate("/user/bookings")} className="btn-secondary">
            View My Bookings
          </button>
          <button onClick={() => navigate("/")} className="btn-home">
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
