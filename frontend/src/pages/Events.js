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

  const [deletingId, setDeletingId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  const tableWrapperRef = useRef(null);

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

    const dateOnly = (event.event_date || "").toString().split("T")[0];
    const startStr = event.start_time || "00:00:00";
    const endStr = event.end_time || "23:59:59";

    const start = dateOnly ? new Date(`${dateOnly}T${startStr}`) : null;
    const end = dateOnly ? new Date(`${dateOnly}T${endStr}`) : null;
    const now = new Date();

    if (end && now > end) return "expired";
    if (start && end && now >= start && now <= end) return "ongoing";

    if (["upcoming", "active", "draft", "published"].includes(event.status)) {
      return event.status === "active" || event.status === "published"
        ? "upcoming"
        : event.status;
    }

    return "upcoming";
  };

  // -----------------------------
  // Fetch
  // -----------------------------
  const fetchEvents = useCallback(
    async (categoryMap, tagMap) => {
      if (!currentUser) return;

      try {
        setLoading(true);

        let url = "/events";
        if (currentUser.role === "admin") url = "/events/admin/all";
        else if (currentUser.role === "organizer")
          url = "/events/organizer/my-events";

        const res = await api.get(url, { headers: getAuthHeaders() });

        const enhanced = (res.data || []).map((ev) => ({
          ...ev,
          computed_status: formatEventStatus(ev),
          category_name: categoryMap?.[ev.category_id] || ev.category_name || "-",
          organizer_name: ev.organizer_name || "-",
          organizer_image: ev.organizer_image || ev.image || "",
        }));

        setEvents(enhanced);
      } catch (err) {
        console.error(err);
        setError("Failed to fetch events");
      } finally {
        setLoading(false);
      }
    },
    [currentUser]
  );

  const refreshData = useCallback(async () => {
    const [categoriesRes, tagsRes] = await Promise.all([
      api.get("/categories", { headers: getAuthHeaders() }).catch(() => ({ data: [] })),
      api.get("/tags", { headers: getAuthHeaders() }).catch(() => ({ data: [] })),
    ]);

    const categoriesData = categoriesRes.data || [];
    const tagsData = tagsRes.data || [];

    setCategories(categoriesData);
    setTags(tagsData);

    const categoryMap = Object.fromEntries(categoriesData.map((c) => [c.id, c.name]));
    const tagMap = Object.fromEntries(tagsData.map((t) => [t.id, t.name]));

    await fetchEvents(categoryMap, tagMap);
  }, [fetchEvents]);

  // -----------------------------
  // Actions
  // -----------------------------
  const openModal = (event = null) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  // -----------------------------
  // FIXED DELETE (anti-spam + rollback + lock)
  // -----------------------------
  const handleDelete = async (id) => {
    if (deletingId === id) return; // prevent double execution

    const confirmDelete = await new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "mini-confirm";

      modal.innerHTML = `
        <div class="mini-confirm-box">
          <p>Delete this event?</p>
          <div class="mini-actions">
            <button id="cancel">Cancel</button>
            <button id="ok">Delete</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector("#cancel").onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };

      modal.querySelector("#ok").onclick = () => {
        document.body.removeChild(modal);
        resolve(true);
      };
    });

    if (!confirmDelete) return;

    setDeletingId(id);

    const previous = [...events]; // ✅ FIX: real snapshot copy

    setEvents((prev) => prev.filter((e) => e.id !== id));

    try {
      await api.delete(`/events/${id}`, {
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Delete failed:", err?.response || err);

      // rollback UI
      setEvents(previous);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = (event) => {
    const copy = {
      ...event,
      title: `${event.title} (Copy)`,
      status: "upcoming",
    };
    delete copy.id;
    openModal(copy);
  };

  const handleTicketManagement = (event) => {
    setSelectedEventForTickets(event);
    setShowTicketModal(true);
    setOpenDropdownId(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!openDropdownId) return;
    const handler = (e) => {
      if (!e.target.closest(".action-dropdown")) setOpenDropdownId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdownId]);

  // -----------------------------
  // Filtered
  // -----------------------------
  const filteredEvents = events
    .filter((e) => {
      if (filterStatus === "active")
        return e.computed_status === "upcoming" || e.computed_status === "ongoing";
      if (filterStatus === "expired") return e.computed_status === "expired";
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

  if (!currentUser) return <p>Loading user...</p>;

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="events-container">

      <div className="events-header">
        <h2>Manage Events</h2>
        <button className="add-btn" onClick={() => openModal()}>
          ➕ Add Event
        </button>
      </div>

      {currentUser.role === "admin" && (
        <AdminPanels categories={categories} tags={tags} onRefresh={refreshData} />
      )}

      <div className="search-bar">
        <input
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
        />
      </div>

      <div className="filter-buttons">
        <button className={filterStatus === "all" ? "active" : ""} onClick={() => setFilterStatus("all")}>
          All
        </button>
        <button className={filterStatus === "active" ? "active" : ""} onClick={() => setFilterStatus("active")}>
          Active
        </button>
        <button className={filterStatus === "expired" ? "active" : ""} onClick={() => setFilterStatus("expired")}>
          Expired
        </button>
      </div>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="events-table-scroll" ref={tableWrapperRef}>
          <table className="events-table">
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
              {filteredEvents.map((event) => {
                const s = (event.computed_status || "upcoming").toLowerCase();

                return (
                  <tr key={event.id}>
                    <td>
                      {event.organizer_image ? (
                        <img className="event-poster" src={event.organizer_image} alt="" />
                      ) : (
                        <div className="no-poster">🖼️</div>
                      )}
                    </td>

                    <td>{event.title}</td>

                    <td>
                      <span className={`status-badge ${s}`}>
                        {s === "upcoming" ? "Upcoming"
                          : s === "ongoing" ? "Ongoing"
                          : s === "expired" ? "Expired"
                          : s === "cancelled" ? "Cancelled"
                          : s === "draft" ? "Draft"
                          : s}
                      </span>
                    </td>

                    <td>{event.location || "—"}</td>
                    <td>{event.venue || "—"}</td>
                    <td>{event.event_date?.split("T")[0]}</td>
                    <td>{event.organizer_name}</td>

                    <td>
                      <div className="action-dropdown">
                        <button
                          className="action-dropdown__trigger"
                          onClick={() => setOpenDropdownId(openDropdownId === event.id ? null : event.id)}
                          disabled={deletingId === event.id}
                        >
                          {deletingId === event.id ? "Deleting…" : "Actions ▾"}
                        </button>
                        {openDropdownId === event.id && (
                          <div className="action-dropdown__menu">
                            <button onClick={() => { openModal(event); setOpenDropdownId(null); }}>
                              ✏️ View / Edit
                            </button>
                            <button onClick={() => { handleDuplicate(event); setOpenDropdownId(null); }}>
                              📋 Duplicate
                            </button>
                            <button onClick={() => handleTicketManagement(event)}>
                              🎫 Tickets
                            </button>
                            <button
                              className="action-dropdown__delete"
                              onClick={() => { setOpenDropdownId(null); handleDelete(event.id); }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>
      )}

      {showModal && (
        <EventForm
          event={editingEvent}
          categories={categories}
          tags={tags}
          currentUser={currentUser}
          onClose={() => setShowModal(false)}
          onSave={refreshData}
        />
      )}

      {showTicketModal && selectedEventForTickets && (
        <TicketManagement
          event={selectedEventForTickets}
          isOpen={showTicketModal}
          onClose={() => setShowTicketModal(false)}
        />
      )}
    </div>
  );
};

export default Events;