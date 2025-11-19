import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/TicketSelection.css";

const TicketSelection = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch event details and ticket types
  const fetchEventAndTickets = useCallback(async () => {
    try {
      setLoading(true);

      const [eventRes, ticketsRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/ticket-types`)
      ]);

      setEvent(eventRes.data);
      setTicketTypes(ticketsRes.data);

      // Initialize selected tickets
      const initial = {};
      ticketsRes.data.forEach(ticket => {
        initial[ticket.id] = 0;
      });
      setSelectedTickets(initial);

    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load ticket information");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEventAndTickets();
  }, [fetchEventAndTickets]);

  const handleQuantityChange = (ticketTypeId, quantity) => {
    const ticketType = ticketTypes.find(t => t.id === ticketTypeId);
    const newQuantity = Math.max(0, Math.min(quantity, ticketType.quantity_available));

    setSelectedTickets(prev => ({
      ...prev,
      [ticketTypeId]: newQuantity
    }));
  };

  const calculateTotal = () => {
    return ticketTypes.reduce((total, ticket) => {
      return total + (ticket.price * (selectedTickets[ticket.id] || 0));
    }, 0);
  };

  const getTotalTickets = () => {
    return Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);
  };

  const handleContinue = () => {
    const totalTickets = getTotalTickets();

    if (totalTickets === 0) {
      setError("Please select at least one ticket");
      return;
    }

    const selection = {
      eventId: parseInt(id),
      tickets: ticketTypes
        .filter(ticket => selectedTickets[ticket.id] > 0)
        .map(ticket => ({
          ticketTypeId: ticket.id,
          name: ticket.name,
          quantity: selectedTickets[ticket.id],
          price: ticket.price,
          subtotal: ticket.price * selectedTickets[ticket.id]
        })),
      totalAmount: calculateTotal(),
      totalQuantity: totalTickets
    };

    localStorage.setItem("ticketSelection", JSON.stringify(selection));
    navigate(`/dashboard/book/${id}`);
  };

  if (loading) return <div className="loading">Loading tickets...</div>;
  if (error && !event) return <div className="error">{error}</div>;
  if (!event) return <div className="error">Event not found</div>;

  const totalAmount = calculateTotal();
  const totalTickets = getTotalTickets();

  return (
    <div className="ticket-selection">
      {/* Event Header */}
      <div className="event-header">
        <button onClick={() => navigate(`/dashboard/events/${id}`)} className="back-btn">
          ← Back to Event
        </button>
        <h1>{event.title}</h1>
        <p className="event-date">
          {new Date(event.event_date).toLocaleDateString("en-GB", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          })}
        </p>
        <p className="event-location">{event.venue || event.location}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Ticket Types */}
      <div className="ticket-types-container">
        <h2>Select Your Tickets</h2>

        {ticketTypes.length === 0 ? (
          <div className="no-tickets">
            <p>No tickets available for this event</p>
          </div>
        ) : (
          <div className="ticket-types-list">
            {ticketTypes.map(ticket => (
              <div key={ticket.id} className="ticket-type-card">
                <div className="ticket-info">
                  <h3>{ticket.name}</h3>
                  {ticket.description && (
                    <p className="ticket-description">{ticket.description}</p>
                  )}
                  <div className="ticket-details">
                    <span className="ticket-price">KES {ticket.price.toLocaleString()}</span>
                    <span className="ticket-availability">
                      {ticket.quantity_available > 0 
                        ? `${ticket.quantity_available} available`
                        : "Sold Out"
                      }
                    </span>
                  </div>
                </div>

                <div className="ticket-selector">
                  {ticket.quantity_available > 0 ? (
                    <>
                      <button
                        onClick={() => handleQuantityChange(ticket.id, selectedTickets[ticket.id] - 1)}
                        disabled={selectedTickets[ticket.id] === 0}
                        className="qty-btn"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={ticket.quantity_available}
                        value={selectedTickets[ticket.id]}
                        onChange={(e) => handleQuantityChange(ticket.id, parseInt(e.target.value) || 0)}
                        className="qty-input"
                      />
                      <button
                        onClick={() => handleQuantityChange(ticket.id, selectedTickets[ticket.id] + 1)}
                        disabled={selectedTickets[ticket.id] >= ticket.quantity_available}
                        className="qty-btn"
                      >
                        +
                      </button>
                    </>
                  ) : (
                    <span className="sold-out-badge">Sold Out</span>
                  )}
                </div>

                {selectedTickets[ticket.id] > 0 && (
                  <div className="ticket-subtotal">
                    Subtotal: KES {(ticket.price * selectedTickets[ticket.id]).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Bar */}
      {totalTickets > 0 && (
        <div className="summary-bar">
          <div className="summary-content">
            <div className="summary-details">
              <span className="summary-tickets">
                {totalTickets} {totalTickets === 1 ? "ticket" : "tickets"} selected
              </span>
              <span className="summary-total">
                Total: KES {totalAmount.toLocaleString()}
              </span>
            </div>
            <button onClick={handleContinue} className="continue-btn">
              Continue to Booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketSelection;
