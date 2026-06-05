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
        tags_display: ev.tag_ids
          ? ev.tag_ids.split(",")
              .map(id => tagMap[id])
              .filter(Boolean)
              .join(", ")
          : ""
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

  // Filtered events (MOVED ABOVE useEffect to fix ESLint error)
  const filteredEvents = events
    .filter((event) => {
      if (filterStatus === "active")
        return event.status === "upcoming" || event.status === "ongoing";

      if (filterStatus === "expired")
        return event.status === "expired";

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

  // Initial load
  useEffect(() => {
    if (currentUser) refreshData();
  }, [currentUser, refreshData]);

  // Sticky horizontal scrollbar
  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    const sticky = stickyScrollRef.current;
    const inner = stickyInnerRef.current;
    if (!wrapper || !sticky || !inner) return;

    const syncWidth = () => {
      inner.style.width = wrapper.scrollWidth + "px";
    };

    syncWidth();

    const onWrapperScroll = () => {
      sticky.scrollLeft = wrapper.scrollLeft;
    };

    const onStickyScroll = () => {
      wrapper.scrollLeft = sticky.scrollLeft;
    };

    wrapper.addEventListener("scroll", onWrapperScroll);
    sticky.addEventListener("scroll", onStickyScroll);

    const observer = new IntersectionObserver(([entry]) => {
      sticky.style.display = entry.isIntersecting ? "block" : "none";
      if (entry.isIntersecting) syncWidth();
    });

    observer.observe(wrapper);

    const ro = new ResizeObserver(syncWidth);
    ro.observe(wrapper);

    return () => {
      wrapper.removeEventListener("scroll", onWrapperScroll);
      sticky.removeEventListener("scroll", onStickyScroll);
      observer.disconnect();
      ro.disconnect();
    };
  }, [filteredEvents]);

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

  if (!currentUser) return <p>Loading user...</p>;

  return (
    <div className="events-container">
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

      {currentUser?.role === "admin" && (
        <AdminPanels
          categories={categories}
          tags={tags}
          onRefresh={refreshData}
        />
      )}

      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Search events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-buttons">
        <button onClick={() => setFilterStatus("all")} className={filterStatus === "all" ? "active" : ""}>
          All ({events.length})
        </button>
        <button onClick={() => setFilterStatus("active")} className={filterStatus === "active" ? "active" : ""}>
          Active ({events.filter(e => e.status === "upcoming" || e.status === "ongoing").length})
        </button>
        <button onClick={() => setFilterStatus("expired")} className={filterStatus === "expired" ? "active" : ""}>
          Expired ({events.filter(e => e.status === "expired").length})
        </button>
      </div>

      {loading ? (
        <p className="loading">Loading events...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : filteredEvents.length === 0 ? (
        <div className="no-data">
          <h3>No Events Found</h3>
        </div>
      ) : (
        <>
          <div className="events-table-wrapper" ref={tableWrapperRef}>
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
                      <td>{event.title}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          </div>

          <div className="events-sticky-scroll" ref={stickyScrollRef}>
            <div className="events-sticky-scroll-inner" ref={stickyInnerRef} />
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