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
      
      // Handle different response structures
      const ticketArray = ticketsRes.data.ticket_types || ticketsRes.data || [];
      setTickets(ticketArray);

      // Initialize ticket selection
      const initialSelection = {};
      ticketArray.forEach(t => { initialSelection[t.id] = 0; });
      setSelectedTickets(initialSelection);
      
      setStatusMessage(""); // Clear loading message
      setError(""); // Clear any previous errors

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

  // Update phone number when user prop changes
  useEffect(() => {
    if (user?.phone) {
      setPhoneNumber(user.phone);
    }
  }, [user]);

  const handleQuantityChange = (ticketId, qty) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;
    
    const available = ticket.quantity_available - ticket.quantity_sold;
    const quantity = Math.max(0, Math.min(qty, available));
    
    setSelectedTickets(prev => ({ ...prev, [ticketId]: quantity }));
  };

  const totalAmount = tickets.reduce(
    (sum, t) => sum + (t.price * (selectedTickets[t.id] || 0)), 0
  );
  
  const totalTickets = Object.values(selectedTickets).reduce((sum, q) => sum + q, 0);

  const handleBooking = async (e) => {
    e.preventDefault();
    
    // Validation checks
    if (!user) {
      setError("Please log in to complete booking");
      navigate("/login");
      return;
    }

    if (!phoneNumber.trim()) {
      setError("Phone number is required for M-Pesa payment");
      return;
    }

    // Validate Kenyan phone number
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Kenyan phone number (e.g., 0712345678)");
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
      // Wake up backend first with a simple request
      try {
        await api.get('/events', { timeout: 5000 });
        setStatusMessage("Creating your booking...");
      } catch (wakeError) {
        // Server might be sleeping, wait a bit
        setStatusMessage("Server is waking up (this may take 30 seconds)...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        setStatusMessage("Creating your booking...");
      }

      // Prepare booking payload
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

      // Validate response
      if (!res.data.booking_id) {
        throw new Error('Invalid response: No booking_id received');
      }

      console.log('🔄 Navigating to payment page for booking:', res.data.booking_id);
      
      // Store booking ID in session storage to help keep backend awake
      sessionStorage.setItem('activeBooking', res.data.booking_id);
      
      // Navigate to payment page
      navigate(`/dashboard/payment/${res.data.booking_id}`);
      
    } catch (err) {
      console.error('❌ Booking error:', err);
      console.error('Error response:', err.response?.data);
      
      // Handle different error types
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError(
          "Cannot connect to server. The server is sleeping (Render.com free tier). " +
          "Please wait 30 seconds and try again."
        );
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

  // Loading state
  if (!event && !error) {
    return (
      <div className="booking-form">
        <p className="loading-text">{statusMessage || "Loading booking details..."}</p>
      </div>
    );
  }

  // Error state with retry option
  if (error && !event) {
    return (
      <div className="booking-form">
        <div className="error-container">
          <p className="error">{error}</p>
          <button onClick={fetchEventAndTickets} className="retry-btn">
            🔄 Retry Loading
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-form">
      <h2>Book Tickets for {event?.title}</h2>
      
      {event?.event_date && (
        <p className="event-date">
          {new Date(event.event_date).toLocaleDateString("en-GB", {
            weekday: "long", 
            year: "numeric", 
            month: "long", 
            day: "numeric"
          })}
        </p>
      )}
      
      <p className="event-location">
        📍 {event?.location || "Location not specified"}
      </p>

      <div className="ticket-types">
        <h3>Select Tickets</h3>
        
        {tickets.length > 0 ? (
          tickets.map(ticket => {
            const available = ticket.quantity_available - ticket.quantity_sold;
            const isAvailable = available > 0;
            
            return (
              <div key={ticket.id} className={`ticket-item ${!isAvailable ? 'sold-out' : ''}`}>
                <div className="ticket-info">
                  <span className="ticket-name">{ticket.name}</span>
                  <span className="ticket-price">KES {ticket.price.toLocaleString()}</span>
                </div>
                
                {ticket.description && (
                  <p className="ticket-description">{ticket.description}</p>
                )}
                
                <div className="ticket-availability">
                  {isAvailable ? (
                    <small className="available">✓ {available} available</small>
                  ) : (
                    <small className="sold-out">✗ Sold Out</small>
                  )}
                </div>
                
                {isAvailable && (
                  <>
                    <div className="ticket-controls">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(ticket.id, selectedTickets[ticket.id] - 1)}
                        disabled={selectedTickets[ticket.id] === 0}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={available}
                        value={selectedTickets[ticket.id]}
                        onChange={e => handleQuantityChange(ticket.id, parseInt(e.target.value) || 0)}
                        aria-label="Ticket quantity"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(ticket.id, selectedTickets[ticket.id] + 1)}
                        disabled={selectedTickets[ticket.id] >= available}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    
                    {selectedTickets[ticket.id] > 0 && (
                      <div className="ticket-subtotal">
                        Subtotal: <strong>KES {(ticket.price * selectedTickets[ticket.id]).toLocaleString()}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        ) : (
          <p className="no-tickets">No tickets available for this event.</p>
        )}
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
          <small className="form-hint">
            Enter the phone number to receive M-Pesa payment prompt
          </small>
        </div>

        <div className="booking-summary">
          <div className="summary-row">
            <span>Total Tickets:</span>
            <strong>{totalTickets}</strong>
          </div>
          <div className="summary-row total">
            <span>Total Amount:</span>
            <strong>KES {totalAmount.toLocaleString()}</strong>
          </div>
        </div>

        {statusMessage && (
          <div className="status-message">
            <span>ℹ️ {statusMessage}</span>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>⚠️ {error}</span>
          </div>
        )}

        <button 
          type="submit" 
          disabled={loading || totalTickets === 0}
          className="btn-proceed"
        >
          {loading ? (
            <>
              <span className="spinner-small"></span>
              Processing...
            </>
          ) : (
            "Proceed to Payment →"
          )}
        </button>

        {totalTickets === 0 && (
          <p className="hint-text">Please select at least one ticket to continue</p>
        )}
      </form>
    </div>
  );
};

export default BookingForm;