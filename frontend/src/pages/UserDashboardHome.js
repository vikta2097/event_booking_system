import React, { useEffect, useState } from "react";
import "../styles/UserDashboardHome.css";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";
import api from "../api";

const UserDashboardHome = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch events from backend using axios
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

  // Filter events locally
  const handleFilter = (filters) => {
    let filtered = [...events];

    if (filters.category) {
      filtered = filtered.filter((e) =>
        (e.category_name || "").toLowerCase().includes(filters.category.toLowerCase())
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
      filtered = filtered.filter((e) => new Date(e.event_date) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filtered = filtered.filter((e) => new Date(e.event_date) <= new Date(filters.endDate));
    }

    setFilteredEvents(filtered);
  };

  return (
    <div className="dashboard-home">
      <h2 className="welcome-title">
        {user ? `Welcome back, ${user.fullname}!` : "Welcome to EventBooking!"}
      </h2>

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
    </div>
  );
};

export default UserDashboardHome;
