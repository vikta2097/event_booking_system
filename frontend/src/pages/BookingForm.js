import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/BookingForm.css";

const BookingForm = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Fetch event details
  useEffect(() => {
    const fetchEventAndTickets = async () => {
      try {
        const eventRes = await api.get(`/events/${id}`);
        setEvent(eventRes.data);

        const ticketsRes = await api.get(`/events/${id}/ticket-types`);
        const availableTickets = ticketsRes.data.map((t) => ({
          ...t,
          quantity: 0,
          subtotal: 0,
        }));
        setTickets(availableTickets);

        if (user?.phone) {
          setPhoneNumber(user.phone);
        }
      } catch (err) {
        console.error("Error fetching event or tickets:", err);
        setError("Failed to load event or tickets");
      }
    };

    fetchEventAndTickets();
  }, [id, user]);

  // Handle quantity change
  const handleQuantityChange = (ticketId, qty) => {
    const updatedTickets = tickets.map((t) => {
      if (t.id === ticketId) {
        const quantity = Math.max(0, Math.min(qty, t.quantity_available - t.quantity_sold));
        return { ...t, quantity, subtotal: quantity * t.price };
      }
      return t;
    });
    setTickets(updatedTickets);
  };

  const totalAmount = tickets.reduce((sum, t) => sum + t.subtotal, 0);

  const handleBooking = async (e) => {
    e.preventDefault();

    if (!user) {
      setError("Please log in to complete booking");
      navigate("/login");
      return;
    }

    if (!phoneNumber.trim()) {
      setError("Phone number is required for M-Pesa payment");
      return;
    }
    // eslint-disable-next-line
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    // eslint-disable-next-line
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");

    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Kenyan phone number (e.g., 0712345678)");
      return;
    }

    const selectedTickets = tickets.filter((t) => t.quantity > 0);

    if (selectedTickets.length === 0) {
      setError("Please select at least one ticket to book");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = selectedTickets.map((t) => ({
        ticket_type_id: t.id,
        quantity: t.quantity,
      }));

      const res = await api.post("/bookings", {
        event_id: id,
        tickets: payload,
      });

      navigate(`/dashboard/payment/${res.data.booking_id}`);
    } catch (err) {
      console.error("Booking error:", err);
      setError(err.response?.data?.error || "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!event || tickets.length === 0) {
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
            day: "numeric",
          })}
        </p>
        <p className="event-location">{event.location || event.venue}</p>
      </div>

      <div className="ticket-summary">
        <h4>Select Your Tickets</h4>
        {tickets.map((ticket) => (
          <div key={ticket.id} className="ticket-item">
            <span className="ticket-name">{ticket.name} (KES {ticket.price})</span>
            <input
              type="number"
              min={0}
              max={ticket.quantity_available - ticket.quantity_sold}
              value={ticket.quantity}
              onChange={(e) => handleQuantityChange(ticket.id, parseInt(e.target.value))}
            />
            <span className="ticket-subtotal">Subtotal: KES {ticket.subtotal.toLocaleString()}</span>
          </div>
        ))}
        <div className="total-amount">
          <strong>Total Amount: KES {totalAmount.toLocaleString()}</strong>
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
            onClick={() => navigate(`/dashboard/events/${id}/tickets`)}
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
    </div>
  );
};

export default BookingForm;
