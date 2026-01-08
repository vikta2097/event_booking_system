import React, { useEffect, useState, useRef, useCallback } from "react";
import api from "../api";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";
import "../styles/EventList.css";

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
  
  const observer = useRef();
  const searchTimeout = useRef(null);
  const ITEMS_PER_PAGE = 12;

  // Last element ref for infinite scroll
  const lastEventRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Fetch events with pagination
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
      
      if (append) {
        setEvents(prev => [...prev, ...newEvents]);
        setFilteredEvents(prev => [...prev, ...newEvents]);
      } else {
        setEvents(newEvents);
        setFilteredEvents(newEvents);
      }
      
      setHasMore(newEvents.length === ITEMS_PER_PAGE);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch personalized recommendations
  const fetchRecommendations = async () => {
    if (!user) return;
    
    try {
      const res = await api.get("/events/recommendations", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setRecommendations(res.data.recommendations || []);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    }
  };

  // Fetch user favorites
  const fetchFavorites = async () => {
    if (!user) return;
    
    try {
      const res = await api.get("/events/favorites", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setFavorites(res.data.favorites || []);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    }
  };

  // Search as you type
  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      if (query.trim() === "") {
        setFilteredEvents(events);
      } else {
        const filtered = events.filter(event => 
          event.title.toLowerCase().includes(query.toLowerCase()) ||
          event.location.toLowerCase().includes(query.toLowerCase()) ||
          (event.organizer_name && event.organizer_name.toLowerCase().includes(query.toLowerCase())) ||
          (event.category_name && event.category_name.toLowerCase().includes(query.toLowerCase()))
        );
        setFilteredEvents(filtered);
      }
    }, 300);
  };

  // Handle filter changes
  const handleFilter = (filters) => {
    setPage(1);
    setHasMore(true);
    fetchEvents(filters, 1, false);
  };

  // Handle save to favorites
  const handleSaveToFavorites = async (eventId, isFavorite) => {
    if (!user) {
      alert("Please login to save favorites");
      return;
    }

    try {
      if (isFavorite) {
        await api.post(`/events/${eventId}/favorite`, {}, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        setFavorites(prev => [...prev, eventId]);
      } else {
        await api.delete(`/events/${eventId}/favorite`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        setFavorites(prev => prev.filter(id => id !== eventId));
      }
    } catch (err) {
      console.error("Error updating favorites:", err);
      alert("Failed to update favorites");
    }
  };

  // Track event click for recommendations
  const handleEventClick = async (eventId) => {
    if (!user) return;
    
    try {
      await api.post(`/events/${eventId}/track-view`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
    } catch (err) {
      console.error("Error tracking view:", err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchEvents();
    if (user) {
      fetchRecommendations();
      fetchFavorites();
    }
  }, [user]);

  // Load more on page change
  useEffect(() => {
    if (page > 1) {
      fetchEvents({}, page, true);
    }
  }, [page]);

  // Mark favorites in events
  const eventsWithFavorites = filteredEvents.map(event => ({
    ...event,
    is_favorited: favorites.includes(event.id)
  }));

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
            <button 
              className="clear-search"
              onClick={() => handleSearch("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <EventFilters onFilter={handleFilter} />

      {/* Personalized Recommendations */}
      {user && recommendations.length > 0 && (
        <div className="recommendations-section">
          <div className="section-header">
            <h3>✨ Recommended For You</h3>
            <button 
              className="toggle-btn"
              onClick={() => setShowRecommendations(!showRecommendations)}
            >
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

      {/* Main Event List */}
      <div className="events-section">
        <div className="section-header">
          <h3>
            {searchQuery 
              ? `Search Results (${eventsWithFavorites.length})` 
              : `All Events (${eventsWithFavorites.length})`}
          </h3>
        </div>

        {loading && page === 1 ? (
          <div className="loading-container">
            <div className="skeleton-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-image"></div>
                  <div className="skeleton-content">
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line short"></div>
                    <div className="skeleton-line"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : eventsWithFavorites.length === 0 ? (
          <div className="no-events">
            <div className="no-events-icon">🎭</div>
            <h3>No Events Found</h3>
            <p>
              {searchQuery 
                ? `No events match "${searchQuery}". Try different keywords.`
                : "No events available at the moment. Check back soon!"}
            </p>
          </div>
        ) : (
          <>
            <div className="event-grid">
              {eventsWithFavorites.map((event, index) => {
                // Add ref to last element for infinite scroll
                if (eventsWithFavorites.length === index + 1) {
                  return (
                    <div key={event.id} ref={lastEventRef}>
                      <EventCard 
                        event={event} 
                        user={user}
                        onSaveToFavorites={handleSaveToFavorites}
                        onEventClick={() => handleEventClick(event.id)}
                      />
                    </div>
                  );
                } else {
                  return (
                    <EventCard 
                      key={event.id}
                      event={event} 
                      user={user}
                      onSaveToFavorites={handleSaveToFavorites}
                      onEventClick={() => handleEventClick(event.id)}
                    />
                  );
                }
              })}
            </div>

            {/* Loading indicator for infinite scroll */}
            {loading && page > 1 && (
              <div className="loading-more">
                <div className="spinner"></div>
                <p>Loading more events...</p>
              </div>
            )}

            {/* End of results */}
            {!hasMore && eventsWithFavorites.length > 0 && (
              <div className="end-of-results">
                <p>🎉 You've seen all available events</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Back to top button */}
      {eventsWithFavorites.length > 6 && (
        <button 
          className="back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
    </div>
  );
};

export default EventList;