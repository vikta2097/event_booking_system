// pages/UserDashboardHome.js
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import ChatbotWidget from "./ChatbotWidget";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";
import "../styles/UserDashboard.css";

const UserDashboardHome = ({ user }) => {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const navigate    = useNavigate();
  // Keep latest params in a ref so the fetch function is always fresh
  const paramsRef   = useRef({});

  // ── Fetch events from the server with whatever params EventFilters emits ──
  const fetchEvents = useCallback(async (params = {}) => {
    setLoading(true);
    setError("");
    try {
      // Strip undefined values so axios doesn't send empty query params
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined)
      );
      const res = await api.get("/events", { params: cleanParams });
      setEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load events:", err);
      setError("Unable to load events. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — no filters
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Called by EventFilters every time any filter changes
  const handleFilter = useCallback(
    (params) => {
      paramsRef.current = params;
      fetchEvents(params);
    },
    [fetchEvents]
  );

  return (
    <div className="dashboard-home">
      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="filters-wrapper">
        <EventFilters onFilter={handleFilter} />
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <p className="loading-text">Loading events…</p>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {!loading && error && (
        <p className="error-text">{error}</p>
      )}

      {/* ── Empty ─────────────────────────────────────────────────────── */}
      {!loading && !error && events.length === 0 && (
        <p className="no-events">No events found matching your criteria.</p>
      )}

      {/* ── Event grid ────────────────────────────────────────────────── */}
      {!loading && !error && events.length > 0 && (
        <div className="event-grid">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              user={user}
              onBook={() =>
                user
                  ? navigate(`/dashboard/book/${event.id}`)
                  : navigate("/auth/login", { state: { from: `/dashboard/book/${event.id}` } })
              }
            />
          ))}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="dashboard-footer">
        <div className="footer-links">
          <span className="footer-link" onClick={() => navigate("/dashboard")}>Home</span>
          <span className="footer-link" onClick={() => navigate("/dashboard/contact")}>Contact Us</span>
        </div>
        <p>© {new Date().getFullYear()} EventHyper</p>
      </footer>

      <ChatbotWidget user={user} />
    </div>
  );
};

export default UserDashboardHome;