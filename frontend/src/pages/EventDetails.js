import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/EventDetails.css";

const EventDetails = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/events/${id}`);
        setEvent(res.data);
      } catch (err) {
        console.error(err);
        setError("Failed to load event details.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  if (loading) return <p className="loading-text">Loading event details...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!event) return <p className="no-event">Event not found.</p>;

  const handleBookNow = () => {
    if (!user) {
      // ✅ Guest → redirect to login with return path
      navigate("/dashboard/login", {
        state: { from: `/dashboard/book/${event.id}` },
        replace: true,
      });
    } else {
      // ✅ Logged-in → go directly to booking
      navigate(`/dashboard/book/${event.id}`);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return "Free";
    return `From KES ${Number(price).toLocaleString()}`;
  };

  return (
    <div className="event-details">
      {/* Correct backend field: event.image */}
      <img src={event.image || "/placeholder.jpg"} alt={event.title} />

      <div className="event-info">
        <h2>{event.title}</h2>

        <p className="event-description">{event.description}</p>

        <p><strong>Venue:</strong> {event.location}</p>
        <p><strong>Date:</strong> {formatDate(event.event_date)}</p>
        <p><strong>Price:</strong> {formatPrice(event.price)}</p>

        {/* ---- OPTIONAL ORGANIZER INFO ---- */}
        {(event.organizer_name ||
          event.organizer_email ||
          event.organizer_profile) && (
          <div className="organizer-section">
            <h3>Organized By</h3>

            {event.organizer_name && (
              <p><strong>Name:</strong> {event.organizer_name}</p>
            )}

            {event.organizer_email && (
              <p><strong>Email:</strong> {event.organizer_email}</p>
            )}

            {event.organizer_profile && (
              <p><strong>About:</strong> {event.organizer_profile}</p>
            )}
          </div>
        )}

        <button onClick={handleBookNow}>
          {user ? "Book Now" : "Login to Book"}
        </button>
      </div>
    </div>
  );
};

export default EventDetails;