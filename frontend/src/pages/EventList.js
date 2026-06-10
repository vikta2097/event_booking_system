// EventList.js — Public event listing page
// Handles Near Me geolocation, filters, and pagination.
// Passes lat/lng to the API so the backend GPS ranking activates.

import React, { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";
import "../styles/EventList.css";

const PAGE_SIZE = 12;

const EventList = ({ user, onSaveToFavorites }) => {
  // ── Events state ──────────────────────────────────────────────
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // ── Filter state (comes from EventFilters) ────────────────────
  const [filters, setFilters] = useState({
    category: "",
    venue: "",
    minPrice: "",
    maxPrice: "",
    startDate: "",
    endDate: "",
  });

  // ── Near Me / GPS state ───────────────────────────────────────
  const [nearMeActive, setNearMeActive] = useState(false);
  const [userCoords, setUserCoords] = useState(null);   // { lat, lng }
  const [radius, setRadius] = useState(200);
  const [locLoading, setLocLoading] = useState(false);  // while browser prompt is open

  // Keep a ref to the latest coords so fetchEvents closure always sees them
  const coordsRef = useRef(userCoords);
  useEffect(() => { coordsRef.current = userCoords; }, [userCoords]);

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchEvents = useCallback(
    async (pageNum = 1, replace = true) => {
      try {
        setLoading(true);
        setError("");

        const params = {
          page: pageNum,
          limit: PAGE_SIZE,
        };

        // Standard filters
        if (filters.category)  params.category  = filters.category;
        if (filters.venue)     params.venue      = filters.venue;
        if (filters.minPrice)  params.minPrice   = filters.minPrice;
        if (filters.maxPrice)  params.maxPrice   = filters.maxPrice;
        if (filters.startDate) params.startDate  = filters.startDate;
        if (filters.endDate)   params.endDate    = filters.endDate;

        // ✅ GPS params — only sent when Near Me is active AND coords exist.
        // This is what was missing before: the backend never received lat/lng
        // so the distance_km column was never computed and GPS sorting/filtering
        // never ran.
        const coords = coordsRef.current;
        if (nearMeActive && coords) {
          params.lat    = coords.lat;
          params.lng    = coords.lng;
          params.radius = radius;
        }

        const res = await api.get("/events", { params });
        const fetched = res.data || [];

        setEvents((prev) => replace ? fetched : [...prev, ...fetched]);
        setHasMore(fetched.length === PAGE_SIZE);
        setPage(pageNum);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setError("Could not load events. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    // nearMeActive and radius are in deps so a change triggers a new fetch
    [filters, nearMeActive, radius]
  );

  // Re-fetch from page 1 whenever filters, Near Me, or radius change
  useEffect(() => {
    fetchEvents(1, true);
  }, [fetchEvents]);

  // ── Near Me handler ───────────────────────────────────────────
  const handleNearMe = () => {
    // Toggle off
    if (nearMeActive) {
      setNearMeActive(false);
      setUserCoords(null);
      coordsRef.current = null;
      return;
    }

    if (!navigator.geolocation) {
      alert("Your browser doesn't support location access.");
      return;
    }

    setLocLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserCoords(coords);
        coordsRef.current = coords;
        setNearMeActive(true);
        setLocLoading(false);
        // fetchEvents will re-run automatically because nearMeActive changed
      },
      (err) => {
        setLocLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          alert(
            "Location access was denied.\n\n" +
            "To use Near Me, please allow location access in your browser settings and try again."
          );
        } else if (err.code === err.TIMEOUT) {
          alert("Location request timed out. Please try again.");
        } else {
          alert("Could not get your location. Please try again.");
        }
        console.error("Geolocation error:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,  // reuse a cached position up to 1 minute old
      }
    );
  };

  // ── Filter change handler ─────────────────────────────────────
  const handleFilter = (newFilters) => {
    setFilters(newFilters);
    // fetchEvents auto-runs via the useEffect above
  };

  // ── Radius change ─────────────────────────────────────────────
  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    // fetchEvents auto-runs via the useEffect above (radius is a dep)
  };

  // ── Pagination ────────────────────────────────────────────────
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchEvents(page + 1, false);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="event-list-page">
      <EventFilters
        onFilter={handleFilter}
        nearMeActive={nearMeActive}
        onNearMe={handleNearMe}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        locLoading={locLoading}
      />

      {/* Near Me context banner */}
      {nearMeActive && userCoords && (
        <div className="near-me-banner">
          📍 Showing events within <strong>{radius} km</strong> of your location,
          sorted by distance.{" "}
          <button className="near-me-banner__clear" onClick={handleNearMe}>
            Clear
          </button>
        </div>
      )}

      {error && <p className="event-list-error">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <div className="event-list-empty">
          {nearMeActive
            ? `No events found within ${radius} km of your location. Try increasing the radius.`
            : "No events found. Try adjusting your filters."}
        </div>
      )}

      <div className="event-list-grid">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            user={user}
            onSaveToFavorites={onSaveToFavorites}
          />
        ))}
      </div>

      {/* Skeleton cards while loading first page */}
      {loading && events.length === 0 && (
        <div className="event-list-grid">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="event-card event-card--skeleton" />
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && (
        <div className="event-list-more">
          <button className="load-more-btn" onClick={handleLoadMore}>
            Load More
          </button>
        </div>
      )}

      {loading && events.length > 0 && (
        <div className="event-list-more">
          <span className="loading-spinner">Loading…</span>
        </div>
      )}
    </div>
  );
};

export default EventList;