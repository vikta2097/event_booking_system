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
    if (!event) return "upcoming";
    if (event.status === "cancelled") return "cancelled";

    // event_date may be "2026-01-12" OR a full ISO "2026-01-12T00:00:00.000Z"
    const dateOnly = (event.event_date || "").toString().split("T")[0];
    const startStr = event.start_time || "00:00:00";
    const endStr = event.end_time || "23:59:59";

    const start = dateOnly ? new Date(`${dateOnly}T${startStr}`) : null;
    const end = dateOnly ? new Date(`${dateOnly}T${endStr}`) : null;
    const now = new Date();

    if (end && !isNaN(end) && now > end) return "expired";
    if (start && end && !isNaN(start) && !isNaN(end) && now >= start && now <= end) return "ongoing";
    // Known DB statuses fall through cleanly
    if (["upcoming", "active", "draft", "published"].includes(event.status)) {
      return event.status === "active" || event.status === "published" ? "upcoming" : event.status;
    }
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
              <colgroup>
                <col style={{ width: "90px" }} />   {/* Image */}
                <col style={{ minWidth: "160px" }} /> {/* Title */}
                <col style={{ width: "120px" }} />  {/* Status */}
                <col style={{ minWidth: "140px" }} /> {/* Location */}
                <col style={{ minWidth: "120px" }} /> {/* Venue */}
                <col style={{ width: "110px" }} />  {/* Date */}
                <col style={{ minWidth: "130px" }} /> {/* Organizer */}
                <col style={{ minWidth: "240px" }} /> {/* Actions */}
              </colgroup>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Venue</th>
                  <th>Date</th>
                  <th>Organizer</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    {/* Image */}
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

                    {/* Title */}
                    <td>{event.title}</td>

                    {/* Status — dedicated column, badge stays here */}
                    <td>
                      {(() => {
                        const s = (event.status || "upcoming").toLowerCase();
                        const label = s.charAt(0).toUpperCase() + s.slice(1);
                        return (
                          <span className={`status-badge ${s}`}>
                            <span className="status-dot" />
                            {label}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Location */}
                    <td>
                      {event.map_link ? (
                        <a href={event.map_link} target="_blank" rel="noopener noreferrer">
                          📍 {event.location || "View Map"}
                        </a>
                      ) : (
                        event.location || <span className="no-tags">—</span>
                      )}
                    </td>

                    {/* Venue */}
                    <td>{event.venue || <span className="no-tags">—</span>}</td>

                    {/* Date */}
                    <td>{event.event_date?.split("T")[0] || event.event_date}</td>

                    {/* Organizer */}
                    <td>{event.organizer_name}</td>

                    {/* Actions */}
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
