import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/BookingForm.css";

const BookingForm = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/events/${id}`);
        setEvent(res.data);
      } catch (err) {
        console.error("Error fetching event:", err);
      }
    };

    fetchEvent();
  }, [id]);

  const handleBooking = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await api.post("/bookings", {
        event_id: id,
        seats: tickets,
        total_amount: tickets * event.price,
      });

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

  if (!event) return <p className="loading-text">Loading event...</p>;

  return (
    <div className="booking-form">
      <h2>Booking for: {event.title}</h2>
      <form onSubmit={handleBooking}>
        <label>
          Number of Tickets:
          <input
            type="number"
            min="1"
            max={event.capacity}
            value={tickets}
            onChange={(e) => setTickets(Number(e.target.value))}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : `Proceed to Payment`}
        </button>
      </form>
    </div>
  );
};

export default BookingForm;
