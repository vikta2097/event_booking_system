import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/BookingForm.css";

const BookingForm = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch event and ticket types
  const fetchEventAndTickets = useCallback(async () => {
    try {
      const [eventRes, ticketsRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/ticket-types`)
      ]);

      setEvent(eventRes.data);
      const ticketArray = ticketsRes.data.ticket_types || [];
      setTickets(ticketArray);

      // Initialize ticket selection
      const initialSelection = {};
      ticketArray.forEach(t => { initialSelection[t.id] = 0; });
      setSelectedTickets(initialSelection);

    } catch (err) {
      console.error(err);
      setError("Failed to load event or tickets");
    }
  }, [id]);

  useEffect(() => { fetchEventAndTickets(); }, [fetchEventAndTickets]);

  const handleQuantityChange = (ticketId, qty) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    const quantity = Math.max(0, Math.min(qty, ticket.capacity - ticket.tickets_sold));
    setSelectedTickets(prev => ({ ...prev, [ticketId]: quantity }));
  };

  const totalAmount = tickets.reduce(
    (sum, t) => sum + (t.price * (selectedTickets[t.id] || 0)), 0
  );
  const totalTickets = Object.values(selectedTickets).reduce((sum, q) => sum + q, 0);

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

    // Validate Kenyan phone number
     // eslint-disable-next-line no-useless-escape
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
     // eslint-disable-next-line no-useless-escape
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Kenyan phone number (e.g., 0712345678)");
      return;
    }

    if (totalTickets === 0) {
      setError("Please select at least one ticket");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = tickets
        .filter(t => selectedTickets[t.id] > 0)
        .map(t => ({
          ticket_type_id: t.id,
          quantity: selectedTickets[t.id]
        }));

      const res = await api.post("/bookings", {
        event_id: id,
        tickets: payload
      });

      navigate(`/dashboard/payment/${res.data.booking_id}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!event) {
    return <p className="loading-text">{error || "Loading booking details..."}</p>;
  }

  return (
    <div className="booking-form">
      <h2>Book Tickets for {event.title}</h2>
      <p className="event-date">
        {new Date(event.event_date).toLocaleDateString("en-GB", {
          weekday: "long", year: "numeric", month: "long", day: "numeric"
        })}
      </p>
      <p className="event-location">{event.location || "Location not specified"}</p>

      <div className="ticket-types">
        {tickets.length > 0 ? tickets.map(ticket => (
          <div key={ticket.id} className="ticket-item">
            <span>{ticket.name} (KES {ticket.price})</span>
            <div className="ticket-controls">
              <button
                type="button"
                onClick={() => handleQuantityChange(ticket.id, selectedTickets[ticket.id] - 1)}
                disabled={selectedTickets[ticket.id] === 0}
              >-</button>
              <input
                type="number"
                min="0"
                max={ticket.capacity - ticket.tickets_sold}
                value={selectedTickets[ticket.id]}
                onChange={e => handleQuantityChange(ticket.id, parseInt(e.target.value) || 0)}
              />
              <button
                type="button"
                onClick={() => handleQuantityChange(ticket.id, selectedTickets[ticket.id] + 1)}
                disabled={selectedTickets[ticket.id] >= ticket.capacity - ticket.tickets_sold}
              >+</button>
            </div>
            {selectedTickets[ticket.id] > 0 && (
              <span>Subtotal: KES {(ticket.price * selectedTickets[ticket.id]).toLocaleString()}</span>
            )}
          </div>
        )) : <p>No tickets available for this event.</p>}
      </div>

      <form onSubmit={handleBooking}>
        <div className="form-group">
          <label htmlFor="phone">M-Pesa Phone Number</label>
          <input
            id="phone"
            type="tel"
            placeholder="0712345678"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            required
          />
        </div>

        <div className="summary">
          <strong>Total Tickets:</strong> {totalTickets} <br />
          <strong>Total Amount:</strong> KES {totalAmount.toLocaleString()}
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Proceed to Payment"}
        </button>
      </form>
    </div>
  );
};

export default BookingForm;
