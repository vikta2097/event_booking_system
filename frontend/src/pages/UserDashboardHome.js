import React, { useEffect, useState } from "react";
import "../styles/UserDashboardHome.css";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";
import api from "../api";
import { useNavigate } from "react-router-dom";
import ChatbotWidget from "./ChatbotWidget";

const UserDashboardHome = ({ user, onLogout }) => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/events");
      setEvents(res.data);
      setFilteredEvents(res.data);
    } catch (err) {
      console.error(err);
      setError("Unable to load events. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleFilter = (filters) => {
    let filtered = [...events];

    if (filters.category) {
      filtered = filtered.filter((e) =>
        (e.category_name || "")
          .toLowerCase()
          .includes(filters.category.toLowerCase())
      );
    }
    if (filters.venue) {
      filtered = filtered.filter((e) =>
        (e.location || "").toLowerCase().includes(filters.venue.toLowerCase())
      );
    }
    if (filters.minPrice !== undefined) {
      filtered = filtered.filter((e) => e.price >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter((e) => e.price <= parseFloat(filters.maxPrice));
    }
    if (filters.startDate) {
      filtered = filtered.filter(
        (e) => new Date(e.event_date) >= new Date(filters.startDate)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(
        (e) => new Date(e.event_date) <= new Date(filters.endDate)
      );
    }

    setFilteredEvents(filtered);
  };

  const getUserDisplayName = () => {
    if (!user) return null;
    return (
      user.fullname ||
      user.full_name ||
      user.name ||
      user.username ||
      user.email?.split("@")[0] ||
      "User"
    );
  };

  const displayName = getUserDisplayName();

  return (
    <div className="dashboard-home">

      {user && (
        <div className="dashboard-header">
          <h2 className="welcome-title">Welcome back, {displayName}!</h2>

          <div className="dashboard-actions">
            <button onClick={() => navigate("/dashboard/my-bookings")}>
              🎟️ My Bookings
            </button>

            <button onClick={onLogout} className="logout-btn">
              🚪 Logout
            </button>
          </div>
        </div>
      )}

      {!user && (
        <div className="guest-notice">
          <p className="guest-note">
            Browse our events below! To book an event, please{" "}
            <span
              onClick={() => navigate("/dashboard/login")}
              className="login-link"
            >
              log in
            </span>{" "}
            or{" "}
            <span
              onClick={() => navigate("/dashboard/register")}
              className="register-link"
            >
              register
            </span>
            .
          </p>
        </div>
      )}

      <EventFilters onFilter={handleFilter} />

      {loading && <p className="loading-text">Loading events...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && filteredEvents.length === 0 && !error && (
        <p className="no-events">No events found matching your criteria.</p>
      )}

      <div className="event-grid">
        {filteredEvents.map((event) => (
          <EventCard key={event.id} event={event} user={user} />
        ))}
      </div>

      {/* ------------------------- FOOTER ADDED HERE ------------------------- */}
      <footer className="dashboard-footer">
        <div className="footer-links">
          <span onClick={() => navigate("/dashboard")} className="footer-link">
            Home
          </span>

          <span onClick={() => navigate("/dashboard/contact")} className="footer-link">
            Contact Us
          </span>

          {user && (
            <span
              onClick={() => navigate("/dashboard/my-bookings")}
              className="footer-link"
            >
              My Bookings
            </span>
          )}

          {user && (
            <span onClick={onLogout} className="footer-link logout-link">
              Logout
            </span>
          )}
        </div>

        <p className="footer-copy">© {new Date().getFullYear()} EventHyper</p>
      </footer>
      <ChatbotWidget user={user} />

    </div>
  );
};

export default UserDashboardHome;
