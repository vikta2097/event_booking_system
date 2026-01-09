import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import "../styles/Events.css";

const Events = ({ currentUser }) => {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({});
  const [formStep, setFormStep] = useState(1);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [ticketForm, setTicketForm] = useState({ 
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
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");

  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);

  const [showCategoryCard, setShowCategoryCard] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const [showTagsCard, setShowTagsCard] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);

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

  const fetchTicketTypes = useCallback(async (eventId) => {
    if (!eventId) return;
    try {
      setTicketLoading(true);
      setTicketError("");

      const res = await api.get(`/events/${eventId}/ticket-types`, { headers: getAuthHeaders() });
      const list = res.data?.ticket_types;

      setTicketTypes(Array.isArray(list) ? list : []);
      if (!Array.isArray(list)) setTicketError("Unexpected response from server.");
    } catch (err) {
      console.error("Failed to fetch ticket types:", err);
      setTicketTypes([]);
      setTicketError("Failed to load tickets.");
    } finally {
      setTicketLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const [categoriesData, tagsData] = await Promise.all([
          fetchCategories(),
          fetchTags()
        ]);

        setCategories(categoriesData);
        setTags(tagsData);

        const categoryMap = categoriesData.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
        const tagMap = tagsData.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});
        
        await fetchEvents(categoryMap, tagMap);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, fetchCategories, fetchTags, fetchEvents]);

  // Form handlers
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const handleTagSelection = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const openModal = (event = null) => {
    if (!currentUser) return;

    if (event) {
      setEditingEvent(event);
      setFormData({
        ...event,
        category_id: event.category_id || "",
        organizer_image: event.image || "",
      });
      setSelectedTags(event.tag_ids ? event.tag_ids.split(',').map(Number) : []);
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
        organizer_name: "",
        organizer_image: "",
        venue: "",
        organizer_email: "",
        parking_info: "",
        map_link: "",
        is_early_bird: false,
        early_bird_price: "",
        early_bird_deadline: ""
      });
      setSelectedTags([]);
      setTicketTypes([]);
    }
    setFormStep(1);
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
        image: formData.organizer_image || null,
        venue: formData.venue || null,
        organizer_email: formData.organizer_email || null,
        parking_info: formData.parking_info || null,
        map_link: formData.map_link || null,
        tag_ids: selectedTags.join(',') || null,
        early_bird_price: formData.is_early_bird ? Number(formData.early_bird_price) : null,
        early_bird_deadline: formData.is_early_bird ? formData.early_bird_deadline : null
      };

      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, payload, { headers: getAuthHeaders() });
      } else {
        await api.post("/events", payload, { headers: getAuthHeaders() });
      }

      const categoryMap = categories.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
      const tagMap = tags.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});
      await fetchEvents(categoryMap, tagMap);
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
      const categoryMap = categories.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
      const tagMap = tags.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});
      await fetchEvents(categoryMap, tagMap);
    } catch (err) {
      console.error(err);
      setError("Failed to delete event");
    }
  };

  const handleDuplicate = async (event) => {
    const duplicated = {
      ...event,
      title: `${event.title} (Copy)`,
      status: "upcoming"
    };
    delete duplicated.id;
    delete duplicated.created_at;
    
    openModal(duplicated);
  };

  // Bulk upload handler
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", bulkFile);

    try {
      setLoading(true);
      await api.post("/events/bulk-upload", formDataUpload, {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data"
        }
      });

      alert("Events uploaded successfully!");
      setShowBulkUpload(false);
      setBulkFile(null);
      
      const categoryMap = categories.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
      const tagMap = tags.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});
      await fetchEvents(categoryMap, tagMap);
    } catch (err) {
      console.error("Bulk upload error:", err);
      alert(err.response?.data?.error || "Bulk upload failed");
    } finally {
      setLoading(false);
    }
  };

  // Category handlers
  const handleCategoryAdd = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) return;

    try {
      await api.post("/categories", { name: newCategory }, { headers: getAuthHeaders() });
      setNewCategory("");
      setShowCategoryCard(false);
      const cats = await fetchCategories();
      setCategories(cats);
    } catch {
      setCategoryError("Failed to add category");
    }
  };

  const handleCategoryUpdate = async (id, name) => {
    if (!name.trim()) return;
    try {
      await api.put(`/categories/${id}`, { name }, { headers: getAuthHeaders() });
      setEditingCategory(null);
      const cats = await fetchCategories();
      setCategories(cats);
    } catch {
      setCategoryError("Failed to update category");
    }
  };

  const handleCategoryDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category?")) return;
    try {
      await api.delete(`/categories/${id}`, { headers: getAuthHeaders() });
      const cats = await fetchCategories();
      setCategories(cats);
    } catch {
      setCategoryError("Failed to delete category");
    }
  };

  // Tag handlers
  const handleTagAdd = async (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    try {
      await api.post("/tags", { name: newTag }, { headers: getAuthHeaders() });
      setNewTag("");
      const tagsData = await fetchTags();
      setTags(tagsData);
    } catch (err) {
      alert("Failed to add tag");
    }
  };

  const handleTagDelete = async (id) => {
    if (!window.confirm("Delete this tag?")) return;
    try {
      await api.delete(`/tags/${id}`, { headers: getAuthHeaders() });
      const tagsData = await fetchTags();
      setTags(tagsData);
    } catch (err) {
      alert("Failed to delete tag");
    }
  };

  // Ticket handlers
  const handleTicketChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTicketForm({ 
      ...ticketForm, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      const payload = {
        ...ticketForm,
        price: Number(ticketForm.price),
        quantity_available: Number(ticketForm.quantity_available),
        group_size: ticketForm.is_group_discount ? Number(ticketForm.group_size) : null,
        group_discount_percent: ticketForm.is_group_discount ? Number(ticketForm.group_discount_percent) : null,
        early_bird_deadline: ticketForm.is_early_bird ? ticketForm.early_bird_deadline : null
      };

      if (editingTicket) {
        await api.put(`/ticket-types/${editingTicket.id}`, payload, { headers: getAuthHeaders() });
      } else {
        await api.post(`/events/${editingEvent.id}/ticket-types`, payload, { headers: getAuthHeaders() });
      }

      await fetchTicketTypes(editingEvent.id);
      setTicketForm({ 
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
      setEditingTicket(null);
    } catch (err) {
      console.error("Ticket save failed", err);
    }
  };

  const handleTicketDelete = async (ticketId) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await api.delete(`/ticket-types/${ticketId}`, { headers: getAuthHeaders() });
      if (editingEvent) await fetchTicketTypes(editingEvent.id);
    } catch (err) {
      console.error("Ticket delete failed", err);
    }
  };

  // Filtered and searched events
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
          {currentUser?.role === "admin" && (
            <>
              <button className="add-btn secondary" onClick={() => setShowBulkUpload(true)}>
                📤 Bulk Upload
              </button>
              <button className="add-btn secondary" onClick={() => setShowCategoryCard(!showCategoryCard)}>
                🏷️ Categories
              </button>
              <button className="add-btn secondary" onClick={() => setShowTagsCard(!showTagsCard)}>
                🔖 Tags
              </button>
            </>
          )}
        </div>
      </div>

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

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="modal-overlay">
          <div className="modal small">
            <h3>Bulk Upload Events</h3>
            <form onSubmit={handleBulkUpload}>
              <div className="form-group">
                <label>Upload CSV/Excel File</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setBulkFile(e.target.files[0])}
                  required
                />
                <p className="help-text">
                  File should contain: title, description, category_id, location, event_date, start_time, end_time, capacity, price
                </p>
              </div>
              <div className="modal-actions">
                <button type="submit" disabled={!bulkFile}>Upload</button>
                <button type="button" onClick={() => setShowBulkUpload(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Card */}
      {showCategoryCard && currentUser?.role === "admin" && (
        <div className="category-card">
          <h4>Manage Categories</h4>
          <form onSubmit={handleCategoryAdd} className="inline-form">
            <input
              type="text"
              placeholder="New category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              required
            />
            <button type="submit">Add</button>
            <button type="button" onClick={() => setShowCategoryCard(false)}>Close</button>
          </form>
          <ul className="category-list">
            {categories.map((c) => (
              <li key={c.id}>
                {editingCategory && editingCategory.id === c.id ? (
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    onBlur={() => handleCategoryUpdate(c.id, editingCategory.name)}
                    autoFocus
                  />
                ) : (
                  <>
                    <span>{c.name}</span>
                    <div>
                      <button onClick={() => setEditingCategory(c)}>✏️</button>
                      <button onClick={() => handleCategoryDelete(c.id)}>🗑️</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          {categoryError && <p className="error">{categoryError}</p>}
        </div>
      )}

      {/* Tags Management Card */}
      {showTagsCard && currentUser?.role === "admin" && (
        <div className="category-card">
          <h4>Manage Tags</h4>
          <form onSubmit={handleTagAdd} className="inline-form">
            <input
              type="text"
              placeholder="New tag name"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              required
            />
            <button type="submit">Add</button>
            <button type="button" onClick={() => setShowTagsCard(false)}>Close</button>
          </form>
          <div className="tags-list">
            {tags.map((t) => (
              <span key={t.id} className="tag-item">
                {t.name}
                <button onClick={() => handleTagDelete(t.id)}>✕</button>
              </span>
            ))}
          </div>
        </div>
      )}

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
                      <button className="btn-sm tickets" onClick={() => {
                        setEditingEvent(event);
                        setShowTicketModal(true);
                        fetchTicketTypes(event.id);
                      }} title="Manage Tickets">
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


      {/* Event Modal - Multi-step form */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>{editingEvent ? "Edit Event" : "Create New Event"}</h3>
              <div className="form-steps">
                <span className={formStep === 1 ? "active" : ""}>1. Basic Info</span>
                <span className={formStep === 2 ? "active" : ""}>2. Details</span>
                <span className={formStep === 3 ? "active" : ""}>3. Additional</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Step 1: Basic Information */}
              {formStep === 1 && (
                <div className="form-step">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Event Title *</label>
                      <input type="text" name="title" value={formData.title || ""} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description *</label>
                    <textarea name="description" value={formData.description || ""} onChange={handleChange} rows={4} required />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Category</label>
                      <select name="category_id" value={formData.category_id || ""} onChange={handleChange}>
                        <option value="">Select Category</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Status</label>
                      <select name="status" value={formData.status || "upcoming"} onChange={handleChange}>
                        <option value="upcoming">Upcoming</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Tags (Select multiple)</label>
                    <div className="tags-selector">
                      {tags.map((tag) => (
                        <label key={tag.id} className="tag-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag.id)}
                            onChange={() => handleTagSelection(tag.id)}
                          />
                          {tag.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Date, Time, Location */}
              {formStep === 2 && (
                <div className="form-step">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Event Date *</label>
                      <input type="date" name="event_date" value={formData.event_date || ""} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label>Start Time *</label>
                      <input type="time" name="start_time" value={formData.start_time || ""} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label>End Time *</label>
                      <input type="time" name="end_time" value={formData.end_time || ""} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Location *</label>
                      <input type="text" name="location" value={formData.location || ""} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                      <label>Venue</label>
                      <input type="text" name="venue" value={formData.venue || ""} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Capacity</label>
                      <input type="number" name="capacity" value={formData.capacity || ""} onChange={handleChange} min="0" />
                    </div>
                    <div className="form-group">
                      <label>Base Price (KES)</label>
                      <input type="number" name="price" value={formData.price || ""} onChange={handleChange} min="0" step="0.01" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>
                      <input 
                        type="checkbox" 
                        name="is_early_bird" 
                        checked={formData.is_early_bird || false}
                        onChange={handleChange}
                      />
                      Enable Early Bird Pricing
                    </label>
                  </div>

                  {formData.is_early_bird && (
                    <div className="form-row">
                      <div className="form-group">
                        <label>Early Bird Price</label>
                        <input type="number" name="early_bird_price" value={formData.early_bird_price || ""} onChange={handleChange} min="0" step="0.01" />
                      </div>
                      <div className="form-group">
                        <label>Early Bird Deadline</label>
                        <input type="date" name="early_bird_deadline" value={formData.early_bird_deadline || ""} onChange={handleChange} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Additional Info */}
              {formStep === 3 && (
                <div className="form-step">
                  <div className="form-group">
                    <label>Organizer Name</label>
                    <input type="text" name="organizer_name" value={formData.organizer_name || ""} onChange={handleChange} />
                  </div>

                  <div className="form-group">
                    <label>Organizer Email</label>
                    <input type="email" name="organizer_email" value={formData.organizer_email || ""} onChange={handleChange} />
                  </div>

                  <div className="form-group">
                    <label>Event Poster/Image URL</label>
                    <input type="text" name="organizer_image" value={formData.organizer_image || ""} onChange={handleChange} />
                  </div>

                  <div className="form-group">
                    <label>Parking Information</label>
                    <input type="text" name="parking_info" value={formData.parking_info || ""} onChange={handleChange} />
                  </div>

                  <div className="form-group">
                    <label>Google Maps Embed Link</label>
                    <input type="url" name="map_link" value={formData.map_link || ""} onChange={handleChange} placeholder="https://maps.google.com/..." />
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="modal-actions">
                {formStep > 1 && (
                  <button type="button" className="btn-secondary" onClick={() => setFormStep(formStep - 1)}>
                    ← Previous
                  </button>
                )}
                {formStep < 3 ? (
                  <button type="button" className="btn-primary" onClick={() => setFormStep(formStep + 1)}>
                    Next →
                  </button>
                ) : (
                  <button type="submit" className="btn-primary">
                    {editingEvent ? "Save Changes" : "Create Event"}
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Management Modal */}
      {showTicketModal && editingEvent && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Manage Tickets: {editingEvent.title}</h3>

            {ticketLoading ? (
              <p>Loading tickets...</p>
            ) : ticketError ? (
              <p className="error">{ticketError}</p>
            ) : (
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Price</th>
                    <th>Available</th>
                    <th>Sold</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketTypes.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>
                        {ticket.name}
                        {ticket.is_early_bird && <span className="badge-sm early-bird">Early Bird</span>}
                      </td>
                      <td>{ticket.description || "-"}</td>
                      <td>KES {Number(ticket.price).toLocaleString()}</td>
                      <td>{ticket.quantity_available}</td>
                      <td>{ticket.quantity_sold || 0}</td>
                      <td>
                        <button
                          className="btn-sm"
                          onClick={() => {
                            setEditingTicket(ticket);
                            setTicketForm({
                              name: ticket.name,
                              description: ticket.description || "",
                              price: ticket.price,
                              quantity_available: ticket.quantity_available,
                              is_early_bird: ticket.is_early_bird || false,
                              early_bird_deadline: ticket.early_bird_deadline || "",
                              is_group_discount: ticket.is_group_discount || false,
                              group_size: ticket.group_size || "",
                              group_discount_percent: ticket.group_discount_percent || ""
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button className="btn-sm delete" onClick={() => handleTicketDelete(ticket.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ticketTypes.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center" }}>
                        No ticket types yet. Create one below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            <form onSubmit={handleTicketSubmit} className="ticket-form">
              <h4>{editingTicket ? "Edit Ticket Type" : "Add New Ticket Type"}</h4>

              <div className="form-row">
                <div className="form-group">
                  <label>Ticket Name *</label>
                  <input
                    type="text"
                    name="name"
                    placeholder="e.g., VIP, General Admission"
                    value={ticketForm.name}
                    onChange={handleTicketChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Price (KES) *</label>
                  <input
                    type="number"
                    name="price"
                    placeholder="0.00"
                    value={ticketForm.price}
                    onChange={handleTicketChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Optional ticket description"
                  value={ticketForm.description}
                  onChange={handleTicketChange}
                />
              </div>

              <div className="form-group">
                <label>Quantity Available *</label>
                <input
                  type="number"
                  name="quantity_available"
                  placeholder="Number of tickets"
                  value={ticketForm.quantity_available}
                  onChange={handleTicketChange}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="is_early_bird"
                    checked={ticketForm.is_early_bird}
                    onChange={handleTicketChange}
                  />
                  Early Bird Pricing
                </label>
              </div>

              {ticketForm.is_early_bird && (
                <div className="form-group">
                  <label>Early Bird Deadline</label>
                  <input
                    type="date"
                    name="early_bird_deadline"
                    value={ticketForm.early_bird_deadline}
                    onChange={handleTicketChange}
                  />
                </div>
              )}

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="is_group_discount"
                    checked={ticketForm.is_group_discount}
                    onChange={handleTicketChange}
                  />
                  Group Discount
                </label>
              </div>

              {ticketForm.is_group_discount && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Min Group Size</label>
                    <input
                      type="number"
                      name="group_size"
                      value={ticketForm.group_size}
                      onChange={handleTicketChange}
                      min="2"
                    />
                  </div>
                  <div className="form-group">
                    <label>Discount %</label>
                    <input
                      type="number"
                      name="group_discount_percent"
                      value={ticketForm.group_discount_percent}
                      onChange={handleTicketChange}
                      min="0"
                      max="100"
                    />
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="submit" className="btn-primary">
                  {editingTicket ? "Update Ticket" : "Add Ticket"}
                </button>
                {editingTicket && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditingTicket(null);
                      setTicketForm({
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
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowTicketModal(false);
                    setEditingTicket(null);
                    setTicketForm({
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
                  }}
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