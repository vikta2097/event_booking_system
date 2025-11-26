import React, { useEffect, useState } from "react";
import api from "../api"; // centralized axios instance
import "../styles/Events.css";

const Events = ({ currentUser }) => {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Event modal
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
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

  // Ticket types
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ticketForm, setTicketForm] = useState({
    name: "",
    description: "",
    price: "",
    quantity_available: "",
  });
  const [editingTicket, setEditingTicket] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Categories
  const [showCategoryCard, setShowCategoryCard] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryError, setCategoryError] = useState("");

  // Filter for events: all | active | expired
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (!currentUser) return;
    fetchEvents();
    fetchCategories();
  }, [currentUser]);

  // =======================
  // FETCH EVENTS
  // =======================
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await api.get("/events", { headers: { Authorization: `Bearer ${token}` } });

      // Automatically calculate status
      const enhancedEvents = (res.data || []).map((ev) => {
        const now = new Date();
        const eventStart = new Date(`${ev.event_date}T${ev.start_time}`);
        const eventEnd = new Date(`${ev.event_date}T${ev.end_time}`);
        let status = ev.status;

        if (ev.status !== "cancelled") {
          if (now > eventEnd) status = "expired";
          else if (now >= eventStart && now <= eventEnd) status = "ongoing";
          else status = "upcoming";
        }

        return { ...ev, status };
      });

      setEvents(enhancedEvents);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  };

  // =======================
  // FETCH CATEGORIES
  // =======================
  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get("/categories", { headers: { Authorization: `Bearer ${token}` } });
      setCategories(res.data || []);
    } catch (err) {
      console.error("Failed to fetch categories");
    }
  };

  // =======================
  // FETCH TICKET TYPES
  // =======================
  const fetchTicketTypes = async (eventId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/events/${eventId}/ticket-types`, { headers: { Authorization: `Bearer ${token}` } });
      setTicketTypes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch ticket types", err);
      setTicketTypes([]);
    }
  };

  // =======================
  // EVENT FORM HANDLERS
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
      const token = localStorage.getItem("token");
      const payload = { ...formData, created_by: currentUser.id };

      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await api.post("/events", payload, { headers: { Authorization: `Bearer ${token}` } });
      }

      fetchEvents();
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError("Failed to save event");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/events/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchEvents();
    } catch (err) {
      console.error(err);
      setError("Failed to delete event");
    }
  };

  // =======================
  // TICKET FORM HANDLERS
  // =======================
  const handleTicketChange = (e) => setTicketForm({ ...ticketForm, [e.target.name]: e.target.value });

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      const token = localStorage.getItem("token");
      if (editingTicket) {
        await api.put(`/ticket-types/${editingTicket.id}`, ticketForm, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await api.post(`/events/${editingEvent.id}/ticket-types`, ticketForm, { headers: { Authorization: `Bearer ${token}` } });
      }

      // Reset ticket form
      setTicketForm({ name: "", description: "", price: "", quantity_available: "" });
      setEditingTicket(null);
      fetchTicketTypes(editingEvent.id);
    } catch (err) {
      console.error("Failed to save ticket type", err);
    }
  };

  const handleTicketDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ticket type?")) return;
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/ticket-types/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchTicketTypes(editingEvent.id);
    } catch (err) {
      console.error("Failed to delete ticket type", err);
    }
  };

  // =======================
  // CATEGORY HANDLERS
  // =======================
  const handleCategoryAdd = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      const token = localStorage.getItem("token");
      await api.post("/categories", { name: newCategory }, { headers: { Authorization: `Bearer ${token}` } });
      setNewCategory("");
      setShowCategoryCard(false);
      fetchCategories();
    } catch (err) {
      setCategoryError("Failed to add category");
    }
  };

  const handleCategoryUpdate = async (id, name) => {
    try {
      const token = localStorage.getItem("token");
      await api.put(`/categories/${id}`, { name }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingCategory(null);
      fetchCategories();
    } catch (err) {
      setCategoryError("Failed to update category");
    }
  };

  const handleCategoryDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/categories/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchCategories();
    } catch (err) {
      setCategoryError("Failed to delete category");
    }
  };

  if (!currentUser) return <p>Loading user...</p>;

  // =======================
  // FILTERED EVENTS
  // =======================
  const filteredEvents = events.filter((event) => {
    if (filterStatus === "active") return event.status === "upcoming" || event.status === "ongoing";
    if (filterStatus === "expired") return event.status === "expired";
    return true; // all
  });

  return (
    <div className="events-container">
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

      {/* Filter */}
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
              <label>Title</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required />
              <label>Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} />
              <label>Category</label>
              <select name="category_id" value={formData.category_id} onChange={handleChange}>
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
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
                }}>Cancel</button>
              </div>
            </form>

            <h4>Existing Tickets</h4>
            <ul>
              {ticketTypes.map((t) => (
                <li key={t.id}>
                  {t.name} - KES {t.price} ({t.quantity_sold}/{t.quantity_available})
                  <button onClick={() => {
                    setEditingTicket(t);
                    setTicketForm({ name: t.name, description: t.description, price: t.price, quantity_available: t.quantity_available });
                  }}>Edit</button>
                  <button onClick={() => handleTicketDelete(t.id)}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
