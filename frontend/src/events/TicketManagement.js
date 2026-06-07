import React, { useState, useEffect, useCallback } from "react";
import api from "../api";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  quantity_available: "",
  is_early_bird: false,
  early_bird_deadline: "",
  is_group_discount: false,
  group_size: "",
  group_discount_percent: "",
};

const TicketManagement = ({ event, isOpen, onClose, embedded = false }) => {
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [ticketForm, setTicketForm] = useState(EMPTY_FORM);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  const fetchTicketTypes = useCallback(async () => {
    if (!event?.id) return;
    try {
      setTicketLoading(true);
      setTicketError("");
      const res = await api.get(`/events/${event.id}/ticket-types`, {
        headers: getAuthHeaders(),
      });
      const list = res.data?.ticket_types;
      setTicketTypes(Array.isArray(list) ? list : []);
      if (!Array.isArray(list)) setTicketError("Unexpected response from server.");
    } catch (err) {
      console.error("Failed to fetch ticket types:", err);
      setTicketTypes([]);
      setTicketError("Failed to load tickets. Please try again.");
    } finally {
      setTicketLoading(false);
    }
  }, [event]);

  useEffect(() => {
    if (isOpen && event) fetchTicketTypes();
  }, [isOpen, event, fetchTicketTypes]);

  const handleTicketChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTicketForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Safe numeric helpers — returns null instead of NaN when value is empty
  const toFloat = (v) => (v !== "" && v !== undefined ? parseFloat(v) : null);
  const toInt   = (v) => (v !== "" && v !== undefined ? parseInt(v, 10) : null);

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    if (!event) return;

    // --- Client-side validation ---
    const price = toFloat(ticketForm.price);
    const qty   = toInt(ticketForm.quantity_available);

    if (!ticketForm.name.trim()) {
      setTicketError("Ticket name is required.");
      return;
    }
    if (price === null || isNaN(price) || price < 0) {
      setTicketError("A valid price (≥ 0) is required.");
      return;
    }
    if (qty === null || isNaN(qty) || qty < 1) {
      setTicketError("Quantity must be at least 1.");
      return;
    }
    if (ticketForm.is_early_bird && !ticketForm.early_bird_deadline) {
      setTicketError("Early bird deadline is required when early bird is enabled.");
      return;
    }
    if (ticketForm.is_group_discount) {
      const gs = toInt(ticketForm.group_size);
      const gd = toFloat(ticketForm.group_discount_percent);
      if (!gs || gs < 2) {
        setTicketError("Group size must be at least 2.");
        return;
      }
      if (gd === null || isNaN(gd) || gd < 0 || gd > 100) {
        setTicketError("Discount percent must be between 0 and 100.");
        return;
      }
    }

    setTicketError("");
    setSubmitting(true);

    try {
      const payload = {
        name: ticketForm.name.trim(),
        description: ticketForm.description.trim() || null,
        price,
        quantity_available: qty,
        is_early_bird: ticketForm.is_early_bird,
        early_bird_deadline: ticketForm.is_early_bird
          ? ticketForm.early_bird_deadline
          : null,
        is_group_discount: ticketForm.is_group_discount,
        group_size: ticketForm.is_group_discount
          ? toInt(ticketForm.group_size)
          : null,
        group_discount_percent: ticketForm.is_group_discount
          ? toFloat(ticketForm.group_discount_percent)
          : null,
      };

      if (editingTicket) {
        await api.put(`/ticket-types/${editingTicket.id}`, payload, {
          headers: getAuthHeaders(),
        });
        showSuccess("Ticket type updated successfully.");
      } else {
        await api.post(`/events/${event.id}/ticket-types`, payload, {
          headers: getAuthHeaders(),
        });
        showSuccess("Ticket type created successfully.");
      }

      await fetchTicketTypes();
      resetForm();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to save ticket type. Please try again.";
      setTicketError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTicketDelete = async (ticketId, ticketName) => {
    if (!window.confirm(`Delete "${ticketName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/ticket-types/${ticketId}`, {
        headers: getAuthHeaders(),
      });
      showSuccess("Ticket type deleted.");
      await fetchTicketTypes();
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        "Failed to delete ticket type. It may have existing bookings.";
      setTicketError(msg);
    }
  };

  const resetForm = () => {
    setEditingTicket(null);
    setTicketForm(EMPTY_FORM);
    setTicketError("");
  };

  const handleEdit = (ticket) => {
    setEditingTicket(ticket);
    setTicketError("");
    setTicketForm({
      name: ticket.name || "",
      description: ticket.description || "",
      price: ticket.price ?? "",
      quantity_available: ticket.quantity_available ?? "",
      is_early_bird: ticket.is_early_bird || false,
      early_bird_deadline: ticket.early_bird_deadline
        ? ticket.early_bird_deadline.slice(0, 10)
        : "",
      is_group_discount: ticket.is_group_discount || false,
      group_size: ticket.group_size ?? "",
      group_discount_percent: ticket.group_discount_percent ?? "",
    });
    // Scroll form into view
    setTimeout(() => {
      document
        .getElementById("ticket-form-anchor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  if (!isOpen) return null;

  const innerContent = (
    <div style={embedded ? { padding: "0 0 24px" } : { padding: "0 24px 24px", overflowY: "auto", maxHeight: "calc(90vh - 80px)" }}>

          {/* Feedback banners */}
          {ticketError && (
            <div className="error" style={{ marginTop: 16 }}>
              {ticketError}
            </div>
          )}
          {successMsg && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "#d1fae5",
                color: "#065f46",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              ✅ {successMsg}
            </div>
          )}

          {/* Ticket types table */}
          {ticketLoading ? (
            <p className="loading" style={{ marginTop: 24 }}>Loading tickets…</p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 20 }}>
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Price (KES)</th>
                    <th>Available</th>
                    <th>Sold</th>
                    <th>Remaining</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketTypes.map((ticket) => {
                    const remaining = parseInt(ticket.remaining ?? (ticket.quantity_available - ticket.quantity_sold));
                    const isSoldOut = remaining <= 0;
                    const isLow    = remaining > 0 && remaining <= 10;
                    return (
                      <tr key={ticket.id}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{ticket.name}</span>
                          {ticket.is_early_bird && (
                            <span className="badge-sm early-bird">Early Bird</span>
                          )}
                          {ticket.is_group_discount && (
                            <span className="badge-sm group-discount">Group</span>
                          )}
                          {isSoldOut && (
                            <span className="badge-sm" style={{ background: "#fee2e2", color: "#991b1b", marginLeft: 6 }}>
                              Sold Out
                            </span>
                          )}
                          {isLow && !isSoldOut && (
                            <span className="badge-sm" style={{ background: "#fef3c7", color: "#92400e", marginLeft: 6 }}>
                              Low Stock
                            </span>
                          )}
                        </td>
                        <td style={{ color: "#6b7280", fontSize: 13 }}>
                          {ticket.description || "—"}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {Number(ticket.price).toLocaleString()}
                        </td>
                        <td>{ticket.quantity_available}</td>
                        <td>{ticket.quantity_sold || 0}</td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isSoldOut ? "#991b1b" : isLow ? "#92400e" : "#065f46",
                            }}
                          >
                            {remaining}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-sm view"
                              onClick={() => handleEdit(ticket)}
                              disabled={submitting}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn-sm delete"
                              onClick={() => handleTicketDelete(ticket.id, ticket.name)}
                              disabled={submitting}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {ticketTypes.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ textAlign: "center", padding: "2.5rem", color: "#9ca3af", fontStyle: "italic" }}
                      >
                        No ticket types yet. Create one below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Form */}
          <div id="ticket-form-anchor" />
          <form onSubmit={handleTicketSubmit} className="ticket-form" noValidate>
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

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Description</label>
              <input
                type="text"
                name="description"
                placeholder="Optional ticket description"
                value={ticketForm.description}
                onChange={handleTicketChange}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
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
              {editingTicket && (
                <span className="help-text">
                  Cannot reduce below the number already sold ({editingTicket.quantity_sold || 0}).
                </span>
              )}
            </div>

            {/* Early bird */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="is_early_bird"
                  checked={ticketForm.is_early_bird}
                  onChange={handleTicketChange}
                />
                &nbsp;Early Bird Pricing
              </label>
            </div>

            {ticketForm.is_early_bird && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Early Bird Deadline *</label>
                <input
                  type="date"
                  name="early_bird_deadline"
                  value={ticketForm.early_bird_deadline}
                  onChange={handleTicketChange}
                  required
                />
              </div>
            )}

            {/* Group discount */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ flexDirection: "row", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="is_group_discount"
                  checked={ticketForm.is_group_discount}
                  onChange={handleTicketChange}
                />
                &nbsp;Group Discount
              </label>
            </div>

            {ticketForm.is_group_discount && (
              <div className="form-row">
                <div className="form-group">
                  <label>Min Group Size *</label>
                  <input
                    type="number"
                    name="group_size"
                    value={ticketForm.group_size}
                    onChange={handleTicketChange}
                    min="2"
                    placeholder="e.g., 5"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Discount % *</label>
                  <input
                    type="number"
                    name="group_discount_percent"
                    value={ticketForm.group_discount_percent}
                    onChange={handleTicketChange}
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="e.g., 10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting
                  ? "Saving…"
                  : editingTicket
                  ? "Update Ticket"
                  : "Add Ticket"}
              </button>
              {editingTicket && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Close
              </button>
            </div>
          </form>
        </div>
  );

  if (embedded) {
    return innerContent;
  }

  return (
    <div className="modal-overlay">
      <div className="modal large" style={{ width: "90vw", maxWidth: 860, padding: 0 }}>
        <div className="modal-header">
          <h3>🎫 Manage Tickets: {event.title}</h3>
        </div>
        {innerContent}
      </div>
    </div>
  );
};

export default TicketManagement;