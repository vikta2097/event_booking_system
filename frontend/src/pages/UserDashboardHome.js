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
      filtered = filtered.filter(
        (e) => e.price >= parseFloat(filters.minPrice)
      );
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(
        (e) => e.price <= parseFloat(filters.maxPrice)
      );
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

  return (
    <div className="user-dashboard-home-container">
      {/* FILTERS */}
      <div className="filters-wrapper">
        <EventFilters onFilter={handleFilter} />
      </div>

      {/* EVENT GRID / STATES */}
      {loading && <p className="loading-text">Loading events...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && filteredEvents.length === 0 && !error && (
        <p className="no-events">No events found matching your criteria.</p>
      )}

      <div className="event-grid">
        {filteredEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            user={user}
            onBook={() =>
              user
                ? navigate(`book/${event.id}`) // relative navigation
                : navigate("login", { state: { from: `book/${event.id}` } })
            }
          />
        ))}
      </div>

      {/* FOOTER */}
      <footer className="dashboard-footer">
        <div className="footer-links">
          <span onClick={() => navigate("")} className="footer-link">
            Home
          </span>

          <span onClick={() => navigate("contact")} className="footer-link">
            Contact Us
          </span>
        </div>

        <p className="footer-copy">
          © {new Date().getFullYear()} EventHyper
        </p>
      </footer>

      {/* CHATBOT WIDGET */}
      <ChatbotWidget user={user} />
    </div>
  );
};

export default UserDashboardHome;
