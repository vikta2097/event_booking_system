import React, { useEffect, useState } from "react";
import api from "../api"; // centralized axios instance
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
    event_date: "",
    start_time: "",
    end_time: "",
    capacity: "",
    price: "",
    status: "upcoming",
  });

  const [showCategoryCard, setShowCategoryCard] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    fetchEvents();
    fetchCategories();
  }, [currentUser]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await api.get("/events", { headers: { Authorization: `Bearer ${token}` } });
      setEvents(res.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get("/categories", { headers: { Authorization: `Bearer ${token}` } });
      setCategories(res.data || []);
    } catch (err) {
      console.error("Failed to fetch categories");
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

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
        event_date: "",
        start_time: "",
        end_time: "",
        capacity: "",
        price: "",
        status: "upcoming",
      });
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

  // Category CRUD
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
      fetchCategories();
      setEditingCategory(null);
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

          <ul>
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
      ) : events.length === 0 ? (
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
                  <button className="edit-btn" onClick={() => openModal(event)}>Edit</button>
                  <button className="delete-btn" onClick={() => handleDelete(event.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
    </div>
  );
};

export default Events;
