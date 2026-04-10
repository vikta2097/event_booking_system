// pages/UserDashboardHome.js (WEB) — GPS-aware discovery feed (UPDATED)
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import ChatbotWidget from "./ChatbotWidget";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";
import "../styles/UserDashboard.css";
import "../styles/UserDashboardHome.css";

const FALLBACK_COORDS = { lat: -1.2921, lng: 36.8219 }; // Nairobi

const UserDashboardHome = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // GPS state
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [nearMeActive, setNearMeActive] = useState(false);
  const [radius, setRadius] = useState(200);

  const navigate = useNavigate();
  const paramsRef = useRef({});

  // =========================
  // FETCH EVENTS (UPDATED)
  // =========================
  const fetchEvents = useCallback(
    async (params = {}, loc, useNearMe, nearRadius = 200) => {
      setLoading(true);
      setError("");

      try {
        const cleanParams = Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined)
        );

        // attach GPS if available
        if (loc) {
          cleanParams.lat = loc.lat;
          cleanParams.lng = loc.lng;
          cleanParams.radius = nearRadius;

          if (useNearMe) {
            cleanParams.sortBy = "near_me";
          }
        }

        const res = await api.get("/events", { params: cleanParams });

        setEvents(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load events:", err);
        setError("Unable to load events. Please try again later.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // initial load
  useEffect(() => {
    fetchEvents({}, null, false);
  }, [fetchEvents]);

  // re-fetch when toggling near me OR location OR radius changes
  useEffect(() => {
    fetchEvents(paramsRef.current, userLocation, nearMeActive, radius);
  }, [userLocation, nearMeActive, radius, fetchEvents]);

  // =========================
  // FILTER HANDLER
  // =========================
  const handleFilter = useCallback(
    (params) => {
      paramsRef.current = params;
      fetchEvents(params, userLocation, nearMeActive, radius);
    },
    [fetchEvents, userLocation, nearMeActive, radius]
  );

  // =========================
  // RADIUS CHANGE
  // =========================
  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
  };

  // =========================
  // GPS REQUEST
  // =========================
  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("fallback");
      setUserLocation(FALLBACK_COORDS);
      return;
    }

    setLocationStatus("acquiring");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        setUserLocation(loc);
        setLocationStatus("granted");
      },
      () => {
        setLocationStatus("fallback");
        setUserLocation(FALLBACK_COORDS);
      },
      {
        timeout: 8000,
        maximumAge: 60000,
        enableHighAccuracy: true,
      }
    );
  }, []);

  // =========================
  // TOGGLE NEAR ME
  // =========================
  const handleNearMe = () => {
    if (!nearMeActive) {
      setNearMeActive(true);

      if (!userLocation) {
        requestGPS();
      }
    } else {
      setNearMeActive(false);
    }
  };

  // =========================
  // LOCATION BANNER
  // =========================
  const renderLocationBanner = () => {
    if (!nearMeActive || locationStatus === "idle") return null;

    if (locationStatus === "acquiring") {
      return (
        <div className="location-banner location-banner--acquiring">
          <span className="location-spinner" />
          Acquiring your location…
        </div>
      );
    }

    if (locationStatus === "granted") {
      return (
        <div className="location-banner location-banner--granted">
          ✅ Showing nearest events within {radius} km of you
        </div>
      );
    }

    if (locationStatus === "fallback") {
      return (
        <div className="location-banner location-banner--fallback">
          ⚠️ GPS unavailable — showing events within {radius} km of Nairobi
        </div>
      );
    }

    return null;
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="dashboard-home">

      {/* Filters */}
      <div className="filters-wrapper">
        <EventFilters
          onFilter={handleFilter}
          nearMeActive={nearMeActive}
          onNearMe={handleNearMe}
          radius={radius}
          onRadiusChange={handleRadiusChange}
        />
      </div>

      {renderLocationBanner()}

      {/* Header */}
      {!loading && !error && (
        <div className="results-header">
          <span>
            {nearMeActive ? "📍 Nearest Events" : "All Events"} ({events.length})
          </span>

          {nearMeActive && locationStatus === "granted" && (
            <span className="gps-badge">🛰️ GPS Active</span>
          )}
        </div>
      )}

      {/* States */}
      {loading && <p className="loading-text">Loading events…</p>}
      {!loading && error && <p className="error-text">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <p className="no-events">No events found matching your criteria.</p>
      )}

      {/* Event Grid */}
      {!loading && !error && events.length > 0 && (
        <div className="event-grid">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              user={user}
              onSaveToFavorites={(eventId, isFav) => {
                console.log("favorite toggled", eventId, isFav);
              }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="dashboard-footer">
        <div className="footer-links">
          <span
            className="footer-link"
            onClick={() => navigate("/dashboard")}
          >
            Home
          </span>

          <span
            className="footer-link"
            onClick={() => navigate("/dashboard/contact")}
          >
            Contact Us
          </span>
        </div>

        <p>© {new Date().getFullYear()} EventHyper</p>
      </footer>

      <ChatbotWidget user={user} />
    </div>
  );
};

export default UserDashboardHome;