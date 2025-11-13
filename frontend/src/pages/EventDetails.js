import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api"; // ✅ import axios instance
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
    if (!user) navigate("/login");
    else navigate(`/book/${event.id}`);
  };

  return (
    <div className="event-details">
      <img src={event.image_url || "/placeholder.jpg"} alt={event.title} />
      <div className="event-info">
        <h2>{event.title}</h2>
        <p className="event-description">{event.description}</p>
        <p><strong>Venue:</strong> {event.location}</p>
        <p><strong>Date:</strong> {new Date(event.event_date).toLocaleDateString()}</p>
        <p><strong>Price:</strong> ${event.price}</p>
        <button onClick={handleBookNow}>{user ? "Book Now" : "Login to Book"}</button>
      </div>
    </div>
  );
};

export default EventDetails;
