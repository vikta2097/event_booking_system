import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import api from "../api";
import "../styles/UserBookings.css";

const UserBookings = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get("/bookings");
        const bookingsData = res.data;

        // Fetch payments for each booking to determine status
        const bookingsWithPayment = await Promise.all(
          bookingsData.map(async (b) => {
            try {
              const paymentRes = await api.get(`/payments/by-booking/${b.id}`);
              return { ...b, paymentStatus: paymentRes.data?.status || null };
            } catch {
              return { ...b, paymentStatus: null };
            }
          })
        );

        setBookings(bookingsWithPayment);
        setFilteredBookings(bookingsWithPayment);
      } catch (err) {
        console.error("Error fetching bookings:", err);
        setError("Failed to load bookings. Try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  // Filter bookings based on active tab
  useEffect(() => {
    let filtered = bookings;

    // Filter by tab
    const now = new Date();
    switch (activeTab) {
      case "upcoming":
        filtered = bookings.filter(b => {
          const eventDate = new Date(b.event_date);
          return eventDate >= now && b.booking_status !== "cancelled";
        });
        break;
      case "past":
        filtered = bookings.filter(b => {
          const eventDate = new Date(b.event_date);
          return eventDate < now && b.booking_status !== "cancelled";
        });
        break;
      case "pending":
        filtered = bookings.filter(b => 
          b.booking_status === "pending" && b.paymentStatus !== "success"
        );
        break;
      case "cancelled":
        filtered = bookings.filter(b => b.booking_status === "cancelled");
        break;
      default:
        filtered = bookings;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(b =>
        b.event_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
  }, [activeTab, bookings, searchQuery]);

  // Add to Calendar function
  const handleAddToCalendar = (booking) => {
    const startDate = new Date(`${booking.event_date}T${booking.start_time}`);
    const endDate = new Date(`${booking.event_date}T${booking.end_time || booking.start_time}`);
    
    const formatDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };

    const title = encodeURIComponent(booking.event_title);
    const location = encodeURIComponent(booking.venue || booking.location || '');
    const details = encodeURIComponent(`Booking Reference: ${booking.reference}\nSeats: ${booking.seats}`);
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${details}&location=${location}`;
    
    window.open(googleCalendarUrl, '_blank');
  };

  // Get Directions function
  const handleGetDirections = (booking) => {
    if (booking.venue || booking.location) {
      const query = encodeURIComponent(booking.venue || booking.location);
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      window.open(googleMapsUrl, '_blank');
    } else {
      alert("Location information not available");
    }
  };

  // Contact Organizer
  const handleContactOrganizer = (booking) => {
    // This would need organizer email from event data
    alert("Contact organizer feature - email functionality would go here");
  };

  // Format date
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Format time
  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Get status badge class
  const getStatusClass = (booking) => {
    if (booking.booking_status === "cancelled") return "cancelled";
    if (booking.booking_status === "confirmed" || booking.paymentStatus === "success") return "confirmed";
    if (booking.booking_status === "pending") return "pending";
    return "default";
  };

  // Get status text
  const getStatusText = (booking) => {
    if (booking.booking_status === "cancelled") return "Cancelled";
    if (booking.booking_status === "confirmed" || booking.paymentStatus === "success") return "Confirmed";
    if (booking.booking_status === "pending") return "Payment Pending";
    return booking.booking_status;
  };

  if (loading) {
    return (
      <div className="user-bookings">
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading your bookings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-bookings">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn-retry">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const tabCounts = {
    all: bookings.length,
    upcoming: bookings.filter(b => new Date(b.event_date) >= new Date() && b.booking_status !== "cancelled").length,
    past: bookings.filter(b => new Date(b.event_date) < new Date() && b.booking_status !== "cancelled").length,
    pending: bookings.filter(b => b.booking_status === "pending" && b.paymentStatus !== "success").length,
    cancelled: bookings.filter(b => b.booking_status === "cancelled").length,
  };

  if (bookings.length === 0) {
    return (
      <div className="user-bookings">
        <div className="bookings-header">
          <h2>My Bookings</h2>
        </div>
        <div className="no-bookings-container">
          <div className="no-bookings-icon">🎫</div>
          <h3>No Bookings Yet</h3>
          <p>You haven't booked any events yet. Start exploring!</p>
          <button onClick={() => navigate("/dashboard")} className="btn-explore">
            Explore Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="user-bookings">
      {/* Header */}
      <div className="bookings-header">
        <div>
          <h2>My Bookings</h2>
          <p className="subtitle">Manage and view all your event bookings</p>
        </div>
        <button onClick={() => navigate("/dashboard")} className="btn-back">
          ← Back to Events
        </button>
      </div>

      {/* Search Bar */}
      <div className="bookings-search">
        <input
          type="text"
          placeholder="🔍 Search bookings by event name, reference, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="clear-search">
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bookings-tabs">
        <button
          className={activeTab === "upcoming" ? "active" : ""}
          onClick={() => setActiveTab("upcoming")}
        >
          Upcoming ({tabCounts.upcoming})
        </button>
        <button
          className={activeTab === "past" ? "active" : ""}
          onClick={() => setActiveTab("past")}
        >
          Past ({tabCounts.past})
        </button>
        <button
          className={activeTab === "pending" ? "active" : ""}
          onClick={() => setActiveTab("pending")}
        >
          Pending Payment ({tabCounts.pending})
        </button>
        <button
          className={activeTab === "cancelled" ? "active" : ""}
          onClick={() => setActiveTab("cancelled")}
        >
          Cancelled ({tabCounts.cancelled})
        </button>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="no-results">
          <p>No bookings found {searchQuery ? `for "${searchQuery}"` : "in this category"}</p>
        </div>
      ) : (
        <div className="bookings-grid">
          {filteredBookings.map((booking) => (
            <div key={booking.id} className={`booking-card-enhanced ${getStatusClass(booking)}`}>
              {/* Event Image/Poster */}
              <div className="booking-image">
                {booking.event_image ? (
                  <img src={booking.event_image} alt={booking.event_title} />
                ) : (
                  <div className="booking-image-placeholder">
                    <span>🎭</span>
                  </div>
                )}
                <span className={`status-badge ${getStatusClass(booking)}`}>
                  {getStatusText(booking)}
                </span>
              </div>

              {/* Booking Content */}
              <div className="booking-content">
                <div className="booking-header-info">
                  <h3 className="booking-title">{booking.event_title}</h3>
                  <p className="booking-reference">Ref: {booking.reference}</p>
                </div>

                <div className="booking-details-grid">
                  <div className="detail-item">
                    <span className="detail-icon">📅</span>
                    <div className="detail-text">
                      <span className="detail-label">Date</span>
                      <span className="detail-value">{formatDate(booking.event_date)}</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">⏰</span>
                    <div className="detail-text">
                      <span className="detail-label">Time</span>
                      <span className="detail-value">
                        {formatTime(booking.start_time)}
                        {booking.end_time && ` - ${formatTime(booking.end_time)}`}
                      </span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">📍</span>
                    <div className="detail-text">
                      <span className="detail-label">Venue</span>
                      <span className="detail-value">{booking.venue || booking.location || "TBA"}</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">🎫</span>
                    <div className="detail-text">
                      <span className="detail-label">Tickets</span>
                      <span className="detail-value">{booking.seats} ticket{booking.seats > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">💰</span>
                    <div className="detail-text">
                      <span className="detail-label">Total Paid</span>
                      <span className="detail-value amount">KES {parseFloat(booking.total_amount).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-icon">📆</span>
                    <div className="detail-text">
                      <span className="detail-label">Booked On</span>
                      <span className="detail-value">
                        {new Date(booking.booking_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="booking-actions">
                  {/* Payment Pending Actions */}
                  {booking.booking_status === "pending" && booking.paymentStatus !== "success" && (
                    <button
                      className="btn-action primary"
                      onClick={() => navigate(`/dashboard/payment/${booking.id}`)}
                    >
                      💳 Complete Payment
                    </button>
                  )}

                  {/* Confirmed Booking Actions */}
                  {(booking.booking_status === "confirmed" || booking.paymentStatus === "success") && (
                    <>
                      <button
                        className="btn-action primary"
                        onClick={() => navigate(`/dashboard/booking-success/${booking.id}`)}
                      >
                        🎟️ View Tickets
                      </button>
                      <button
                        className="btn-action secondary"
                        onClick={() => handleAddToCalendar(booking)}
                        title="Add to calendar"
                      >
                        📅 Add to Calendar
                      </button>
                      <button
                        className="btn-action secondary"
                        onClick={() => handleGetDirections(booking)}
                        title="Get directions"
                      >
                        📍 Get Directions
                      </button>
                    </>
                  )}

                  {/* Universal Actions (available for all non-cancelled) */}
                  {booking.booking_status !== "cancelled" && (
                    <>
                      <button
                        className="btn-action secondary"
                        onClick={() => navigate(`/dashboard/events/${booking.event_id}`)}
                        title="View event details"
                      >
                        👁️ Event Details
                      </button>
                    </>
                  )}

                  {/* Cancelled Status */}
                  {booking.booking_status === "cancelled" && (
                    <div className="cancelled-note">
                      <p>This booking has been cancelled</p>
                    </div>
                  )}
                </div>

                {/* Tickets Preview (for confirmed bookings) */}
                {(booking.booking_status === "confirmed" || booking.paymentStatus === "success") && 
                 booking.tickets && booking.tickets.length > 0 && (
                  <div className="tickets-preview-section">
                    <p className="preview-label">Quick Preview:</p>
                    <div className="tickets-preview-grid">
                      {booking.tickets.slice(0, 3).map((ticket) => (
                        <div key={ticket.id} className="ticket-preview-item">
                          <QRCodeSVG value={ticket.qr_code} size={60} level="H" />
                          <span className="ticket-preview-name">{ticket.ticket_name}</span>
                        </div>
                      ))}
                      {booking.tickets.length > 3 && (
                        <div className="more-tickets">
                          +{booking.tickets.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserBookings;