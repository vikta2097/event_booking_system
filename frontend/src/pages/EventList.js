import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../api";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "../styles/EventList.css";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const ITEMS_PER_PAGE = 12;

// ── Haversine formula — returns distance in km between two lat/lng points ──
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Format distance for display ──
const formatDistance = (km) => {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
};

// Nairobi as default fallback center
const FALLBACK_COORDS = { lat: -1.2921, lng: 36.8219 };

const EventList = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"

  // ── GPS state ──
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [locationStatus, setLocationStatus] = useState("idle"); // "idle" | "acquiring" | "granted" | "denied" | "fallback"
  const [nearMeActive, setNearMeActive] = useState(false);

  const observer = useRef();
  const searchTimeout = useRef(null);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);

  // ── Attach distance to each event given a user position ──
  const attachDistances = useCallback((evts, loc) => {
    if (!loc) return evts.map((e) => ({ ...e, _distanceKm: null }));
    return evts.map((e) => {
      if (e.latitude && e.longitude) {
        const km = haversineDistance(
          loc.lat,
          loc.lng,
          parseFloat(e.latitude),
          parseFloat(e.longitude)
        );
        return { ...e, _distanceKm: km };
      }
      return { ...e, _distanceKm: null };
    });
  }, []);

  // ── Sort nearest-first; events without coords go to the end ──
  const sortByDistance = useCallback((evts) => {
    return [...evts].sort((a, b) => {
      if (a._distanceKm === null && b._distanceKm === null) return 0;
      if (a._distanceKm === null) return 1;
      if (b._distanceKm === null) return -1;
      return a._distanceKm - b._distanceKm;
    });
  }, []);

  // ── Request GPS from browser ──
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
        // Permission denied or error — use fallback
        setLocationStatus("fallback");
        setUserLocation(FALLBACK_COORDS);
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }, []);

  // ── Toggle "Near Me" ──
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

  // Re-sort/unsort when nearMe or location changes
  useEffect(() => {
    setFilteredEvents((prev) => {
      const withDist = attachDistances(prev, userLocation);
      return nearMeActive ? sortByDistance(withDist) : withDist;
    });
  }, [nearMeActive, userLocation, attachDistances, sortByDistance]);

  const fetchEvents = async (filters = {}, pageNum = 1, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== "") params.append(key, val);
      });
      params.append("page", pageNum);
      params.append("limit", ITEMS_PER_PAGE);
      const res = await api.get(`/events?${params.toString()}`);
      const newEvents = res.data.events || res.data;

      const withDist = attachDistances(newEvents, userLocation);
      const sorted = nearMeActive ? sortByDistance(withDist) : withDist;

      if (append) {
        setEvents((prev) => [...prev, ...newEvents]);
        setFilteredEvents((prev) => {
          const combined = [...prev, ...sorted];
          return nearMeActive ? sortByDistance(combined) : combined;
        });
      } else {
        setEvents(newEvents);
        setFilteredEvents(sorted);
      }
      setHasMore(newEvents.length === ITEMS_PER_PAGE);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    if (!user) return;
    try {
      const res = await api.get("/events/recommendations", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setRecommendations(res.data.recommendations || []);
    } catch {}
  };

  const fetchFavorites = async () => {
    if (!user) return;
    try {
      const res = await api.get("/events/favorites", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setFavorites(res.data.favorites || []);
    } catch {}
  };

  // Last element ref for infinite scroll
  const lastEventRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setPage((prev) => prev + 1);
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      let base = query.trim() === ""
        ? attachDistances(events, userLocation)
        : attachDistances(
            events.filter((e) => {
              const lower = query.toLowerCase();
              return (
                e.title?.toLowerCase().includes(lower) ||
                e.location?.toLowerCase().includes(lower) ||
                e.organizer_name?.toLowerCase().includes(lower) ||
                e.category_name?.toLowerCase().includes(lower)
              );
            }),
            userLocation
          );
      setFilteredEvents(nearMeActive ? sortByDistance(base) : base);
    }, 300);
  };

  const handleFilter = (filters) => {
    setPage(1);
    setHasMore(true);
    fetchEvents(filters, 1, false);
  };

  const handleSaveToFavorites = async (eventId, isFavorite) => {
    if (!user) { alert("Please login to save favorites"); return; }
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      if (isFavorite) {
        await api.post(`/events/${eventId}/favorite`, {}, { headers });
        setFavorites((prev) => [...prev, eventId]);
      } else {
        await api.delete(`/events/${eventId}/favorite`, { headers });
        setFavorites((prev) => prev.filter((id) => id !== eventId));
      }
    } catch {
      alert("Failed to update favorites");
    }
  };

  const handleEventClick = async (eventId) => {
    if (!user) return;
    try {
      await api.post(`/events/${eventId}/track-view`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
    } catch {}
  };

  useEffect(() => {
    fetchEvents();
    if (user) { fetchRecommendations(); fetchFavorites(); }
  }, [user]);

  useEffect(() => {
    if (page > 1) fetchEvents({}, page, true);
  }, [page]);

  // ── Mapbox Map View ──
  useEffect(() => {
    if (viewMode !== "map") {
      if (map.current) { map.current.remove(); map.current = null; }
      return;
    }
    const timer = setTimeout(() => {
      if (!mapContainer.current || map.current) return;
      const center = userLocation
        ? [userLocation.lng, userLocation.lat]
        : [FALLBACK_COORDS.lng, FALLBACK_COORDS.lat];
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 10,
      });
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

      // User location marker
      if (userLocation) {
        new mapboxgl.Marker({ color: "#10b981" })
          .setLngLat([userLocation.lng, userLocation.lat])
          .setPopup(new mapboxgl.Popup().setHTML("<strong>📍 You are here</strong>"))
          .addTo(map.current);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [viewMode, userLocation]);

  useEffect(() => {
    if (viewMode !== "map" || !map.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const eventsWithCoords = filteredEvents.filter((e) => e.latitude && e.longitude);
    if (eventsWithCoords.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    eventsWithCoords.forEach((event) => {
      const lng = parseFloat(event.longitude);
      const lat = parseFloat(event.latitude);
      const distLabel = event._distanceKm != null
        ? `<small style="color:#667eea;font-weight:700">📏 ${formatDistance(event._distanceKm)}</small><br/>`
        : "";
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="max-width:200px">
          <strong>${event.title}</strong><br/>
          <small>📍 ${event.venue || event.location}</small><br/>
          <small>📅 ${new Date(event.event_date).toLocaleDateString("en-GB")}</small><br/>
          ${distLabel}
          <small style="color:#10b981;font-weight:700">
            ${event.price ? `KES ${Number(event.price).toLocaleString()}` : "Free"}
          </small><br/>
          <a href="/dashboard/events/${event.id}" style="color:#3b82f6;font-size:12px">View Details →</a>
        </div>
      `);
      const marker = new mapboxgl.Marker({ color: "#667eea" })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current);
      markers.current.push(marker);
      bounds.extend([lng, lat]);
    });
    map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
  }, [filteredEvents, viewMode]);

  const eventsWithFavorites = filteredEvents.map((e) => ({
    ...e,
    is_favorited: favorites.includes(e.id),
  }));

  // ── Location status banner ──
  const renderLocationBanner = () => {
    if (locationStatus === "idle" || !nearMeActive) return null;
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
          ✅ Showing events nearest to you
        </div>
      );
    }
    if (locationStatus === "fallback") {
      return (
        <div className="location-banner location-banner--fallback">
          ⚠️ GPS unavailable — showing events near Nairobi
        </div>
      );
    }
    return null;
  };

  return (
    <div className="event-list-container">
      {/* Search Bar */}
      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="🔍 Search events by title, venue, organizer..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
            aria-label="Search events"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => handleSearch("")} aria-label="Clear search">✕</button>
          )}
        </div>
      </div>

      {/* Filters — pass GPS props so EventFilters can show Near Me chip */}
      <EventFilters
        onFilter={handleFilter}
        nearMeActive={nearMeActive}
        onNearMe={handleNearMe}
      />

      {/* Location banner */}
      {renderLocationBanner()}

      {/* View Mode Toggle */}
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
          onClick={() => setViewMode("list")}
        >
          ☰ List View
        </button>
        <button
          className={`view-toggle-btn ${viewMode === "map" ? "active" : ""}`}
          onClick={() => setViewMode("map")}
        >
          🗺️ Map View
        </button>
      </div>

      {/* Recommendations */}
      {user && recommendations.length > 0 && (
        <div className="recommendations-section">
          <div className="section-header">
            <h3>✨ Recommended For You</h3>
            <button className="toggle-btn" onClick={() => setShowRecommendations(!showRecommendations)}>
              {showRecommendations ? "Hide" : "Show"}
            </button>
          </div>
          {showRecommendations && (
            <div className="recommendations-grid">
              {recommendations.slice(0, 4).map((event) => (
                <EventCard
                  key={`rec-${event.id}`}
                  event={event}
                  user={user}
                  onSaveToFavorites={handleSaveToFavorites}
                  onEventClick={() => handleEventClick(event.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Header */}
      <div className="events-section">
        <div className="section-header">
          <h3>
            {nearMeActive ? "📍 Nearest Events" : ""}
            {searchQuery
              ? `Search Results (${eventsWithFavorites.length})`
              : nearMeActive
              ? ` (${eventsWithFavorites.length})`
              : `All Events (${eventsWithFavorites.length})`}
          </h3>
          {nearMeActive && locationStatus === "granted" && (
            <span className="gps-badge">🛰️ GPS Active</span>
          )}
        </div>

        {/* Map View */}
        {viewMode === "map" && (
          <div>
            <div
              ref={mapContainer}
              style={{ width: "100%", height: "500px", borderRadius: "12px", border: "1px solid #e5e7eb" }}
            />
            {filteredEvents.filter((e) => e.latitude && e.longitude).length === 0 && (
              <p style={{ textAlign: "center", color: "#6b7280", marginTop: 12 }}>
                ⚠️ No events with location coordinates found. Try a different filter.
              </p>
            )}
          </div>
        )}

        {/* List View */}
        {viewMode === "list" &&
          (loading && page === 1 ? (
            <div className="loading-container">
              <div className="skeleton-grid">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-image" />
                    <div className="skeleton-content">
                      <div className="skeleton-line" />
                      <div className="skeleton-line short" />
                      <div className="skeleton-line" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : eventsWithFavorites.length === 0 ? (
            <div className="no-events">
              <div className="no-events-icon">🎭</div>
              <h3>No Events Found</h3>
              <p>{searchQuery ? `No events match "${searchQuery}".` : "No events available. Check back soon!"}</p>
            </div>
          ) : (
            <>
              <div className="event-grid">
                {eventsWithFavorites.map((event, index) => {
                  const card = (
                    <EventCard
                      event={event}
                      user={user}
                      onSaveToFavorites={handleSaveToFavorites}
                      onEventClick={() => handleEventClick(event.id)}
                    />
                  );
                  if (eventsWithFavorites.length === index + 1) {
                    return <div key={event.id} ref={lastEventRef}>{card}</div>;
                  }
                  return <div key={event.id}>{card}</div>;
                })}
              </div>
              {loading && page > 1 && (
                <div className="loading-more">
                  <div className="spinner" />
                  <p>Loading more events…</p>
                </div>
              )}
              {!hasMore && eventsWithFavorites.length > 0 && (
                <div className="end-of-results">
                  <p>🎉 You've seen all available events</p>
                </div>
              )}
            </>
          ))}
      </div>

      {eventsWithFavorites.length > 6 && viewMode === "list" && (
        <button
          className="back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
    </div>
  );
};

export default EventList;