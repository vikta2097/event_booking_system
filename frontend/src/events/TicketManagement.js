import React, { useState, useEffect } from "react";
import api from "../api";

const TicketManagement = ({ event, isOpen, onClose }) => {
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");
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

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchTicketTypes = async () => {
    if (!event?.id) return;
    try {
      setTicketLoading(true);
      setTicketError("");

      const res = await api.get(`/events/${event.id}/ticket-types`, { headers: getAuthHeaders() });
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
  };

  useEffect(() => {
    if (isOpen && event) {
      fetchTicketTypes();
    }
  }, [isOpen, event]);

  const handleTicketChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTicketForm({
      ...ticketForm,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!event) return;

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
        await api.post(`/events/${event.id}/ticket-types`, payload, { headers: getAuthHeaders() });
      }

      await fetchTicketTypes();
      resetForm();
    } catch (err) {
      console.error("Ticket save failed", err);
      setTicketError("Failed to save ticket");
    }
  };

  const handleTicketDelete = async (ticketId) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await api.delete(`/ticket-types/${ticketId}`, { headers: getAuthHeaders() });
      await fetchTicketTypes();
    } catch (err) {
      console.error("Ticket delete failed", err);
      setTicketError("Failed to delete ticket");
    }
  };

  const resetForm = () => {
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
  };

  const handleEdit = (ticket) => {
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
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>🎫 Manage Tickets: {event.title}</h3>

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
                    {ticket.is_group_discount && <span className="badge-sm group-discount">Group Discount</span>}
                  </td>
                  <td>{ticket.description || "-"}</td>
                  <td>KES {Number(ticket.price).toLocaleString()}</td>
                  <td>{ticket.quantity_available}</td>
                  <td>{ticket.quantity_sold || 0}</td>
                  <td>
                    <button className="btn-sm" onClick={() => handleEdit(ticket)}>
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
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#999" }}>
                    No ticket types yet. Create one below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <form onSubmit={handleTicketSubmit} className="ticket-form">
          <h4>{editingTicket ? "✏️ Edit Ticket Type" : "➕ Add New Ticket Type"}</h4>

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
                  placeholder="e.g., 5"
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
                  placeholder="e.g., 10"
                />
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="submit" className="btn-primary">
              {editingTicket ? "Update Ticket" : "Add Ticket"}
            </button>
            {editingTicket && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TicketManagement;