import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import EventForm from "../events/EventForm";
import TicketManagement from "../events/TicketManagement";
import AdminPanels from "../events/AdminPanels";
import "../styles/Events.css";

const Events = ({ currentUser }) => {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedEventForTickets, setSelectedEventForTickets] = useState(null);

  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Helper functions
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const formatEventStatus = (event) => {
    if (event.status === "cancelled") return "cancelled";
    const now = new Date();
    const start = new Date(`${event.event_date}T${event.start_time}`);
    const end = new Date(`${event.event_date}T${event.end_time}`);
    if (now > end) return "expired";
    if (now >= start && now <= end) return "ongoing";
    return "upcoming";
  };

  // Fetch functions
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/categories", { headers: getAuthHeaders() });
      return res.data || [];
    } catch (err) {
      console.error("Failed to fetch categories", err);
      return [];
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.get("/tags", { headers: getAuthHeaders() });
      return res.data || [];
    } catch (err) {
      console.error("Failed to fetch tags", err);
      return [];
    }
  }, []);

  const fetchEvents = useCallback(async (categoryMap, tagMap) => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setError("");

      let url = "/events";
      if (currentUser.role === "admin") url = "/events/admin/all";
      else if (currentUser.role === "organizer") url = "/events/organizer/my-events";

      const eventsRes = await api.get(url, { headers: getAuthHeaders() });
      const enhancedEvents = (eventsRes.data || []).map(ev => ({
        ...ev,
        status: formatEventStatus(ev),
        category_name: categoryMap[ev.category_id] || ev.category_name || "-",
        organizer_name: ev.organizer_name || "-",
        organizer_image: ev.organizer_image || ev.image || "",
        tags_display: ev.tag_ids ? ev.tag_ids.split(',').map(id => tagMap[id]).filter(Boolean).join(', ') : ""
      }));

      setEvents(enhancedEvents);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const refreshData = useCallback(async () => {
    const [categoriesData, tagsData] = await Promise.all([
      fetchCategories(),
      fetchTags()
    ]);

    setCategories(categoriesData);
    setTags(tagsData);

    const categoryMap = categoriesData.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
    const tagMap = tagsData.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});
    
    await fetchEvents(categoryMap, tagMap);
  }, [fetchCategories, fetchTags, fetchEvents]);

  // Initial load
  useEffect(() => {
    if (currentUser) refreshData();
  }, [currentUser, refreshData]);

  // Event handlers
  const openModal = (event = null) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await api.delete(`/events/${id}`, { headers: getAuthHeaders() });
      await refreshData();
    } catch (err) {
      console.error(err);
      setError("Failed to delete event");
    }
  };

  const handleDuplicate = (event) => {
    const duplicated = {
      ...event,
      title: `${event.title} (Copy)`,
      status: "upcoming"
    };
    delete duplicated.id;
    delete duplicated.created_at;
    
    openModal(duplicated);
  };

  const handleTicketManagement = (event) => {
    setSelectedEventForTickets(event);
    setShowTicketModal(true);
  };

  // Filtered events
  const filteredEvents = events
    .filter((event) => {
      if (filterStatus === "active") return event.status === "upcoming" || event.status === "ongoing";
      if (filterStatus === "expired") return event.status === "expired";
      return true;
    })
    .filter((event) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query) ||
        (event.organizer_name && event.organizer_name.toLowerCase().includes(query)) ||
        (event.category_name && event.category_name.toLowerCase().includes(query))
      );
    });

  if (!currentUser) return <p>Loading user...</p>;

  return (
    <div className="events-container">
      {/* Header */}
      <div className="events-header">
        <div>
          <h2>Manage Events</h2>
          <p className="subtitle">Create and manage your events</p>
        </div>
        <div className="header-actions">
          <button className="add-btn" onClick={() => openModal()}>
            ➕ Add Event
          </button>
        </div>
      </div>

      {/* Admin Panels */}
      {currentUser?.role === "admin" && (
        <AdminPanels
          categories={categories}
          tags={tags}
          onRefresh={refreshData}
        />
      )}

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Filters */}
      <div className="filter-buttons">
        <button 
          onClick={() => setFilterStatus("all")} 
          className={filterStatus === "all" ? "active" : ""}
        >
          All ({events.length})
        </button>
        <button 
          onClick={() => setFilterStatus("active")} 
          className={filterStatus === "active" ? "active" : ""}
        >
          Active ({events.filter(e => e.status === "upcoming" || e.status === "ongoing").length})
        </button>
        <button 
          onClick={() => setFilterStatus("expired")} 
          className={filterStatus === "expired" ? "active" : ""}
        >
          Expired ({events.filter(e => e.status === "expired").length})
        </button>
      </div>

      {/* Events Table */}
      {loading ? (
        <p className="loading">Loading events...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : filteredEvents.length === 0 ? (
        <div className="no-data">
          <div className="no-data-icon">🎭</div>
          <h3>No Events Found</h3>
          <p>{searchQuery ? "Try different search terms" : "Create your first event to get started"}</p>
          <button className="add-btn" onClick={() => openModal()}>Create Event</button>
        </div>
      ) : (
        <div className="events-table-wrapper">
          <div className="events-table-scroll">
            <table className="events-table">
              <thead>
                <tr>
                  <th>Poster</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Tags</th>
                  <th>Organizer</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Capacity</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      {event.organizer_image ? (
                        <img src={event.organizer_image} alt={event.title} className="event-poster" />
                      ) : (
                        <div className="no-poster">📷</div>
                      )}
                    </td>
                    <td>
                      <strong>{event.title}</strong>
                      {event.venue && <div className="sub-text">{event.venue}</div>}
                    </td>
                    <td>{event.category_name}</td>
                    <td>
                      {event.tags_display ? (
                        <div className="tags-cell">{event.tags_display}</div>
                      ) : (
                        <span className="no-tags">-</span>
                      )}
                    </td>
                    <td>{event.organizer_name}</td>
                    <td>{new Date(event.event_date).toLocaleDateString()}</td>
                    <td>{event.start_time} - {event.end_time}</td>
                    <td>{event.location}</td>
                    <td>
                      {event.capacity}
                      {event.total_seats_booked && (
                        <div className="sub-text">{event.total_seats_booked} booked</div>
                      )}
                    </td>
                    <td>KES {event.price.toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${event.status}`}>
                        {event.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-sm view" onClick={() => openModal(event)} title="View/Edit">
                          👁️
                        </button>
                        <button className="btn-sm duplicate" onClick={() => handleDuplicate(event)} title="Duplicate">
                          📋
                        </button>
                        {event.status !== "expired" && (
                          <>
                            <button className="btn-sm tickets" onClick={() => handleTicketManagement(event)} title="Manage Tickets">
                              🎫
                            </button>
                            <button className="btn-sm delete" onClick={() => handleDelete(event.id)} title="Delete">
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Form Modal */}
      {showModal && (
        <EventForm
          event={editingEvent}
          categories={categories}
          tags={tags}
          currentUser={currentUser}
          onClose={() => {
            setShowModal(false);
            setEditingEvent(null);
          }}
          onSave={refreshData}
        />
      )}

      {/* Ticket Management Modal */}
      {showTicketModal && selectedEventForTickets && (
        <TicketManagement
          event={selectedEventForTickets}
          isOpen={showTicketModal}
          onClose={() => {
            setShowTicketModal(false);
            setSelectedEventForTickets(null);
          }}
        />
      )}
    </div>
  );
};

export default Events;