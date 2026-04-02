import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "../styles/EventDetails.css";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

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
  const mapContainer = useRef(null);
  const map = useRef(null);

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
          } catch {}
        }

        if (user) {
          api.post(`/events/${id}/track-view`, {}, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          }).catch(() => {});
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

  // ── Mapbox map initialisation ──
  useEffect(() => {
    if (!event || map.current || !mapContainer.current) return;

    const lng = event.longitude ? parseFloat(event.longitude) : 36.8219;
    const lat = event.latitude ? parseFloat(event.latitude) : -1.2921;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: event.longitude ? 15 : 10,
    });

    new mapboxgl.Marker({ color: "#E63946" })
      .setLngLat([lng, lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<strong>${event.venue || event.location || "Event Venue"}</strong>`
        )
      )
      .addTo(map.current);

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [event]);

  const handleAddToCalendar = () => {
    if (!event) return;
    const startDate = new Date(`${event.event_date}T${event.start_time}`);
    const endDate = new Date(`${event.event_date}T${event.end_time || event.start_time}`);
    const formatDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    const title = encodeURIComponent(event.title);
    const location = encodeURIComponent(event.venue || event.location || '');
    const details = encodeURIComponent(
      `${event.description || ''}\n\n` +
      `${event.parking_info ? `Parking: ${event.parking_info}\n` : ''}` +
      `Organizer: ${event.organizer_name || 'N/A'}`
    );
    window.open(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${details}&location=${location}`,
      '_blank'
    );
  };

  // ── UPDATED: uses lat/lng first, falls back to map_link then text search ──
  const handleGetDirections = () => {
    if (event?.latitude && event?.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`,
        '_blank', 'noopener,noreferrer'
      );
    } else if (event?.map_link) {
      let url = event.map_link;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (event?.venue || event?.location) {
      const query = encodeURIComponent(event.venue || event.location);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
    } else {
      alert("Location information not available");
    }
  };

  const handleContactOrganizer = () => {
    if (event?.organizer_email) {
      window.location.href = `mailto:${event.organizer_email}?subject=Inquiry about ${event.title}`;
    } else {
      alert("Organizer contact information not available");
    }
  };

  const handleBookNow = () => {
    if (!user) {
      navigate("/dashboard/login", { state: { from: `/dashboard/book/${event.id}` }, replace: true });
    } else {
      navigate(`/dashboard/book/${event.id}`);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!user) { alert("Please login to save favorites"); return; }
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
    } catch {
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
    };
    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(eventUrl);
        alert("Link copied to clipboard!");
      } catch {
        alert("Failed to copy link");
      }
    } else {
      window.open(shareUrls[platform], '_blank', 'noopener,noreferrer');
    }
    setShowShareModal(false);
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return "Free";
    return `KES ${Number(price).toLocaleString()}`;
  };

  if (loading) return (
    <div className="event-details-loading">
      <div className="spinner-large"></div>
      <p>Loading event details...</p>
    </div>
  );
  if (error) return <p className="error-text">{error}</p>;
  if (!event) return <p className="no-event">Event not found.</p>;

  const availableSeats = event.capacity - (event.total_seats_booked || 0);
  const isSoldOut = availableSeats <= 0;
  const isEarlyBirdActive = event.is_early_bird && event.early_bird_deadline && new Date(event.early_bird_deadline) >= new Date();

  return (
    <div className="event-details-container">
      {/* Back */}
      <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>

      <div className="event-details-layout">
        {/* Left Column */}
        <div className="event-main-content">
          {/* Hero Image */}
          <section className="event-hero">
            <img
              src={event.images?.[activeImageIndex] || event.image || "/placeholder.jpg"}
              alt={event.title}
              className="event-hero-image"
            />
            {event.images?.length > 1 && (
              <div className="image-thumbnails">
                {event.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`View ${idx + 1}`}
                    className={`thumbnail ${activeImageIndex === idx ? 'active' : ''}`}
                    onClick={() => setActiveImageIndex(idx)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Title & Actions */}
          <section className="content-section">
            <div className="event-title-row">
              <h1 className="event-detail-title">{event.title}</h1>
              <div className="title-actions">
                <button className={`btn-icon ${isFavorite ? 'active' : ''}`} onClick={handleFavoriteToggle} title="Save to favorites">
                  {isFavorite ? '❤️' : '🤍'}
                </button>
                <button className="btn-icon" onClick={() => setShowShareModal(true)} title="Share event">📤</button>
                <button className="btn-icon" onClick={handleAddToCalendar} title="Add to calendar">📅</button>
              </div>
            </div>

            <div className="event-meta-row">
              {event.category_name && <span className="meta-badge">{event.category_name}</span>}
              {event.is_trending && <span className="meta-badge trending">🔥 Trending</span>}
              {isEarlyBirdActive && <span className="meta-badge early-bird">⚡ Early Bird</span>}
            </div>
          </section>

          {/* Date & Time */}
          <section className="content-section">
            <h2>Date & Time</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-icon">📅</span>
                <div>
                  <p className="info-label">Date</p>
                  <p className="info-value">{formatDate(event.event_date)}</p>
                </div>
              </div>
              <div className="info-item">
                <span className="info-icon">🕒</span>
                <div>
                  <p className="info-label">Time</p>
                  <p className="info-value">{event.start_time} {event.end_time ? `– ${event.end_time}` : ''}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Description */}
          {event.description && (
            <section className="content-section">
              <h2>About This Event</h2>
              <p className="event-description">{event.description}</p>
            </section>
          )}

          {/* Venue */}
          {(event.venue || event.location) && (
            <section className="content-section">
              <h2>Venue</h2>
              <div className="venue-info">
                <p className="venue-name">📍 {event.venue || event.location}</p>
                {event.parking_info && (
                  <div className="parking-info">
                    <div className="parking-header"><span>🅿️</span><strong>Parking Information</strong></div>
                    <p>{event.parking_info}</p>
                  </div>
                )}
                <button className="btn-directions-primary" onClick={handleGetDirections}>
                  🗺️ Get Directions
                </button>
              </div>
            </section>
          )}

          {/* ── Mapbox Map ── */}
          {(event.venue || event.location) && (
            <section className="content-section">
              <h2>Location Map</h2>
              <div ref={mapContainer} style={{ width: "100%", height: "400px", borderRadius: "8px" }} />
              {/* UPDATED label — Mapbox renders the map, directions open in Google Maps */}
              <button className="map-link-btn" onClick={handleGetDirections}>
                🗺️ Get Directions
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
                              <p className="discounted-price">KES {ticket.early_bird_price?.toLocaleString() || ticket.price.toLocaleString()}</p>
                              <span className="early-bird-label">⚡ Early Bird</span>
                            </div>
                          ) : (
                            <p className="ticket-price">{formatPrice(ticket.price)}</p>
                          )}
                        </div>
                      </div>
                      {ticket.description && <p className="ticket-description">{ticket.description}</p>}
                      <div className="ticket-footer">
                        {isTicketSoldOut ? (
                          <span className="ticket-status sold-out">Sold Out</span>
                        ) : (
                          <>
                            <span className="ticket-status available">{ticketAvailable} available</span>
                            {ticket.is_low_stock && <span className="low-stock-warning">⚠️ Low Stock!</span>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Organizer */}
          {event.organizer_name && (
            <section className="content-section organizer-section">
              <h2>Organized By</h2>
              <div className="organizer-card">
                {event.organizer_profile && (
                  <img src={event.organizer_profile} alt={event.organizer_name} className="organizer-avatar" />
                )}
                <div className="organizer-details">
                  <h3>
                    {event.organizer_name}
                    {event.is_verified_organizer && <span className="verified-badge" title="Verified">✓</span>}
                  </h3>
                  {event.organizer_rating && (
                    <div className="organizer-rating">
                      ⭐ {event.organizer_rating.toFixed(1)}
                      {event.organizer_event_count && <span> · {event.organizer_event_count} events hosted</span>}
                    </div>
                  )}
                  {event.organizer_email && (
                    <button className="btn-contact-small" onClick={handleContactOrganizer}>📧 Contact Organizer</button>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Right Column — Booking Card */}
        <aside className="event-sidebar">
          <div className="booking-card sticky">
            <div className="booking-price">
              <span className="price-label">Starting from</span>
              {isEarlyBirdActive && event.early_bird_price ? (
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
                  <div key={simEvent.id} className="similar-event-item" onClick={() => navigate(`/dashboard/events/${simEvent.id}`)}>
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
              <button onClick={() => handleShare("whatsapp")} className="share-btn whatsapp">WhatsApp</button>
              <button onClick={() => handleShare("twitter")} className="share-btn twitter">Twitter</button>
              <button onClick={() => handleShare("facebook")} className="share-btn facebook">Facebook</button>
              <button onClick={() => handleShare("linkedin")} className="share-btn linkedin">LinkedIn</button>
              <button onClick={() => handleShare("copy")} className="share-btn copy">Copy Link</button>
            </div>
            <button className="close-modal" onClick={() => setShowShareModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetails;