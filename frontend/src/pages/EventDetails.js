import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/EventDetails.css";

const EventDetails = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [similarEvents, setSimilarEvents] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        setLoading(true);
        
        const eventRes = await api.get(`/events/${id}`);
        setEvent(eventRes.data);

        const ticketsRes = await api.get(`/events/${id}/ticket-types`);
        setTicketTypes(ticketsRes.data.ticket_types || []);

        if (eventRes.data.category_id) {
          const similarRes = await api.get(`/events?category=${eventRes.data.category_id}&limit=4&exclude=${id}`);
          setSimilarEvents(similarRes.data.events || similarRes.data || []);
        }

        if (user) {
          try {
            const favRes = await api.get(`/events/${id}/is-favorite`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            setIsFavorite(favRes.data.is_favorite);
          } catch (err) {
            console.log("Not checking favorite status");
          }
        }

        if (user) {
          api.post(`/events/${id}/track-view`, {}, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          }).catch(err => console.log("View tracking failed"));
        }

      } catch (err) {
        console.error(err);
        setError("Failed to load event details.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchEventDetails();
  }, [id, user]);

  // Add to Calendar
  const handleAddToCalendar = () => {
    if (!event) return;
    
    const startDate = new Date(`${event.event_date}T${event.start_time}`);
    const endDate = new Date(`${event.event_date}T${event.end_time || event.start_time}`);
    
    const formatDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const title = encodeURIComponent(event.title);
    const location = encodeURIComponent(event.venue || event.location || '');
    const details = encodeURIComponent(
      `${event.description || ''}\n\n` +
      `${event.parking_info ? `Parking: ${event.parking_info}\n` : ''}` +
      `Organizer: ${event.organizer_name || 'N/A'}`
    );
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${details}&location=${location}`;
    
    window.open(googleCalendarUrl, '_blank');
  };

  // Get Directions
  const handleGetDirections = () => {
    if (event?.map_link) {
      window.open(event.map_link, '_blank');
    } else if (event?.venue || event?.location) {
      const query = encodeURIComponent(event.venue || event.location);
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(googleMapsUrl, '_blank');
    } else {
      alert("Location information not available");
    }
  };

  // Contact Organizer
  const handleContactOrganizer = () => {
    if (event?.organizer_email) {
      window.location.href = `mailto:${event.organizer_email}?subject=Inquiry about ${event.title}`;
    } else {
      alert("Organizer contact information not available");
    }
  };

  if (loading) {
    return (
      <div className="event-details-loading">
        <div className="spinner-large"></div>
        <p>Loading event details...</p>
      </div>
    );
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!event) return <p className="no-event">Event not found.</p>;

  const handleBookNow = () => {
    if (!user) {
      navigate("/dashboard/login", {
        state: { from: `/dashboard/book/${event.id}` },
        replace: true,
      });
    } else {
      navigate(`/dashboard/book/${event.id}`);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!user) {
      alert("Please login to save favorites");
      return;
    }

    try {
      if (isFavorite) {
        await api.delete(`/events/${id}/favorite`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
      } else {
        await api.post(`/events/${id}/favorite`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
      }
      setIsFavorite(!isFavorite);
    } catch (err) {
      console.error("Error toggling favorite:", err);
      alert("Failed to update favorite");
    }
  };

  const handleShare = async (platform) => {
    const eventUrl = window.location.href;
    const text = `Check out ${event.title} on ${formatDate(event.event_date)}!`;
    
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + " " + eventUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(eventUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(eventUrl)}`,
      copy: eventUrl
    };

    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(eventUrl);
        alert("Link copied to clipboard!");
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    } else {
      window.open(shareUrls[platform], "_blank", "width=600,height=400");
    }
    
    setShowShareModal(false);
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
    return `KES ${Number(price).toLocaleString()}`;
  };

  const availableSeats = event.capacity - (event.total_seats_booked || 0);
  const isSoldOut = availableSeats <= 0;

  const eventImages = event.images || [event.image || "/placeholder.jpg"];

  // Check if early bird is active
  const isEarlyBirdActive = event.is_early_bird && 
    event.early_bird_deadline && 
    new Date(event.early_bird_deadline) >= new Date();

  // Parse tags
  const eventTags = event.tags_display ? event.tags_display.split(', ').filter(Boolean) : [];

  return (
    <div className="event-details-container">
      {/* Quick Action Bar - Sticky */}
      <div className="quick-action-bar-sticky">
        <button onClick={handleAddToCalendar} className="quick-btn" title="Add to Calendar">
          📅 Add to Calendar
        </button>
        <button onClick={handleGetDirections} className="quick-btn" title="Get Directions">
          📍 Directions
        </button>
        {event.organizer_email && (
          <button onClick={handleContactOrganizer} className="quick-btn" title="Contact Organizer">
            📧 Contact
          </button>
        )}
        <button onClick={() => setShowShareModal(true)} className="quick-btn" title="Share">
          📤 Share
        </button>
      </div>

      {/* Hero Section */}
      <div className="event-hero">
        <div className="event-image-gallery">
          <img 
            src={eventImages[activeImageIndex]} 
            alt={event.title} 
            className="main-image"
          />
          
          {eventImages.length > 1 && (
            <div className="image-thumbnails">
              {eventImages.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`View ${idx + 1}`}
                  className={`thumbnail ${idx === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(idx)}
                />
              ))}
            </div>
          )}

          <div className="hero-actions">
            <button 
              className={`action-btn ${isFavorite ? 'active' : ''}`}
              onClick={handleFavoriteToggle}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              {isFavorite ? '❤️' : '🤍'}
            </button>
          </div>
        </div>

        <div className="event-header-info">
          <div className="event-badges">
            {event.category_name && (
              <span className="badge badge-category">{event.category_name}</span>
            )}
            {isSoldOut && (
              <span className="badge badge-sold-out">Sold Out</span>
            )}
            {isEarlyBirdActive && (
              <span className="badge badge-early-bird">
                🎉 Early Bird - Save {Math.round(((event.price - event.early_bird_price) / event.price) * 100)}%
              </span>
            )}
            {event.parking_info && (
              <span className="badge badge-parking">🅿️ Parking Available</span>
            )}
          </div>

          <h1 className="event-title">{event.title}</h1>

          {/* Tags */}
          {eventTags.length > 0 && (
            <div className="event-tags">
              {eventTags.map((tag, idx) => (
                <span key={idx} className="tag-badge">{tag}</span>
              ))}
            </div>
          )}
          
          <div className="event-meta">
            <div className="meta-item">
              <span className="icon">📅</span>
              <span>{formatDate(event.event_date)}</span>
            </div>
            <div className="meta-item">
              <span className="icon">⏰</span>
              <span>{event.start_time} - {event.end_time}</span>
            </div>
            <div className="meta-item">
              <span className="icon">📍</span>
              <span>{event.venue || event.location}</span>
            </div>
            {!isSoldOut && (
              <div className="meta-item">
                <span className="icon">🎫</span>
                <span>{availableSeats} seats available</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Early Bird Alert */}
      {isEarlyBirdActive && (
        <div className="early-bird-alert">
          <div className="alert-content">
            <span className="alert-icon">⚡</span>
            <div className="alert-text">
              <strong>Early Bird Pricing Active!</strong>
              <p>
                Get tickets for <s>KES {event.price.toLocaleString()}</s> <strong className="highlight">KES {event.early_bird_price.toLocaleString()}</strong> 
                {" "}until {new Date(event.early_bird_deadline).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="event-content">
        {/* Left Column - Details */}
        <div className="event-main">
          {/* Description */}
          <section className="content-section">
            <h2>About This Event</h2>
            <p className="event-description">{event.description}</p>
          </section>

          {/* Venue & Parking Information */}
          {(event.venue || event.location || event.parking_info) && (
            <section className="content-section venue-section">
              <h2>📍 Venue & Location</h2>
              
              <div className="venue-card">
                {event.venue && (
                  <div className="venue-detail">
                    <strong>Venue:</strong> {event.venue}
                  </div>
                )}
                {event.location && (
                  <div className="venue-detail">
                    <strong>Address:</strong> {event.location}
                  </div>
                )}
                
                {event.parking_info && (
                  <div className="parking-info-box">
                    <div className="parking-header">
                      <span>🅿️</span>
                      <strong>Parking Information</strong>
                    </div>
                    <p>{event.parking_info}</p>
                  </div>
                )}

                <button className="btn-directions-primary" onClick={handleGetDirections}>
                  🗺️ Get Directions
                </button>
              </div>
            </section>
          )}

          {/* Map */}
          {event.map_link && (
            <section className="content-section">
              <h2>Location Map</h2>
              <div className="map-container">
                <iframe
                  src={event.map_link}
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Event location map"
                ></iframe>
              </div>
              <button className="map-link-btn" onClick={handleGetDirections}>
                📍 Open in Google Maps
              </button>
            </section>
          )}

          {/* Ticket Types */}
          {ticketTypes.length > 0 && (
            <section className="content-section">
              <h2>Available Tickets</h2>
              <div className="ticket-types-grid">
                {ticketTypes.map((ticket) => {
                  const ticketAvailable = ticket.quantity_available - ticket.quantity_sold;
                  const isTicketSoldOut = ticketAvailable <= 0;
                  const isEarlyBird = ticket.early_bird_active;
                  
                  return (
                    <div key={ticket.id} className={`ticket-type-card ${isTicketSoldOut ? 'sold-out' : ''} ${isEarlyBird ? 'early-bird-ticket' : ''}`}>
                      <div className="ticket-header">
                        <h3>{ticket.name}</h3>
                        <div className="ticket-price-section">
                          {isEarlyBird ? (
                            <div className="early-bird-pricing">
                              <span className="original-price">KES {ticket.price.toLocaleString()}</span>
                              <p className="discounted-price">KES {ticket.price.toLocaleString()}</p>
                              <span className="early-bird-label">⚡ Early Bird</span>
                            </div>
                          ) : (
                            <p className="ticket-price">{formatPrice(ticket.price)}</p>
                          )}
                        </div>
                      </div>
                      {ticket.description && (
                        <p className="ticket-description">{ticket.description}</p>
                      )}
                      <div className="ticket-footer">
                        {isTicketSoldOut ? (
                          <span className="ticket-status sold-out">Sold Out</span>
                        ) : (
                          <>
                            <span className="ticket-status available">
                              {ticketAvailable} available
                            </span>
                            {ticket.is_low_stock && (
                              <span className="low-stock-warning">⚠️ Low Stock!</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Organizer Info */}
          {event.organizer_name && (
            <section className="content-section organizer-section">
              <h2>Organized By</h2>
              <div className="organizer-card">
                {event.organizer_profile && (
                  <img 
                    src={event.organizer_profile} 
                    alt={event.organizer_name}
                    className="organizer-avatar"
                  />
                )}
                <div className="organizer-details">
                  <h3>
                    {event.organizer_name}
                    {event.is_verified_organizer && (
                      <span className="verified-badge" title="Verified">✓</span>
                    )}
                  </h3>
                  {event.organizer_rating && (
                    <div className="organizer-rating">
                      ⭐ {event.organizer_rating.toFixed(1)} 
                      {event.organizer_event_count && (
                        <span> · {event.organizer_event_count} events hosted</span>
                      )}
                    </div>
                  )}
                  {event.organizer_email && (
                    <button className="btn-contact-small" onClick={handleContactOrganizer}>
                      📧 Contact Organizer
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Booking Card */}
        <aside className="event-sidebar">
          <div className="booking-card sticky">
            <div className="booking-price">
              <span className="price-label">Starting from</span>
              {isEarlyBirdActive ? (
                <div className="price-with-discount">
                  <h2 className="price-value-old">KES {event.price.toLocaleString()}</h2>
                  <h2 className="price-value">KES {event.early_bird_price.toLocaleString()}</h2>
                  <span className="savings-badge">
                    Save {Math.round(((event.price - event.early_bird_price) / event.price) * 100)}%
                  </span>
                </div>
              ) : (
                <h2 className="price-value">{formatPrice(event.price)}</h2>
              )}
            </div>

            <button 
              className={`book-btn-large ${isSoldOut ? 'sold-out' : ''}`}
              onClick={handleBookNow}
              disabled={isSoldOut}
            >
              {isSoldOut ? "Sold Out" : user ? "Book Now" : "Login to Book"}
            </button>

            <div className="booking-features">
              <div className="feature">✓ Instant confirmation</div>
              <div className="feature">✓ E-ticket via email</div>
              <div className="feature">✓ Mobile entry</div>
              {event.parking_info && <div className="feature">✓ Parking available</div>}
            </div>
          </div>

          {/* Similar Events */}
          {similarEvents.length > 0 && (
            <div className="similar-events">
              <h3>Similar Events</h3>
              <div className="similar-events-list">
                {similarEvents.map(simEvent => (
                  <div 
                    key={simEvent.id} 
                    className="similar-event-item"
                    onClick={() => navigate(`/dashboard/events/${simEvent.id}`)}
                  >
                    <img src={simEvent.image || "/placeholder.jpg"} alt={simEvent.title} />
                    <div className="similar-event-info">
                      <h4>{simEvent.title}</h4>
                      <p>{formatDate(simEvent.event_date)}</p>
                      <p className="price">{formatPrice(simEvent.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Share this event</h3>
            <div className="share-buttons">
              <button onClick={() => handleShare("whatsapp")} className="share-btn whatsapp">
                WhatsApp
              </button>
              <button onClick={() => handleShare("twitter")} className="share-btn twitter">
                Twitter
              </button>
              <button onClick={() => handleShare("facebook")} className="share-btn facebook">
                Facebook
              </button>
              <button onClick={() => handleShare("linkedin")} className="share-btn linkedin">
                LinkedIn
              </button>
              <button onClick={() => handleShare("copy")} className="share-btn copy">
                Copy Link
              </button>
            </div>
            <button className="close-modal" onClick={() => setShowShareModal(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetails;