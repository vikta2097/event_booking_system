import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import "../styles/Events.css";

const Events = ({ currentUser }) => {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({});

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [ticketForm, setTicketForm] = useState({ 
    name: "", 
    description: "", 
    price: "", 
    quantity_available: "" 
  });
  const [ticketTypes, setTicketTypes] = useState([]);
  const [, setTicketLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState("all");

  const [showCategoryCard, setShowCategoryCard] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  // =======================
  // HELPER FUNCTIONS
  // =======================
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

  // =======================
  // FETCH FUNCTIONS (useCallback with proper dependencies)
  // =======================
  
  
  
// Fetch categories - simple, no dependencies
const fetchCategories = useCallback(async () => {
  try {
    const res = await api.get("/categories", { headers: getAuthHeaders() });
    setCategories(res.data || []);
    return res.data || [];
  } catch (err) {
    console.error("Failed to fetch categories", err);
    return [];
  }
}, []); // No dependencies needed

  
// Fetch events - properly memoized
const fetchEvents = useCallback(async () => {
  if (!currentUser) return;

  try {
    setLoading(true);

    // Get fresh categories
    const res = await api.get("/categories", { headers: getAuthHeaders() });
    const categoriesData = res.data || [];
    const categoryMap = categoriesData.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});

    // Get events
    const url = currentUser.role === "admin" ? "/events/admin/all" : "/events";
    const eventsRes = await api.get(url, { headers: getAuthHeaders() });

    const enhancedEvents = (eventsRes.data || []).map((ev) => ({
      ...ev,
      status: formatEventStatus(ev),
      category_name: categoryMap[ev.category_id] || "-",
    }));

    setEvents(enhancedEvents);
    setError("");
  } catch (err) {
    console.error("Error fetching events:", err);
    setError("Failed to fetch events");
  } finally {
    setLoading(false);
  }
}, [currentUser]); // ✅ Include currentUser as dependency

  // ✅ Fetch ticket types
  const fetchTicketTypes = useCallback(async (eventId) => {
    try {
      setTicketLoading(true);
      const res = await api.get(`/events/${eventId}/ticket-types`, { headers: getAuthHeaders() });
      setTicketTypes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch ticket types:", err);
      setTicketTypes([]);
    } finally {
      setTicketLoading(false);
    }
  }, []);

  // =======================
  // INITIAL LOAD - Only runs once when currentUser changes
  // =======================
  // =======================
// INITIAL LOAD - Only runs when currentUser changes
// =======================
useEffect(() => {
  if (!currentUser) return;

  const loadData = async () => {
    try {
      // Fetch categories
      const res = await api.get("/categories", { headers: getAuthHeaders() });
      const categoriesData = res.data || [];
      setCategories(categoriesData);

      // Fetch events
      const categoryMap = categoriesData.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
      const url = currentUser.role === "admin" ? "/events/admin/all" : "/events";
      const eventsRes = await api.get(url, { headers: getAuthHeaders() });

      const enhancedEvents = (eventsRes.data || []).map((ev) => ({
        ...ev,
        status: formatEventStatus(ev),
        category_name: categoryMap[ev.category_id] || "-",
      }));

      setEvents(enhancedEvents);
      setError("");
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  loadData();
}, [currentUser]);
  // =======================
  // TICKET HANDLERS
  // =======================
  const handleTicketChange = (e) => {
    const { name, value } = e.target;
    setTicketForm({ ...ticketForm, [name]: value });
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { 
        ...ticketForm, 
        price: Number(ticketForm.price), 
        quantity_available: Number(ticketForm.quantity_available) 
      };

      if (editingTicket) {
        await api.put(`/ticket-types/${editingTicket.id}`, payload, { headers: getAuthHeaders() });
      } else {
        await api.post(`/events/${editingEvent.id}/ticket-types`, payload, { headers: getAuthHeaders() });
      }

      fetchTicketTypes(editingEvent.id);
      setTicketForm({ name: "", description: "", price: "", quantity_available: "" });
      setEditingTicket(null);
    } catch (err) {
      console.error("Ticket save failed", err);
    }
  };

  const handleTicketDelete = async (ticketId) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await api.delete(`/ticket-types/${ticketId}`, { headers: getAuthHeaders() });
      fetchTicketTypes(editingEvent.id);
    } catch (err) {
      console.error("Ticket delete failed", err);
    }
  };

  // =======================
  // FORM HANDLERS
  // =======================
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const openModal = (event = null) => {
    if (!currentUser) return;

    if (event) {
      setEditingEvent(event);
      setFormData({ ...event, category_id: event.category_id || "" });
      fetchTicketTypes(event.id);
    } else {
      setEditingEvent(null);
      setFormData({
        title: "",
        description: "",
        category_id: "",
        location: "",
        event_date: "",
        start_time: "",
        end_time: "",
        capacity: "",
        price: "",
        status: "upcoming",
      });
      setTicketTypes([]);
    }

    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      const payload = {
        ...formData,
        created_by: currentUser.id,
        price: Number(formData.price) || 0,
        capacity: Number(formData.capacity) || 0,
      };

      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, payload, { headers: getAuthHeaders() });
      } else {
        await api.post("/events", payload, { headers: getAuthHeaders() });
      }

      await fetchEvents(); // ✅ Now safe to call
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError("Failed to save event");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await api.delete(`/events/${id}`, { headers: getAuthHeaders() });
      await fetchEvents(); // ✅ Now safe to call
    } catch (err) {
      console.error(err);
      setError("Failed to delete event");
    }
  };

  // =======================
  // CATEGORY HANDLERS
  // =======================
  const handleCategoryAdd = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      await api.post("/categories", { name: newCategory }, { headers: getAuthHeaders() });
      setNewCategory("");
      setShowCategoryCard(false);
      await fetchCategories();
    } catch (err) {
      setCategoryError("Failed to add category");
    }
  };

  const handleCategoryUpdate = async (id, name) => {
    if (!name.trim()) return;
    try {
      await api.put(`/categories/${id}`, { name }, { headers: getAuthHeaders() });
      setEditingCategory(null);
      await fetchCategories();
    } catch (err) {
      setCategoryError("Failed to update category");
    }
  };

  const handleCategoryDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await api.delete(`/categories/${id}`, { headers: getAuthHeaders() });
      await fetchCategories();
    } catch (err) {
      setCategoryError("Failed to delete category");
    }
  };

  // =======================
  // FILTERED EVENTS
  // =======================
  const filteredEvents = events.filter((event) => {
    if (filterStatus === "active") return event.status === "upcoming" || event.status === "ongoing";
    if (filterStatus === "expired") return event.status === "expired";
    return true;
  });

  if (!currentUser) return <p>Loading user...</p>;


  // =======================
  // RENDER
  // =======================
  return (
    <div className="events-container">
      {/* Header */}
      <div className="events-header">
        <h2>Manage Events</h2>
        <button className="add-btn" onClick={() => openModal()}>+ Add Event</button>
        {currentUser?.role === "admin" && (
          <button
            className="add-btn"
            onClick={() => {
              setShowCategoryCard(!showCategoryCard);
              setEditingCategory(null);
              setNewCategory("");
            }}
          >
            + Manage Categories
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-buttons">
        <button onClick={() => setFilterStatus("all")} className={filterStatus === "all" ? "active" : ""}>All</button>
        <button onClick={() => setFilterStatus("active")} className={filterStatus === "active" ? "active" : ""}>Active</button>
        <button onClick={() => setFilterStatus("expired")} className={filterStatus === "expired" ? "active" : ""}>Expired</button>
      </div>

      {/* Category Card */}
      {showCategoryCard && currentUser?.role === "admin" && (
        <div className="category-card">
          <h4>{editingCategory ? "Edit Category" : "Add New Category"}</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingCategory) handleCategoryUpdate(editingCategory.id, editingCategory.name);
              else handleCategoryAdd(e);
            }}
          >
            <input
              type="text"
              placeholder="Category name"
              value={editingCategory ? editingCategory.name : newCategory}
              onChange={(e) => editingCategory
                ? setEditingCategory({ ...editingCategory, name: e.target.value })
                : setNewCategory(e.target.value)
              }
              required
            />
            <button type="submit">{editingCategory ? "Update" : "Add"}</button>
            <button type="button" onClick={() => setShowCategoryCard(false)}>Cancel</button>
          </form>
          <ul>
            {categories.map((c) => (
              <li key={c.id}>
                {editingCategory && editingCategory.id === c.id ? (
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  />
                ) : (
                  <>
                    {c.name}
                    <button onClick={() => setEditingCategory(c)}>Edit</button>
                    <button onClick={() => handleCategoryDelete(c.id)}>Delete</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {categoryError && <p className="error">{categoryError}</p>}
        </div>
      )}

      {/* Events Table */}
      {loading ? (
        <p className="loading">Loading events...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : filteredEvents.length === 0 ? (
        <p className="no-data">No events found.</p>
      ) : (
        <table className="events-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Date</th>
              <th>Start</th>
              <th>End</th>
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
                <td>{event.category_name || "-"}</td>
                <td>{new Date(event.event_date).toLocaleDateString()}</td>
                <td>{event.start_time}</td>
                <td>{event.end_time}</td>
                <td>{event.location}</td>
                <td>{event.capacity}</td>
                <td>KES {event.price}</td>
                <td className={`status ${event.status}`}>{event.status}</td>
                <td>
                  <button className="edit-btn" onClick={() => openModal(event)}>View</button>
                  {event.status !== "expired" && (
                    <>
                      <button className="delete-btn" onClick={() => handleDelete(event.id)}>Delete</button>
                      {(currentUser?.role === "admin" || currentUser?.id === event.created_by) && (
                        <button className="add-btn" onClick={() => {
                          setEditingEvent(event);
                          setShowTicketModal(true);
                          fetchTicketTypes(event.id);
                        }}>Manage Tickets</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Event Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingEvent ? "Edit Event" : "Add New Event"}</h3>
            <form onSubmit={handleSubmit}>
              {/* Form fields */}
              <label>Title</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required />
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} />
              <label>Category</label>
              <select name="category_id" value={formData.category_id} onChange={handleChange}>
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label>Location</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} />
              <div className="date-group">
                <div>
                  <label>Event Date</label>
                  <input type="date" name="event_date" value={formData.event_date} onChange={handleChange} required />
                </div>
                <div>
                  <label>Start Time</label>
                  <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} required />
                </div>
                <div>
                  <label>End Time</label>
                  <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} required />
                </div>
              </div>
              <div className="row-group">
                <div>
                  <label>Capacity</label>
                  <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} />
                </div>
                <div>
                  <label>Price (KES)</label>
                  <input type="number" name="price" value={formData.price} onChange={handleChange} />
                </div>
              </div>
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
              </select>
              <div className="modal-actions">
                <button type="submit" className="save-btn">Save</button>
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {showTicketModal && editingEvent && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Manage Tickets for {editingEvent.title}</h3>
            <form onSubmit={handleTicketSubmit}>
              <label>Name</label>
              <input type="text" name="name" value={ticketForm.name} onChange={handleTicketChange} required />
              <label>Description</label>
              <textarea name="description" value={ticketForm.description} onChange={handleTicketChange} />
              <label>Price (KES)</label>
              <input type="number" name="price" value={ticketForm.price} onChange={handleTicketChange} required />
              <label>Quantity Available</label>
              <input type="number" name="quantity_available" value={ticketForm.quantity_available} onChange={handleTicketChange} required />
              <div className="modal-actions">
                <button type="submit" className="save-btn">{editingTicket ? "Update" : "Add Ticket"}</button>
                <button type="button" className="cancel-btn" onClick={() => {
                  setShowTicketModal(false);
                  setEditingTicket(null);
                  setTicketForm({ name: "", description: "", price: "", quantity_available: "" });
                }}>Close</button>
              </div>
            </form>

            {/* Ticket List */}
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ticketTypes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center" }}>No tickets found.</td></tr>
                ) : ticketTypes.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.description}</td>
                    <td>KES {t.price}</td>
                    <td>{t.quantity_available}</td>
                    <td>
                      <button className="edit-btn" onClick={() => {
                        setEditingTicket(t);
                        setTicketForm({ name: t.name, description: t.description, price: t.price, quantity_available: t.quantity_available });
                      }}>Edit</button>
                      <button className="delete-btn" onClick={() => handleTicketDelete(t.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
