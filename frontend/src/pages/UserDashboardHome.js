// pages/UserDashboardHome.js (WEB) — GPS-aware discovery feed
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import ChatbotWidget from "./ChatbotWidget";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";
import "../styles/UserDashboard.css";
import "../styles/UserDashboardHome.css";

// ── Haversine distance in km ──
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const FALLBACK_COORDS = { lat: -1.2921, lng: 36.8219 }; // Nairobi

const UserDashboardHome = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── GPS state ──
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [nearMeActive, setNearMeActive] = useState(false);

  const navigate = useNavigate();
  const paramsRef = useRef({});

  // ── Attach distances & optionally sort ──
  const processEvents = useCallback(
    (raw, loc, sortByDist) => {
      const withDist = raw.map((e) => {
        if (loc && e.latitude && e.longitude) {
          return {
            ...e,
            _distanceKm: haversineDistance(
              loc.lat,
              loc.lng,
              parseFloat(e.latitude),
              parseFloat(e.longitude)
            ),
          };
        }
        return { ...e, _distanceKm: null };
      });
      if (sortByDist) {
        return [...withDist].sort((a, b) => {
          if (a._distanceKm == null && b._distanceKm == null) return 0;
          if (a._distanceKm == null) return 1;
          if (b._distanceKm == null) return -1;
          return a._distanceKm - b._distanceKm;
        });
      }
      return withDist;
    },
    []
  );

  const fetchEvents = useCallback(
    async (params = {}, loc, sortByDist) => {
      setLoading(true);
      setError("");
      try {
        const cleanParams = Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined)
        );
        const res = await api.get("/events", { params: cleanParams });
        const raw = Array.isArray(res.data) ? res.data : [];
        setEvents(processEvents(raw, loc, sortByDist));
      } catch (err) {
        console.error("Failed to load events:", err);
        setError("Unable to load events. Please try again later.");
      } finally {
        setLoading(false);
      }
    },
    [processEvents]
  );

  useEffect(() => {
    fetchEvents({}, null, false);
  }, [fetchEvents]);

  // Re-process whenever location or nearMe mode changes
  useEffect(() => {
    setEvents((prev) => processEvents(prev, userLocation, nearMeActive));
  }, [userLocation, nearMeActive, processEvents]);

  const handleFilter = useCallback(
    (params) => {
      paramsRef.current = params;
      fetchEvents(params, userLocation, nearMeActive);
    },
    [fetchEvents, userLocation, nearMeActive]
  );

  // ── GPS request ──
  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("fallback");
      setUserLocation(FALLBACK_COORDS);
      return;
    }
    setLocationStatus("acquiring");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLocationStatus("granted");
      },
      () => {
        setLocationStatus("fallback");
        setUserLocation(FALLBACK_COORDS);
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }, []);

  const handleNearMe = () => {
    if (!nearMeActive) {
      setNearMeActive(true);
      if (!userLocation) requestGPS();
    } else {
      setNearMeActive(false);
    }
  };

  // ── Location banner ──
  const renderLocationBanner = () => {
    if (!nearMeActive || locationStatus === "idle") return null;
    if (locationStatus === "acquiring")
      return <div className="location-banner location-banner--acquiring"><span className="location-spinner" /> Acquiring your location…</div>;
    if (locationStatus === "granted")
      return <div className="location-banner location-banner--granted">✅ Showing events nearest to you</div>;
    if (locationStatus === "fallback")
      return <div className="location-banner location-banner--fallback">⚠️ GPS unavailable — showing events near Nairobi</div>;
    return null;
  };

  return (
    <div className="dashboard-home">
      {/* Filters — pass Near Me props */}
      <div className="filters-wrapper">
        <EventFilters
          onFilter={handleFilter}
          nearMeActive={nearMeActive}
          onNearMe={handleNearMe}
        />
      </div>

      {renderLocationBanner()}

      {/* Results header */}
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

      {loading && <p className="loading-text">Loading events…</p>}
      {!loading && error && <p className="error-text">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="no-events">No events found matching your criteria.</p>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="event-grid">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              user={user}
              onSaveToFavorites={(eventId, isFav) => {
                // Favorites persistence is handled inside EventCard via API if needed
                console.log("favorite toggled", eventId, isFav);
              }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
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