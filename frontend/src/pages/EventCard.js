import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/EventCard.css";

const EventCard = ({ event, user, onSaveToFavorites }) => {
  const navigate = useNavigate();
  const [timeUntilEvent, setTimeUntilEvent] = useState("");
  const [isFavorite, setIsFavorite] = useState(event.is_favorited || false);

  // Calculate countdown timer
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const eventDateTime = new Date(`${event.event_date}T${event.start_time}`);
      const diff = eventDateTime - now;

      if (diff <= 0) {
        setTimeUntilEvent("Started");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeUntilEvent(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeUntilEvent(`${hours}h ${minutes}m`);
      } else {
        setTimeUntilEvent(`${minutes}m`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);

    return () => clearInterval(interval);
  }, [event.event_date, event.start_time]);

  // Calculate available seats and capacity percentage
  const availableSeats = event.capacity - (event.total_seats_booked || 0);
  const capacityPercentage = event.capacity > 0 
    ? ((event.total_seats_booked || 0) / event.capacity) * 100 
    : 0;

  const isSoldOut = availableSeats <= 0;
  const isAlmostFull = capacityPercentage >= 80 && !isSoldOut;
  const isLowSeats = availableSeats <= 10 && availableSeats > 0;

  const handleBookNow = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSoldOut) return;

    if (!user) {
      navigate("/dashboard/login", {
        state: { from: `/dashboard/book/${event.id}` },
        replace: true,
      });
    } else {
      navigate(`/dashboard/book/${event.id}`);
    }
  };

  const handleCardClick = () => {
    navigate(`/dashboard/events/${event.id}`);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
    if (onSaveToFavorites) {
      onSaveToFavorites(event.id, !isFavorite);
    }
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareData = {
      title: event.title,
      text: `Check out this event: ${event.title}`,
      url: window.location.origin + `/dashboard/events/${event.id}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Share cancelled");
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareData.url);
      alert("Link copied to clipboard!");
    }
  };

  const formatDate = (dateStr) => {
    const options = { weekday: "short", year: "numeric", month: "short", day: "numeric" };
    return new Date(dateStr).toLocaleDateString("en-GB", options);
  };

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return "Free";
    return `From KES ${Number(price).toLocaleString()}`;
  };

  const getStatusBadge = () => {
    if (isSoldOut) return { text: "Sold Out", class: "sold-out" };
    if (event.is_early_bird) return { text: "Early Bird", class: "early-bird" };
    if (event.is_trending) return { text: "🔥 Trending", class: "trending" };
    if (isAlmostFull) return { text: "Almost Full", class: "almost-full" };
    return null;
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="event-card" onClick={handleCardClick} role="article" aria-label={`Event: ${event.title}`}>
      {/* Image with badges overlay */}
      <div className="event-image-wrapper">
        <img 
          src={event.image || "/placeholder.jpg"} 
          alt={event.title} 
          className="event-image"
          loading="lazy"
        />
        
        {/* Top badges */}
        <div className="event-badges-top">
          {statusBadge && (
            <span className={`badge badge-${statusBadge.class}`}>
              {statusBadge.text}
            </span>
          )}
          {event.category_name && (
            <span className="badge badge-category">
              {event.category_name}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="event-actions">
          <button 
            className={`action-btn favorite-btn ${isFavorite ? 'active' : ''}`}
            onClick={handleFavoriteClick}
            aria-label="Add to favorites"
            title="Add to favorites"
          >
            {isFavorite ? '❤️' : '🤍'}
          </button>
          <button 
            className="action-btn share-btn"
            onClick={handleShare}
            aria-label="Share event"
            title="Share event"
          >
            📤
          </button>
        </div>
      </div>

      <div className="event-details">
        {/* Title */}
        <h3 className="event-title">{event.title}</h3>

        {/* Countdown timer */}
        {timeUntilEvent && timeUntilEvent !== "Started" && (
          <div className="event-countdown">
            🕒 Starts in {timeUntilEvent}
          </div>
        )}

        {/* Venue & Date */}
        <p className="event-venue">📍 {event.location}</p>
        <p className="event-date">📅 {formatDate(event.event_date)}</p>

        {/* Availability indicator */}
        {!isSoldOut && (
          <div className="event-availability">
            {isLowSeats && (
              <span className="availability-warning">
                ⚠️ Only {availableSeats} seats left!
              </span>
            )}
            {isAlmostFull && !isLowSeats && (
              <span className="availability-info">
                {availableSeats} seats available
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="event-pricing">
          <p className="event-price">{formatPrice(event.price)}</p>
          {event.original_price && event.original_price > event.price && (
            <span className="price-discount">
              <s>KES {Number(event.original_price).toLocaleString()}</s>
              <span className="discount-percentage">
                {Math.round(((event.original_price - event.price) / event.original_price) * 100)}% OFF
              </span>
            </span>
          )}
        </div>

        {/* Organizer info */}
        {(event.organizer_name || event.organizer_email) && (
          <div className="event-organizer">
            <div className="organizer-info">
              {event.organizer_name && (
                <p className="organizer-name">
                  👤 {event.organizer_name}
                  {event.is_verified_organizer && (
                    <span className="verified-badge" title="Verified Organizer">✓</span>
                  )}
                </p>
              )}
              {event.organizer_rating && (
                <div className="organizer-rating">
                  <span className="rating-stars">⭐ {event.organizer_rating.toFixed(1)}</span>
                  {event.organizer_event_count && (
                    <span className="event-count">· {event.organizer_event_count} events</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Book button */}
        <button 
          className={`book-btn ${isSoldOut ? 'sold-out' : ''}`}
          onClick={handleBookNow}
          disabled={isSoldOut}
          aria-label={isSoldOut ? "Event sold out" : user ? "Book now" : "Login to book"}
        >
          {isSoldOut ? "Sold Out" : user ? "Book Now" : "Login to Book"}
        </button>
      </div>
    </div>
  );
};

export default EventCard;