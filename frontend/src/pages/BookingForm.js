/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/BookingForm.css";

const BookingForm = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Fetch event and ticket types
  const fetchEventAndTickets = useCallback(async () => {
    try {
      setStatusMessage("Loading event details...");

      const [eventRes, ticketsRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/ticket-types`)
      ]);

      setEvent(eventRes.data);

      const ticketArray = ticketsRes.data.ticket_types || ticketsRes.data || [];
      const normalizedTickets = ticketArray.map(ticket => {
        const quantity_available = parseInt(ticket.quantity_available || 0);
        const quantity_sold = parseInt(ticket.quantity_sold || 0);
        const tickets_remaining = Math.max(0, quantity_available - quantity_sold);

        return {
          id: ticket.id,
          name: ticket.name,
          price: parseFloat(ticket.price || 0),
          quantity_available,
          quantity_sold,
          tickets_remaining,
          description: ticket.description || "",
          // group discount
          is_group_discount: ticket.is_group_discount || false,
          group_size: parseInt(ticket.group_size || 0),
          group_discount_percent: parseFloat(ticket.group_discount_percent || 0),
          // early bird
          is_early_bird: ticket.is_early_bird || false,
          early_bird_deadline: ticket.early_bird_deadline || null,
          early_bird_active: ticket.early_bird_active || false,
        };
      });

      setTickets(normalizedTickets);

      // Initialize selection
      const initialSelection = {};
      normalizedTickets.forEach(t => { initialSelection[t.id] = 0; });
      setSelectedTickets(initialSelection);

      setStatusMessage("");
      setError("");

      console.log('📋 Loaded tickets:', normalizedTickets);

    } catch (err) {
      console.error("Error loading event:", err);
      if (err.code === 'ERR_NETWORK') {
        setError("Cannot connect to server. The server may be sleeping (Render.com free tier). Please wait and try again.");
      } else {
        setError(err.response?.data?.error || "Failed to load event or tickets");
      }
    }
  }, [id]);

  useEffect(() => { 
    fetchEventAndTickets(); 
  }, [fetchEventAndTickets]);

  useEffect(() => {
    if (user?.phone) setPhoneNumber(user.phone);
  }, [user]);

  const handleQuantityChange = (ticketId, qty) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const available = ticket.tickets_remaining;
    const quantity = Math.max(0, Math.min(qty, available));

    setSelectedTickets(prev => ({ ...prev, [ticketId]: quantity }));
  };

  // ── Per-ticket effective price (applies group discount when qty meets threshold) ──
  const getEffectivePrice = (ticket, qty) => {
    if (
      ticket.is_group_discount &&
      ticket.group_size > 0 &&
      ticket.group_discount_percent > 0 &&
      qty >= ticket.group_size
    ) {
      return ticket.price * (1 - ticket.group_discount_percent / 100);
    }
    return ticket.price;
  };

  const lineItems = tickets.map(t => {
    const qty = selectedTickets[t.id] || 0;
    const effectivePrice = getEffectivePrice(t, qty);
    const originalSubtotal = t.price * qty;
    const discountedSubtotal = effectivePrice * qty;
    const saving = originalSubtotal - discountedSubtotal;
    const groupDiscountActive =
      t.is_group_discount && t.group_size > 0 && qty >= t.group_size;
    return { ticket: t, qty, effectivePrice, originalSubtotal, discountedSubtotal, saving, groupDiscountActive };
  }).filter(li => li.qty > 0);

  const totalAmount = lineItems.reduce((sum, li) => sum + li.discountedSubtotal, 0);
  const totalSavings = lineItems.reduce((sum, li) => sum + li.saving, 0);
  const totalTickets = lineItems.reduce((sum, li) => sum + li.qty, 0);

  const handleBooking = async (e) => {
  e.preventDefault();

  if (!user) {
    setError("Please log in to complete booking");
    navigate("/dashboard/login");
    return;
  }

  if (!phoneNumber.trim()) {
    setError("Phone number is required for M-Pesa payment");
    return;
  }

  // eslint-disable-next-line no-useless-escape
  const phoneRegex = /^(?:\+254|254|0)7\d{8}$/;

  // eslint-disable-next-line no-useless-escape
  const cleanPhone = phoneNumber.replace(/[\s\-()]/g, "");

  if (!phoneRegex.test(cleanPhone)) {
    setError("Please enter a valid Kenyan mobile number (e.g., 0712345678)");
    return;
    }

    if (totalTickets === 0) {
      setError("Please select at least one ticket");
      return;
    }

    setLoading(true);
    setError("");
    setStatusMessage("Connecting to server...");

    try {
      try {
        await api.get('/events', { timeout: 5000 });
        setStatusMessage("Creating your booking...");
      } catch (wakeError) {
        setStatusMessage("Server is waking up (this may take 30 seconds)..."); 
        await new Promise(resolve => setTimeout(resolve, 3000));
        setStatusMessage("Creating your booking...");
      }

      const payload = tickets
        .filter(t => selectedTickets[t.id] > 0)
        .map(t => ({
          ticket_type_id: t.id,
          quantity: selectedTickets[t.id]
        }));

      console.log('📤 Sending booking request:', { event_id: id, tickets: payload });

      const res = await api.post("/bookings", {
        event_id: id,
        tickets: payload
      });

      console.log('✅ Booking response:', res.data);

      if (!res.data.booking_id) {
        throw new Error('Invalid response: No booking_id received');
      }

      sessionStorage.setItem('activeBooking', res.data.booking_id);
      navigate(`/dashboard/payment/${res.data.booking_id}`);

    } catch (err) {
      console.error('❌ Booking error:', err);
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError("Cannot connect to server. The server may be sleeping. Please wait 30 seconds and try again.");
      } else if (err.response?.status === 400) {
        setError(err.response.data.error || "Invalid booking data. Please check your selections.");
      } else if (err.response?.status === 404) {
        setError("Event not found. It may have been deleted.");
      } else if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setError(err.response?.data?.error || err.message || "Booking failed. Please try again.");
      }
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  if (!event && !error) return <div className="booking-form"><p className="loading-text">{statusMessage || "Loading booking details..."}</p></div>;
  if (error && !event) return (
    <div className="booking-form">
      <div className="error-container">
        <p className="error">{error}</p>
        <button onClick={fetchEventAndTickets} className="retry-btn">🔄 Retry Loading</button>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">← Back to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="booking-form">
      <h2>Book Tickets for {event?.title}</h2>
      {event?.event_date && (
        <p className="event-date">
          {new Date(event.event_date).toLocaleDateString("en-GB", {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
          })}
        </p>
      )}
      <p className="event-location">📍 {event?.location || "Location not specified"}</p>

      <div className="ticket-types">
        <h3>Select Tickets</h3>

        {tickets.length === 0 && (
          <p className="no-tickets">No tickets available for this event.</p>
        )}

        {tickets.map(ticket => {
          const available = ticket.tickets_remaining;
          const isAvailable = available > 0;
          const qty = selectedTickets[ticket.id] || 0;
          const groupDiscountActive =
            ticket.is_group_discount &&
            ticket.group_size > 0 &&
            qty >= ticket.group_size;
          const effectivePrice = getEffectivePrice(ticket, qty);
          const discountPct = ticket.group_discount_percent;
          const nearGroupThreshold =
            ticket.is_group_discount &&
            ticket.group_size > 0 &&
            qty > 0 &&
            qty < ticket.group_size;

          return (
            <div
              key={ticket.id}
              className={`ticket-item${!isAvailable ? ' sold-out' : ''}${groupDiscountActive ? ' group-active' : ''}`}
            >
              {/* ── Header row ── */}
              <div className="ticket-info">
                <div className="ticket-name-wrap">
                  <span className="ticket-name">{ticket.name}</span>
                  {ticket.is_group_discount && ticket.group_size > 0 && (
                    <span className="badge-group-tip">
                      👥 {ticket.group_discount_percent}% off for {ticket.group_size}+
                    </span>
                  )}
                  {ticket.early_bird_active && (
                    <span className="badge-early-bird">🐦 Early Bird</span>
                  )}
                </div>

                <div className="ticket-price-wrap">
                  {groupDiscountActive ? (
                    <>
                      <span className="ticket-price-original">
                        KES {ticket.price.toLocaleString()}
                      </span>
                      <span className="ticket-price ticket-price--discounted">
                        KES {effectivePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                      <span className="discount-chip">−{discountPct}%</span>
                    </>
                  ) : (
                    <span className="ticket-price">
                      KES {ticket.price.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {ticket.description && (
                <p className="ticket-description">{ticket.description}</p>
              )}

              <div className="ticket-availability">
                {isAvailable
                  ? <small className="available">✓ {available} available</small>
                  : <small className="sold-out-label">✗ Sold Out</small>}
              </div>

              {/* ── Quantity controls — only for admin/organizer-defined tiers ── */}
              {isAvailable && (
                <>
                  <div className="ticket-controls">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(ticket.id, qty - 1)}
                      disabled={qty === 0}
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      max={available}
                      value={qty}
                      onChange={e =>
                        handleQuantityChange(ticket.id, parseInt(e.target.value) || 0)
                      }
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(ticket.id, qty + 1)}
                      disabled={qty >= available}
                    >+</button>
                  </div>

                  {/* nudge toward group discount threshold */}
                  {nearGroupThreshold && (
                    <p className="group-nudge">
                      ➕ Add {ticket.group_size - qty} more to unlock {discountPct}% group discount
                    </p>
                  )}

                  {groupDiscountActive && (
                    <p className="group-discount-applied">
                      ✅ Group discount applied — you save KES {((ticket.price - effectivePrice) * qty).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  )}

                  {qty > 0 && (
                    <div className="ticket-subtotal">
                      Subtotal:{" "}
                      {groupDiscountActive && (
                        <s style={{ color: "#9ca3af", marginRight: "6px" }}>
                          KES {(ticket.price * qty).toLocaleString()}
                        </s>
                      )}
                      <strong>
                        KES {(effectivePrice * qty).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </strong>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleBooking} className="booking-checkout">
        <div className="form-group">
          <label htmlFor="phone">M-Pesa Phone Number *</label>
          <input
            id="phone"
            type="tel"
            placeholder="0712345678 or 254712345678"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            required
            disabled={loading}
          />
          <small className="form-hint">Enter the phone number to receive M-Pesa payment prompt</small>
        </div>

        <div className="booking-summary">
          <div className="summary-row">
            <span>Total Tickets:</span>
            <strong>{totalTickets}</strong>
          </div>

          {/* Show savings row only when at least one group discount is active */}
          {totalSavings > 0 && (
            <div className="summary-row savings-row">
              <span>🎉 Group Discount Savings:</span>
              <strong style={{ color: "#10b981" }}>
                − KES {totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </strong>
            </div>
          )}

          <div className="summary-row total">
            <span>Total Amount:</span>
            <strong>KES {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
          </div>
        </div>

        {statusMessage && (
          <div className="status-message"><span>ℹ️ {statusMessage}</span></div>
        )}
        {error && (
          <div className="error-message"><span>⚠️ {error}</span></div>
        )}

        <button
          type="submit"
          disabled={loading || totalTickets === 0}
          className="btn-proceed"
        >
          {loading
            ? <><span className="spinner-small"></span> Processing...</>
            : "Proceed to Payment →"}
        </button>

        {totalTickets === 0 && (
          <p className="hint-text">Please select at least one ticket to continue</p>
        )}
      </form>
    </div>
  );
};

export default BookingForm;