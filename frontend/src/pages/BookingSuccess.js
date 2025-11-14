import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode.react";
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
        const response = await api.get(`/bookings/${bookingId}`);
        setBooking(response.data);
      } catch (err) {
        setError("Failed to load booking details.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  const handleDownloadTicket = () => {
    // Simple example: download QR code as PNG
    const canvas = document.getElementById("booking-qr");
    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = `Ticket-${booking.reference}.png`;
    link.click();
  };

  if (loading) return <div className="booking-success">Loading booking details...</div>;
  if (error) return <div className="booking-success error">{error}</div>;

  return (
    <div className="booking-success">
      <h2>✔ Payment Successful!</h2>
      {booking && (
        <div className="booking-info">
          <p><strong>Booking #:</strong> {booking.reference}</p>
          <p><strong>Event:</strong> {booking.event_name}</p>
          <p><strong>Date & Venue:</strong> {new Date(booking.date).toLocaleString()} / {booking.venue}</p>
          <p><strong>Total Paid:</strong> ${booking.total_amount}</p>
          <div className="tickets">
            <strong>Tickets Purchased:</strong>
            <ul>
              {booking.tickets.map((ticket, index) => (
                <li key={index}>{ticket.type} x {ticket.quantity}</li>
              ))}
            </ul>
          </div>
          <div className="qr-code">
            <QRCode id="booking-qr" value={booking.reference} size={150} />
          </div>
          <div className="actions">
            <button onClick={handleDownloadTicket}>Download Ticket</button>
            <button onClick={() => navigate("/user/bookings")}>Go to My Bookings</button>
            <button onClick={() => navigate("/")}>Return Home</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingSuccess;
