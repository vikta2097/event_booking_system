import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/EventCard.css";

const EventCard = ({ event, user }) => {
  const navigate = useNavigate();

  const handleBookNow = () => {
    if (!user) {
      navigate("/dashboard/login"); // Redirect to login if not authenticated
    } else {
      // ✅ FIXED: Navigate to ticket selection page first
      navigate(`/dashboard/book/${event.id}`);
    }
  };

  const formatDate = (dateStr) => {
    const options = {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    };

    return new Date(dateStr).toLocaleDateString("en-GB", options);
  };

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return "From KES 0";
    return `From KES ${Number(price).toLocaleString()}`;
  };

  return (
    <div className="event-card">
      <div className="event-image-wrapper">
        <img
          src={event.image_url || "/placeholder.jpg"}
          alt={event.title}
          className="event-image"
        />
      </div>

      <div className="event-details">
        <h3 className="event-title">{event.title}</h3>
        <p className="event-venue">{event.location}</p>
        <p className="event-date">{formatDate(event.event_date)}</p>

        <p className="event-price">
          {formatPrice(event.price)}
        </p>

        <button className="book-btn" onClick={handleBookNow}>
          {user ? "Book Now" : "Login to Book"}
        </button>
      </div>
    </div>
  );
};

export default EventCard;