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
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");

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
  // FETCH FUNCTIONS
  // =======================
  const fetchEvents = useCallback(async (categoryMap) => {
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

  // =======================
  // INITIAL LOAD
  // =======================
  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      try {
        setLoading(true);

        const categoriesData = await fetchCategories();
        setCategories(categoriesData);

        const categoryMap = categoriesData.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
        await fetchEvents(categoryMap);
      } catch (err) {
        console.error("Error loading data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, fetchCategories, fetchEvents]);

  // =======================
  // FORM & MODAL HANDLERS
  // =======================
  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const openModal = (event = null) => {
    if (!currentUser) return;

    if (event) {
      setEditingEvent(event);
      setFormData({
        ...event,
        category_id: event.category_id || "",
        organizer_image: event.image || "",
      });
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
        image: formData.organizer_image || null,
        venue: formData.venue || null,
        organizer_email: formData.organizer_email || null,
        parking_info: formData.parking_info || null,
        map_link: formData.map_link || null,
      };

      if (editingEvent) {
        await api.put(`/events/${editingEvent.id}`, payload, { headers: getAuthHeaders() });
      } else {
        await api.post("/events", payload, { headers: getAuthHeaders() });
      }

      const categoryMap = categories.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
      await fetchEvents(categoryMap);
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
      await fetchEvents(categoryMap);
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

  // =======================
  // TICKET HANDLERS
  // =======================
  const handleTicketChange = (e) => {
    const { name, value } = e.target;
    setTicketForm({ ...ticketForm, [name]: value });
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!editingEvent) return;

    try {
      const payload = {
        ...ticketForm,
        price: Number(ticketForm.price),
        quantity_available: Number(ticketForm.quantity_available),
      };

      if (editingTicket) {
        await api.put(`/ticket-types/${editingTicket.id}`, payload, { headers: getAuthHeaders() });
      } else {
        await api.post(`/events/${editingEvent.id}/ticket-types`, payload, { headers: getAuthHeaders() });
      }

      await fetchTicketTypes(editingEvent.id);
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
      if (editingEvent) await fetchTicketTypes(editingEvent.id);
    } catch (err) {
      console.error("Ticket delete failed", err);
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
              <th>Poster</th>
              <th>Title</th>
              <th>Category</th>
              <th>Organizer</th>
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
                <td>
                  {event.organizer_image ? (
                    <img src={event.organizer_image} alt={event.organizer_name} className="event-poster" />
                  ) : "-"}
                </td>
                <td title={`Venue: ${event.venue || "-"}\nEmail: ${event.organizer_email || "-"}\nParking: ${event.parking_info || "-"}\nMap: ${event.map_link || "-"}`}>
                  {event.title}
                </td>
                <td>{event.category_name || "-"}</td>
                <td>{event.organizer_name || "-"}</td>
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
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <label>Organizer Name (Optional)</label>
              <input type="text" name="organizer_name" value={formData.organizer_name || ""} onChange={handleChange} />

              <label>Organizer Poster/Image URL (Optional)</label>
              <input type="text" name="organizer_image" value={formData.organizer_image || ""} onChange={handleChange} />

              <label>Venue (Optional)</label>
              <input type="text" name="venue" value={formData.venue || ""} onChange={handleChange} />

              <label>Organizer Email (Optional)</label>
              <input type="email" name="organizer_email" value={formData.organizer_email || ""} onChange={handleChange} />

              <label>Parking Info (Optional)</label>
              <input type="text" name="parking_info" value={formData.parking_info || ""} onChange={handleChange} />

              <label>Map Link (Optional)</label>
              <input type="url" name="map_link" value={formData.map_link || ""} onChange={handleChange} />

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

              <label>Capacity</label>
              <input type="number" name="capacity" value={formData.capacity} onChange={handleChange} />

              <label>Price (KES)</label>
              <input type="number" name="price" value={formData.price} onChange={handleChange} />

              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <div className="modal-actions">
                <button type="submit">{editingEvent ? "Save Changes" : "Add Event"}</button>
                <button type="button" onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {showTicketModal && editingEvent && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Manage Tickets for: {editingEvent.title}</h3>

            {ticketLoading ? <p>Loading tickets...</p> :
              ticketError ? <p className="error">{ticketError}</p> :
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
                    {ticketTypes.map(ticket => (
                      <tr key={ticket.id}>
                        <td>{ticket.name}</td>
                        <td>{ticket.description}</td>
                        <td>{ticket.price}</td>
                        <td>{ticket.quantity_available}</td>
                        <td>
                          <button onClick={() => {
                            setEditingTicket(ticket);
                            setTicketForm({
                              name: ticket.name,
                              description: ticket.description,
                              price: ticket.price,
                              quantity_available: ticket.quantity_available
                            });
                          }}>Edit</button>
                          <button onClick={() => handleTicketDelete(ticket.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }

            <form onSubmit={handleTicketSubmit} className="ticket-form">
              <h4>{editingTicket ? "Edit Ticket" : "Add Ticket"}</h4>
              <input type="text" name="name" placeholder="Name" value={ticketForm.name} onChange={handleTicketChange} required />
              <input type="text" name="description" placeholder="Description" value={ticketForm.description} onChange={handleTicketChange} />
              <input type="number" name="price" placeholder="Price" value={ticketForm.price} onChange={handleTicketChange} />
              <input type="number" name="quantity_available" placeholder="Quantity Available" value={ticketForm.quantity_available} onChange={handleTicketChange} />
              <div className="modal-actions">
                <button type="submit">{editingTicket ? "Update" : "Add"}</button>
                <button type="button" onClick={() => {
                  setShowTicketModal(false);
                  setEditingTicket(null);
                  setTicketForm({ name: "", description: "", price: "", quantity_available: "" });
                }}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Events;
