import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../api";
import "../styles/ChatbotWidget.css";

const ChatbotWidget = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  // Determine user role
  const role = user?.role || "guest";
  const userId = user?.id || user?.user_id;
  const userName = user?.fullname || user?.full_name || user?.name || user?.username || "there";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Send greeting when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      sendGreeting();
    }
  }, [isOpen]);

  const sendGreeting = () => {
    const greetings = {
      guest: "Hello! 👋 Welcome to our Event Booking System. I can help you explore events, learn about registration, or answer questions. What would you like to know?",
      user: `Welcome back, ${userName}! 👋 I can help with your bookings, payments, finding events, and more.`,
      admin: `Hello Admin${userName !== "there" ? ", " + userName : ""}! 👨‍💼 I can show stats, manage bookings, track payments, and more.`
    };

    addMessage("bot", greetings[role]);

    // Set initial suggestions based on role
    const initialSuggestions = {
      guest: ["Show events", "How to register", "Contact support"],
      user: ["My bookings", "Find events", "How to pay"],
      admin: ["Dashboard stats", "Manage bookings", "View users"]
    };

    setSuggestions(initialSuggestions[role]);
  };

  const addMessage = (sender, text, data = {}) => {
    const timestamp = new Date();
    setMessages(prev => [...prev, { sender, text, timestamp, ...data }]);
    
    if (!isOpen && sender === "bot") {
      setUnreadCount(prev => prev + 1);
    }
  };

  const handleSend = async (messageText = input) => {
    if (!messageText.trim()) return;

    const userMessage = messageText.trim();
    addMessage("user", userMessage);
    setInput("");
    setTyping(true);
    setSuggestions([]);

    try {
      const response = await api.post("/chatbot/chat", {
        message: userMessage,
        role: role,
        userId: userId
      });

      const data = response.data;

      // Add bot response
      if (data.response) {
        addMessage("bot", data.response, {
          events: data.events || [],
          bookings: data.bookings || [],
          stats: data.stats,
          categories: data.categories || [],
          reminders: data.reminders || []
        });
      }

      // Update suggestions
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }

    } catch (error) {
      console.error("Chatbot error:", error);
      addMessage("bot", "Sorry, I encountered an error. Please try again or contact support at victorlabs854@gmail.com");
      
      // Reset suggestions on error
      const fallbackSuggestions = {
        guest: ["Show events", "How to register", "Contact support"],
        user: ["My bookings", "Find events", "How to pay"],
        admin: ["Dashboard stats", "Manage bookings", "View users"]
      };
      setSuggestions(fallbackSuggestions[role]);
    } finally {
      setTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSend(suggestion);
  };

  const handleClearChat = async () => {
    setMessages([]);
    setSuggestions([]);
    
    try {
      if (userId) {
        await api.post("/chatbot/clear", { userId });
      }
      sendGreeting();
    } catch (error) {
      console.error("Clear chat error:", error);
      addMessage("bot", "Chat cleared locally.");
      sendGreeting();
    }
  };

  const handleToggle = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES"
    }).format(amount);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };

  const handleEventAction = (eventId, action) => {
    if (action === "book") {
      handleSend(`Book event ${eventId}`);
    } else if (action === "details") {
      handleSend(`Tell me about event ${eventId}`);
    }
  };

  const handleBookingAction = (bookingRef, action) => {
    if (action === "cancel") {
      handleSend(`Cancel booking ${bookingRef}`);
    } else if (action === "status") {
      handleSend(`Status of ${bookingRef}`);
    }
  };

  const handleCategoryClick = (categoryName) => {
    handleSend(`Show ${categoryName} events`);
  };

  return (
    <>
      {/* Floating Button */}
      <button className="chatbot-button" onClick={handleToggle}>
        <span className="chatbot-icon">🤖</span>
        {unreadCount > 0 && (
          <span className="chatbot-badge">{unreadCount}</span>
        )}
      </button>

      {/* Chat Widget */}
      {isOpen && (
        <div className="chatbot-widget">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-title">
              <span className="chatbot-avatar">🤖</span>
              <div className="chatbot-info">
                <h4>EventBot</h4>
                <div className="chatbot-status">Online</div>
              </div>
            </div>
            <div className="chatbot-controls">
              <button onClick={handleClearChat} title="Clear chat">🗑️</button>
              <button onClick={handleToggle} title="Close">✖</button>
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <div className="message-avatar">
                  {msg.sender === "user" ? "U" : "B"}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.text}</div>

                  {/* Events List */}
                  {msg.events && msg.events.length > 0 && (
                    <div className="event-list">
                      {msg.events.map((event) => (
                        <div key={event.id} className="event-card">
                          <div className="event-header">
                            <h5>{event.title}</h5>
                            <div className="event-price">
                              {formatCurrency(event.price)}
                            </div>
                          </div>
                          <div className="event-details">
                            <p>📅 {formatDate(event.event_date)}</p>
                            <p>📍 {event.location}</p>
                            {event.category && <p>🏷️ {event.category}</p>}
                            {event.capacity && <p>👥 Capacity: {event.capacity}</p>}
                          </div>
                          <div className="event-actions">
                            <button 
                              className="btn-book"
                              onClick={() => handleEventAction(event.id, "book")}
                              disabled={role === "guest"}
                              title={role === "guest" ? "Please login to book" : "Book this event"}
                            >
                              {role === "guest" ? "Login to Book" : "Book Now"}
                            </button>
                            <button 
                              className="btn-details"
                              onClick={() => handleEventAction(event.id, "details")}
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bookings List */}
                  {msg.bookings && msg.bookings.length > 0 && (
                    <div className="booking-list">
                      {msg.bookings.map((booking) => (
                        <div key={booking.id} className="booking-card">
                          <div className="booking-header">
                            <h5>{booking.title}</h5>
                            <span className={`status-badge ${booking.status}`}>
                              {booking.status}
                            </span>
                          </div>
                          <div className="booking-details">
                            <p>📋 Ref: {booking.reference}</p>
                            <p>📅 {formatDate(booking.event_date)}</p>
                            <p>📍 {booking.location}</p>
                            <p>🎟️ Seats: {booking.seats}</p>
                            <p>
                              💳 Payment: 
                              <span className={`payment-status ${booking.payment_status || 'pending'}`}>
                                {booking.payment_status || 'pending'}
                              </span>
                            </p>
                            <p>💰 {formatCurrency(booking.total_amount)}</p>
                          </div>
                          <div className="booking-actions">
                            {booking.status === "confirmed" && (
                              <button 
                                className="btn-cancel"
                                onClick={() => handleBookingAction(booking.reference, "cancel")}
                              >
                                Cancel
                              </button>
                            )}
                            <button 
                              className="btn-view"
                              onClick={() => handleBookingAction(booking.reference, "status")}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Categories */}
                  {msg.categories && msg.categories.length > 0 && (
                    <div className="category-list">
                      {msg.categories.map((category) => (
                        <button
                          key={category.id}
                          className="category-chip"
                          onClick={() => handleCategoryClick(category.name)}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Reminders */}
                  {msg.reminders && msg.reminders.length > 0 && (
                    <div className="reminders-section">
                      <h5>⏰ Upcoming Events</h5>
                      <div className="reminder-list">
                        {msg.reminders.map((reminder) => (
                          <div key={reminder.id} className="reminder-card">
                            <p className="reminder-title">{reminder.title}</p>
                            <p className="reminder-date">
                              📅 {formatDate(reminder.event_date)}
                              {reminder.start_time && ` at ${formatTime(reminder.start_time)}`}
                            </p>
                            <p className="reminder-location">📍 {reminder.location}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin Stats */}
                  {msg.stats && (
                    <div className="stats-grid">
                      <div className="stat-card">
                        <span className="stat-value">{msg.stats.totalEvents || 0}</span>
                        <span className="stat-label">Total Events</span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-value">{msg.stats.totalBookings || 0}</span>
                        <span className="stat-label">Bookings</span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-value">
                          {formatCurrency(msg.stats.totalRevenue || 0)}
                        </span>
                        <span className="stat-label">Revenue</span>
                      </div>
                      <div className="stat-card">
                        <span className="stat-value">{msg.stats.totalUsers || 0}</span>
                        <span className="stat-label">Users</span>
                      </div>
                      {msg.stats.successfulPayments !== undefined && (
                        <div className="stat-card">
                          <span className="stat-value">{msg.stats.successfulPayments}</span>
                          <span className="stat-label">Paid</span>
                        </div>
                      )}
                      {msg.stats.admins !== undefined && (
                        <div className="stat-card">
                          <span className="stat-value">{msg.stats.admins}</span>
                          <span className="stat-label">Admins</span>
                        </div>
                      )}
                      {msg.stats.regularUsers !== undefined && (
                        <div className="stat-card">
                          <span className="stat-value">{msg.stats.regularUsers}</span>
                          <span className="stat-label">Regular Users</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="message-time">
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !typing && (
            <div className="chatbot-suggestions">
              <div className="suggestions-label">Quick Actions:</div>
              <div className="suggestions-chips">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    className="suggestion-chip"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="chatbot-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={typing}
            />
            <button 
              onClick={() => handleSend()} 
              disabled={typing || !input.trim()}
            >
              ➤
            </button>
          </div>

          {/* Footer */}
          <div className="chatbot-footer">
            EventBot • Powered by Your System
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;