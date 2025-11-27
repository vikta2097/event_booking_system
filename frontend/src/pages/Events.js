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
  const [ticketError, setTicketError] = useState("");

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

      // Map category names
      const categoryMap = categories.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});

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

        return { ...ev, status, category_name: categoryMap[ev.category_id] || "-" };
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
      const payload = {
        ...formData,
        price: Number(formData.price),
        capacity: Number(formData.capacity),
        created_by: currentUser.id,
      };

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
      const payload = {
        ...ticketForm,
        price: Number(ticketForm.price),
        quantity_available: Number(ticketForm.quantity_available),
      };

      if (editingTicket) {
        await api.put(`/ticket-types/${editingTicket.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await api.post(`/events/${editingEvent.id}/ticket-types`, payload, { headers: { Authorization: `Bearer ${token}` } });
      }

      setTicketForm({ name: "", description: "", price: "", quantity_available: "" });
      setEditingTicket(null);
      fetchTicketTypes(editingEvent.id);
      setTicketError("");
    } catch (err) {
      console.error("Failed to save ticket type", err);
      setTicketError("Failed to save ticket type");
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
      setTicketError("Failed to delete ticket type");
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
      {/* header, filters, category card, table, modals */}
      {/* The rendering remains mostly unchanged, with ticketError shown inside Ticket Modal */}
      {/* ...same as your current JSX, just add <p className="error">{ticketError}</p> in Ticket Modal*/}
    </div>
  );
};

export default Events;
