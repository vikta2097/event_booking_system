import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/BookingForm.css";

const BookingForm = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [ticketSelection, setTicketSelection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/events/${id}`);
        setEvent(res.data);
      } catch (err) {
        console.error("Error fetching event:", err);
        setError("Failed to load event details");
      }
    };

    // Get ticket selection from localStorage (set by TicketSelection component)
    const storedSelection = localStorage.getItem("ticketSelection");
    if (storedSelection) {
      const selection = JSON.parse(storedSelection);
      if (selection.eventId === parseInt(id)) {
        setTicketSelection(selection);
      } else {
        // Wrong event, redirect back
        navigate(`/events/${id}/tickets`);
      }
    } else {
      // No selection, redirect to ticket selection
      navigate(`/events/${id}/tickets`);
    }

    fetchEvent();

    // Pre-fill phone number if user has one
    if (user && user.phone) {
      setPhoneNumber(user.phone);
    }
  }, [id, navigate, user]);

  const handleBooking = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setError("Please log in to complete booking");
      navigate("/dashboard/login");
      return;
    }

    if (!phoneNumber || phoneNumber.trim() === "") {
      setError("Phone number is required for M-Pesa payment");
      return;
    }

    // Validate phone number format
    // eslint-disable-next-line no-useless-escape
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    // eslint-disable-next-line no-useless-escape
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Kenyan phone number (e.g., 0712345678)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Prepare ticket data for backend
      const tickets = ticketSelection.tickets.map(ticket => ({
        ticket_type_id: ticket.ticketTypeId,
        quantity: ticket.quantity
      }));

      // Create booking
      const res = await api.post("/bookings", {
        event_id: id,
        tickets: tickets
      });

      // Clear localStorage
      localStorage.removeItem("ticketSelection");

      // Navigate to payment page
      navigate(`/payment/${res.data.booking_id}`);
    } catch (err) {
      console.error("Booking error:", err);
      setError(
        err.response?.data?.error || "Booking failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!event || !ticketSelection) {
    return <p className="loading-text">Loading booking details...</p>;
  }

  return (
    <div className="booking-form">
      <h2>Confirm Your Booking</h2>
      
      <div className="booking-summary">
        <h3>{event.title}</h3>
        <p className="event-date">
          {new Date(event.event_date).toLocaleDateString("en-GB", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          })}
        </p>
        <p className="event-location">{event.location || event.venue}</p>
      </div>

      <div className="ticket-summary">
        <h4>Selected Tickets</h4>
        {ticketSelection.tickets.map((ticket, index) => (
          <div key={index} className="ticket-item">
            <span className="ticket-name">
              {ticket.name} x {ticket.quantity}
            </span>
            <span className="ticket-price">
              KES {ticket.subtotal.toLocaleString()}
            </span>
          </div>
        ))}
        <div className="total-amount">
          <strong>Total Amount:</strong>
          <strong>KES {ticketSelection.totalAmount.toLocaleString()}</strong>
        </div>
      </div>

      <form onSubmit={handleBooking}>
        <div className="form-group">
          <label htmlFor="phone">
            M-Pesa Phone Number <span className="required">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="0712345678"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
          <small className="form-help">
            Enter the phone number to receive M-Pesa payment prompt
          </small>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate(`/events/${id}/tickets`)}
            className="btn-secondary"
            disabled={loading}
          >
            Back to Tickets
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Processing..." : "Proceed to Payment"}
          </button>
        </div>
      </form>

      <div className="payment-info">
        <h4>Payment Information</h4>
        <ul>
          <li>You will receive an M-Pesa STK push on your phone</li>
          <li>Enter your M-Pesa PIN to complete payment</li>
          <li>You will receive a confirmation SMS</li>
          <li>Your tickets will be available immediately after payment</li>
        </ul>
      </div>
    </div>
  );
};

export default BookingForm;