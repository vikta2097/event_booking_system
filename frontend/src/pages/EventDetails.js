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
      // ✅ FIXED: Navigate to dashboard login
      navigate("/dashboard/login");
    } else {
      // ✅ FIXED: Navigate to ticket selection page
      navigate(`/dashboard/events/${event.id}/tickets`);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return "Free";
    return `From KES ${Number(price).toLocaleString()}`;
  };

  return (
    <div className="event-details">
      <img src={event.image_url || "/placeholder.jpg"} alt={event.title} />
      <div className="event-info">
        <h2>{event.title}</h2>
        <p className="event-description">{event.description}</p>
        <p><strong>Venue:</strong> {event.location}</p>
        <p><strong>Date:</strong> {formatDate(event.event_date)}</p>
        <p><strong>Price:</strong> {formatPrice(event.price)}</p>
        <button onClick={handleBookNow}>
          {user ? "Book Now" : "Login to Book"}
        </button>
      </div>
    </div>
  );
};

export default EventDetails;