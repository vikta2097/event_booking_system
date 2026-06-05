import React, { useEffect, useState, useCallback, useRef } from "react";
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

  const tableWrapperRef = useRef(null);
  const stickyScrollRef = useRef(null);
  const stickyInnerRef = useRef(null);

  // -----------------------------
  // Helpers
  // -----------------------------
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

  // -----------------------------
  // Fetch functions
  // -----------------------------
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/categories", { headers: getAuthHeaders() });
      return res.data || [];
    } catch {
      return [];
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.get("/tags", { headers: getAuthHeaders() });
      return res.data || [];
    } catch {
      return [];
    }
  }, []);

  const fetchEvents = useCallback(
    async (categoryMap, tagMap) => {
      if (!currentUser) return;

      try {
        setLoading(true);
        setError("");

        let url = "/events";
        if (currentUser.role === "admin") url = "/events/admin/all";
        else if (currentUser.role === "organizer")
          url = "/events/organizer/my-events";

        const res = await api.get(url, { headers: getAuthHeaders() });

        const enhanced = (res.data || []).map((ev) => ({
          ...ev,
          status: formatEventStatus(ev),
          category_name:
            categoryMap[ev.category_id] || ev.category_name || "-",
          organizer_name: ev.organizer_name || "-",
          organizer_image: ev.organizer_image || ev.image || "",
          tags_display: ev.tag_ids
            ? ev.tag_ids
                .split(",")
                .map((id) => tagMap[id])
                .filter(Boolean)
                .join(", ")
            : "",
        }));

        setEvents(enhanced);
      } catch (err) {
        setError("Failed to fetch events");
      } finally {
        setLoading(false);
      }
    },
    [currentUser]
  );

  const refreshData = useCallback(async () => {
    const [categoriesData, tagsData] = await Promise.all([
      fetchCategories(),
      fetchTags(),
    ]);

    setCategories(categoriesData);
    setTags(tagsData);

    const categoryMap = Object.fromEntries(
      categoriesData.map((c) => [c.id, c.name])
    );
    const tagMap = Object.fromEntries(tagsData.map((t) => [t.id, t.name]));

    await fetchEvents(categoryMap, tagMap);
  }, [fetchCategories, fetchTags, fetchEvents]);

  // -----------------------------
  // Event handlers (MUST be ABOVE effects)
  // -----------------------------
  const openModal = (event = null) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure?")) return;
    await api.delete(`/events/${id}`, { headers: getAuthHeaders() });
    refreshData();
  };

  const handleDuplicate = (event) => {
    const copy = {
      ...event,
      title: `${event.title} (Copy)`,
      status: "upcoming",
    };
    delete copy.id;
    delete copy.created_at;
    openModal(copy);
  };

  const handleTicketManagement = (event) => {
    setSelectedEventForTickets(event);
    setShowTicketModal(true);
  };

  // -----------------------------
  // Filtered events (MUST be before effects using it)
  // -----------------------------
  const filteredEvents = events
    .filter((e) => {
      if (filterStatus === "active")
        return e.status === "upcoming" || e.status === "ongoing";
      if (filterStatus === "expired") return e.status === "expired";
      return true;
    })
    .filter((e) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();

      return (
        e.title?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q) ||
        e.organizer_name?.toLowerCase().includes(q) ||
        e.category_name?.toLowerCase().includes(q)
      );
    });

  // -----------------------------
  // Effects
  // -----------------------------
  useEffect(() => {
    if (currentUser) refreshData();
  }, [currentUser, refreshData]);

  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    const sticky = stickyScrollRef.current;
    const inner = stickyInnerRef.current;
    if (!wrapper || !sticky || !inner) return;

    const syncWidth = () => {
      inner.style.width = wrapper.scrollWidth + "px";
    };

    syncWidth();

    const onScroll = () => {
      sticky.scrollLeft = wrapper.scrollLeft;
    };

    wrapper.addEventListener("scroll", onScroll);

    const ro = new ResizeObserver(syncWidth);
    ro.observe(wrapper);

    return () => {
      wrapper.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [filteredEvents]);

  if (!currentUser) return <p>Loading user...</p>;

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="events-container">
      <div className="events-header">
        <h2>Manage Events</h2>
        <button className="add-btn" onClick={() => openModal()}>➕ Add Event</button>
      </div>

      {currentUser.role === "admin" && (
        <AdminPanels
          categories={categories}
          tags={tags}
          onRefresh={refreshData}
        />
      )}

      {/* Fix 4: search input gets its class */}
      <div className="search-bar">
        <input
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
        />
      </div>

      {/* Fix 5: active filter button gets .active class */}
      <div className="filter-buttons">
        <button
          className={filterStatus === "all" ? "active" : ""}
          onClick={() => setFilterStatus("all")}
        >
          All
        </button>
        <button
          className={filterStatus === "active" ? "active" : ""}
          onClick={() => setFilterStatus("active")}
        >
          Active
        </button>
        <button
          className={filterStatus === "expired" ? "active" : ""}
          onClick={() => setFilterStatus("expired")}
        >
          Expired
        </button>
      </div>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <>
          <div className="events-table-wrapper" ref={tableWrapperRef}>
            <table className="events-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Tags</th>
                  <th>Status</th>
                  <th>Price (KES)</th>
                  <th>Capacity</th>
                  <th>Early Bird</th>
                  <th>Location</th>
                  <th>Venue</th>
                  <th>Parking</th>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Organizer</th>
                  <th>Email</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    {/* organizer_image URL → rendered as image */}
                    <td>
                      {event.organizer_image ? (
                        <img
                          src={event.organizer_image}
                          alt={event.organizer_name || "organizer"}
                          className="event-poster"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      ) : (
                        <div className="no-poster">🖼️</div>
                      )}
                    </td>

                    <td>{event.title}</td>

                    {/* description truncated — full text on hover via CSS */}
                    <td>
                      <span className="tags-cell" title={event.description}>
                        {event.description}
                      </span>
                    </td>

                    <td>{event.category_name}</td>

                    <td>
                      {event.tags_display ? (
                        <span className="tags-cell">{event.tags_display}</span>
                      ) : (
                        <span className="no-tags">—</span>
                      )}
                    </td>

                    <td>
                      <span className={`status-badge ${event.status}`}>
                        {event.status}
                      </span>
                    </td>

                    <td>{event.price === 0 || event.price === "0" ? "Free" : event.price}</td>

                    <td>{event.capacity}</td>

                    {/* Early bird info */}
                    <td>
                      {event.is_early_bird ? (
                        <>
                          <span className="badge-sm early-bird">Early Bird</span>
                          <span className="sub-text">KES {event.early_bird_price}</span>
                          {event.early_bird_deadline && (
                            <span className="sub-text">Until {event.early_bird_deadline}</span>
                          )}
                        </>
                      ) : (
                        <span className="no-tags">—</span>
                      )}
                    </td>

                    {/* map_link URL → shown as clickable 📍 Location */}
                    <td>
                      {event.map_link ? (
                        <a href={event.map_link} target="_blank" rel="noopener noreferrer">
                          📍 {event.location || "View Map"}
                        </a>
                      ) : (
                        event.location || <span className="no-tags">—</span>
                      )}
                    </td>

                    <td>{event.venue || <span className="no-tags">—</span>}</td>

                    <td>{event.parking_info || <span className="no-tags">—</span>}</td>

                    <td>{event.event_date?.split("T")[0] || event.event_date}</td>

                    <td>{event.start_time}</td>

                    <td>{event.end_time || <span className="no-tags">—</span>}</td>

                    {/* organizer_name shown as text */}
                    <td>{event.organizer_name}</td>

                    <td>{event.organizer_email || <span className="no-tags">—</span>}</td>

                    <td>
                      <div className="action-buttons">
                        <button className="btn-sm view" onClick={() => openModal(event)}>
                          View
                        </button>
                        <button className="btn-sm duplicate" onClick={() => handleDuplicate(event)}>
                          Duplicate
                        </button>
                        <button className="btn-sm tickets" onClick={() => handleTicketManagement(event)}>
                          Tickets
                        </button>
                        <button className="btn-sm delete" onClick={() => handleDelete(event.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="events-sticky-scroll" ref={stickyScrollRef}>
            <div
              className="events-sticky-scroll-inner"
              ref={stickyInnerRef}
            />
          </div>
        </>
      )}

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