import React, { useEffect, useState } from "react";
import api from "../api"; // ✅ Use your configured API instance
import "../styles/Events.css";

const Events = ({ currentUser }) => {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: "",
    location: "",
    venue: "",
    event_date: "",
    start_time: "",
    end_time: "",
    capacity: "",
    price: "",
    status: "upcoming",
    organizer_email: "",
    parking_info: "",
    map_link: ""
  });

  // Ticket Form State
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [selectedEventForTickets, setSelectedEventForTickets] = useState(null);
  const [ticketFormData, setTicketFormData] = useState({
    name: "",
    description: "",
    price: "",
    quantity_available: "",
    is_early_bird: false,
    early_bird_deadline: "",
    is_group_discount: false,
    group_size: "",
    group_discount_percent: ""
  });
  const [ticketFormError, setTicketFormError] = useState("");
  const [ticketFormLoading, setTicketFormLoading] = useState(false);

  // Category management
  const [showCategoryCard, setShowCategoryCard] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryError, setCategoryError] = useState("");

  // Fetch events and categories
  useEffect(() => {
    if (!currentUser) return;
    fetchEvents();
    fetchCategories();
  }, [currentUser]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await api.get("/events");
      setEvents(res.data);
    } catch (err) {
      setError("Failed to fetch events");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  // Event handlers
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTicketFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTicketFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const openModal = (event = null) => {
    if (!currentUser) return;
    if (event) {
      setEditingEvent(event);
      setFormData({ ...event, category_id: event.category_id || "" });
    } else {
      setEditingEvent(null);
      setFormData({
        title: "",
        description: "",
        category_id: "",
        location: "",
        venue: "",
        event_date: "",
        start_time: "",
        end_time: "",
        capacity: "",
        price: "",
        status: "upcoming",
        organizer_email: "",
        parking_info: "",
        map_link: ""
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const payload = { ...formData, created_by: currentUser.id };
      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, payload);
      } else {
        await api.post("/events", payload);
      }
      fetchEvents();
      setShowModal(false);
    } catch (err) {
      setError("Failed to save event");
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await api.delete(`/events/${id}`);
      fetchEvents();
    } catch (err) {
      setError("Failed to delete event");
      console.error(err);
    }
  };

  // ==============================
  // TICKET FORM HANDLERS
  // ==============================
  const openTicketForm = (event) => {
    setSelectedEventForTickets(event);
    setShowTicketForm(true);
    setTicketFormError("");
    setTicketFormData({
      name: "",
      description: "",
      price: "",
      quantity_available: "",
      is_early_bird: false,
      early_bird_deadline: "",
      is_group_discount: false,
      group_size: "",
      group_discount_percent: ""
    });
  };

  const handleSubmitTicketForm = async (e) => {
    e.preventDefault();
    setTicketFormError("");

    // Validation
    if (!ticketFormData.name.trim()) {
      setTicketFormError("Ticket name is required");
      return;
    }

    if (!ticketFormData.price || parseFloat(ticketFormData.price) < 0) {
      setTicketFormError("Valid price is required");
      return;
    }

    if (!ticketFormData.quantity_available || parseInt(ticketFormData.quantity_available) < 1) {
      setTicketFormError("Quantity must be at least 1");
      return;
    }

    // Early Bird validation
    if (ticketFormData.is_early_bird && !ticketFormData.early_bird_deadline) {
      setTicketFormError("Early bird deadline is required when enabled");
      return;
    }

    // Group Discount validation
    if (ticketFormData.is_group_discount) {
      if (!ticketFormData.group_size || parseInt(ticketFormData.group_size) < 2) {
        setTicketFormError("Group size must be at least 2");
        return;
      }

      if (!ticketFormData.group_discount_percent || parseFloat(ticketFormData.group_discount_percent) < 0 || parseFloat(ticketFormData.group_discount_percent) > 100) {
        setTicketFormError("Discount percent must be between 0-100");
        return;
      }
    }

    setTicketFormLoading(true);

    try {
      const token = localStorage.getItem("token");
      await api.post(
        `/events/${selectedEventForTickets.id}/ticket-types`,
        {
          name: ticketFormData.name.trim(),
          description: ticketFormData.description.trim() || null,
          price: parseFloat(ticketFormData.price),
          quantity_available: parseInt(ticketFormData.quantity_available),
          is_early_bird: ticketFormData.is_early_bird,
          early_bird_deadline: ticketFormData.early_bird_deadline || null,
          is_group_discount: ticketFormData.is_group_discount,
          group_size: ticketFormData.is_group_discount ? parseInt(ticketFormData.group_size) : null,
          group_discount_percent: ticketFormData.is_group_discount ? parseFloat(ticketFormData.group_discount_percent) : null
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      // Success - reset form
      setTicketFormData({
        name: "",
        description: "",
        price: "",
        quantity_available: "",
        is_early_bird: false,
        early_bird_deadline: "",
        is_group_discount: false,
        group_size: "",
        group_discount_percent: ""
      });

      setShowTicketForm(false);
      alert("✅ Ticket type created successfully!");
    } catch (err) {
      console.error("Error creating ticket type:", err);
      setTicketFormError(err.response?.data?.error || "Failed to create ticket type");
    } finally {
      setTicketFormLoading(false);
    }
  };

  // Category CRUD
  const handleCategoryAdd = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
      await api.post("/categories", { name: newCategory });
      setNewCategory("");
      setShowCategoryCard(false);
      fetchCategories();
    } catch (err) {
      setCategoryError("Failed to add category");
    }
  };

  const handleCategoryUpdate = async (id, name) => {
    try {
      await api.put(`/categories/${id}`, { name });
      fetchCategories();
      setEditingCategory(null);
    } catch (err) {
      setCategoryError("Failed to update category");
    }
  };

  const handleCategoryDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err) {
      setCategoryError("Failed to delete category");
    }
  };

  // Wait for currentUser to be defined before rendering
  if (currentUser === null) {
    return <p>Loading user...</p>;
  }

  return (
    <div className="events-container">
      <div className="events-header">
        <div>
          <h2>Manage Events</h2>
          <p className="subtitle">Create, edit, and manage your events</p>
        </div>
        <div className="header-actions">
          <button className="add-btn" onClick={() => openModal()}>+ Add Event</button>
          {currentUser?.role === "admin" && (
            <button
              className="add-btn secondary"
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
      </div>

      {/* Category Management Card */}
      {showCategoryCard && currentUser?.role === "admin" && (
        <div className="category-card">
          <h4>{editingCategory ? "Edit Category" : "Add New Category"}</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingCategory) {
                handleCategoryUpdate(editingCategory.id, editingCategory.name);
              } else {
                handleCategoryAdd(e);
              }
            }}
          >
            <input
              type="text"
              placeholder="Category name"
              value={editingCategory ? editingCategory.name : newCategory}
              onChange={(e) => {
                if (editingCategory) {
                  setEditingCategory({ ...editingCategory, name: e.target.value });
                } else {
                  setNewCategory(e.target.value);
                }
              }}
              required
            />
            <button type="submit">{editingCategory ? "Update" : "Add"}</button>
            <button type="button" onClick={() => setShowCategoryCard(false)}>Cancel</button>
          </form>

          <ul className="category-list">
            {categories.map((c) => (
              <li key={c.id}>
                {editingCategory && editingCategory.id === c.id ? (
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, name: e.target.value })
                    }
                  />
                ) : (
                  <>
                    <span>{c.name}</span>
                    <div>
                      <button onClick={() => setEditingCategory(c)}>Edit</button>
                      <button onClick={() => handleCategoryDelete(c.id)}>Delete</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          {categoryError && <p className="error">{categoryError}</p>}
        </div>
      )}

      {/* Error Message */}
      {error && <p className="error">{error}</p>}

      {/* Events Table */}
      {loading ? (
        <p className="loading">Loading events...</p>
      ) : events.length === 0 ? (
        <p className="no-data">No events found.</p>
      ) : (
        <div className="events-table-wrapper">
          <div className="events-table-scroll">
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
                {events.map((event) => (
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
                      <div className="action-buttons">
                        <button 
                          className="btn-sm view" 
                          onClick={() => openModal(event)}
                          title="Edit event"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-sm tickets" 
                          onClick={() => openTicketForm(event)}
                          title="Manage ticket types"
                        >
                          🎫
                        </button>
                        <button 
                          className="btn-sm delete" 
                          onClick={() => handleDelete(event.id)}
                          title="Delete event"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>{editingEvent ? "Edit Event" : "Add New Event"}</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-step">
                <div className="form-row">
                  <div className="form-group">
                    <label>Title *</label>
                    <input type="text" name="title" value={formData.title} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select name="category_id" value={formData.category_id} onChange={handleChange}>
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Event Date *</label>
                    <input type="date" name="event_date" value={formData.event_date} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Venue</label>
                    <input type="text" name="venue" value={formData.venue} onChange={handleChange} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Capacity</label>
                    <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Price (KES)</label>
                    <input type="number" name="price" value={formData.price} onChange={handleChange} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Organizer Email</label>
                    <input type="email" name="organizer_email" value={formData.organizer_email} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={formData.status} onChange={handleChange}>
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Parking Info</label>
                  <textarea name="parking_info" value={formData.parking_info} onChange={handleChange} />
                </div>

                <div className="form-group">
                  <label>Map Link</label>
                  <input type="url" name="map_link" value={formData.map_link} onChange={handleChange} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-primary">Save Event</button>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Form Modal */}
      {showTicketForm && selectedEventForTickets && (
        <div className="modal-overlay">
          <div className="modal small">
            <div className="modal-header">
              <h3>Add Ticket Type - {selectedEventForTickets.title}</h3>
            </div>

            {ticketFormError && (
              <div className="error-message" style={{
                background: "#fee2e2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "12px",
                margin: "16px",
                borderRadius: "8px",
                fontSize: "14px"
              }}>
                ⚠️ {ticketFormError}
              </div>
            )}

            <form onSubmit={handleSubmitTicketForm}>
              <div className="form-step">
                <div className="form-group">
                  <label>Ticket Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={ticketFormData.name}
                    onChange={handleTicketFormChange}
                    placeholder="e.g., VIP Pass, General Admission"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Price (KES) *</label>
                  <input
                    type="number"
                    name="price"
                    value={ticketFormData.price}
                    onChange={handleTicketFormChange}
                    placeholder="e.g., 2000"
                    min="0"
                    step="100"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={ticketFormData.description}
                    onChange={handleTicketFormChange}
                    placeholder="Optional description"
                    rows="2"
                  />
                </div>

                <div className="form-group">
                  <label>Quantity Available *</label>
                  <input
                    type="number"
                    name="quantity_available"
                    value={ticketFormData.quantity_available}
                    onChange={handleTicketFormChange}
                    placeholder="e.g., 200"
                    min="1"
                    required
                  />
                </div>

                {/* Checkboxes */}
                <div style={{ display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      name="is_early_bird"
                      checked={ticketFormData.is_early_bird}
                      onChange={handleTicketFormChange}
                    />
                    <span style={{ fontWeight: "600", fontSize: "14px" }}>Early Bird Pricing</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      name="is_group_discount"
                      checked={ticketFormData.is_group_discount}
                      onChange={handleTicketFormChange}
                    />
                    <span style={{ fontWeight: "600", fontSize: "14px" }}>Group Discount</span>
                  </label>
                </div>

                {/* Conditional: Early Bird Fields */}
                {ticketFormData.is_early_bird && (
                  <div style={{
                    background: "#fef3c7",
                    border: "2px solid #fcd34d",
                    padding: "16px",
                    borderRadius: "8px",
                    marginBottom: "16px"
                  }}>
                    <div className="form-group">
                      <label>Early Bird Deadline *</label>
                      <input
                        type="date"
                        name="early_bird_deadline"
                        value={ticketFormData.early_bird_deadline}
                        onChange={handleTicketFormChange}
                        required={ticketFormData.is_early_bird}
                      />
                      <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                        Last date when customers can purchase at early bird price
                      </small>
                    </div>
                  </div>
                )}

                {/* Conditional: Group Discount Fields */}
                {ticketFormData.is_group_discount && (
                  <div style={{
                    background: "#ede9fe",
                    border: "2px solid #d8b4fe",
                    padding: "16px",
                    borderRadius: "8px",
                    marginBottom: "16px"
                  }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Minimum Group Size *</label>
                        <input
                          type="number"
                          name="group_size"
                          value={ticketFormData.group_size}
                          onChange={handleTicketFormChange}
                          placeholder="e.g., 10"
                          min="2"
                          required={ticketFormData.is_group_discount}
                        />
                        <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                          Min tickets to qualify
                        </small>
                      </div>

                      <div className="form-group">
                        <label>Discount % *</label>
                        <input
                          type="number"
                          name="group_discount_percent"
                          value={ticketFormData.group_discount_percent}
                          onChange={handleTicketFormChange}
                          placeholder="e.g., 15"
                          min="0"
                          max="100"
                          step="5"
                          required={ticketFormData.is_group_discount}
                        />
                        <small style={{ color: "#666", marginTop: "4px", display: "block" }}>
                          Discount percentage
                        </small>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={ticketFormLoading}
                >
                  {ticketFormLoading ? "Creating..." : "Add Ticket Type"}
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setShowTicketForm(false)}
                  disabled={ticketFormLoading}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;