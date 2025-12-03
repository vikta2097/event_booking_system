import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import "../styles/ChatbotWidget.css";

const ChatbotWidget = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  const role = user?.role || "guest";

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize greeting and suggestions
  useEffect(() => {
    let greeting = "";
    let initialSuggestions = [];

    if (role === "admin") {
      greeting =
        "👨‍💼 Hello Admin! I can help you manage events, bookings, payments, and stats. What do you want to do?";
      initialSuggestions = [
        "Show dashboard stats",
        "View recent bookings",
        "Payment summary",
        "Help",
      ];
    } else if (role === "user") {
      const name = user?.fullname || user?.name || "";
      greeting = `👋 Welcome back${name ? ", " + name : ""}! I can help you check bookings, explore events, or make payments.`;
      initialSuggestions = [
        "Show my bookings",
        "Upcoming events",
        "How to pay",
        "Contact support",
      ];
    } else {
      greeting = "👋 Welcome! I can help you explore events and answer questions.";
      initialSuggestions = [
        "Show upcoming events",
        "How to register",
        "How to login",
        "Contact information",
      ];
    }

    setMessages([{ sender: "bot", text: greeting, timestamp: new Date() }]);
    setSuggestions(initialSuggestions);
  }, [user, role]);

  // Send message or handle actions
  const sendMessage = async (messageText = input) => {
    if (!messageText?.trim()) return;

    // Add user message
    const userMessage = { sender: "user", text: messageText, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/chatbot/chat", { message: messageText, role });

      // Bot response
      const botMessage = {
        sender: "bot",
        text: res.data.response,
        timestamp: new Date(),
        bookings: res.data.bookings || [],
        events: res.data.events || [],
        stats: res.data.stats || null,
      };
      setMessages((prev) => [...prev, botMessage]);

      // Update suggestions
      if (res.data.suggestions?.length) setSuggestions(res.data.suggestions);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Sorry, there was a problem connecting. Try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Cancel booking
  const handleCancelBooking = async (bookingId) => {
    try {
      setLoading(true);
      await api.post("/bookings/cancel", { bookingId });
      sendMessage("Booking cancelled successfully!");
    } catch (err) {
      sendMessage("Failed to cancel booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (s) => sendMessage(s);

  // Toggle chat
  const toggleChat = () => setIsOpen(!isOpen);

  // Clear chat
  const handleClearChat = () => setMessages([]);

  const getUserAvatar = () => {
    if (!user) return "👤";
    const name = user.fullname || user.name || user.email || "";
    return name.charAt(0).toUpperCase();
  };

  const formatTime = (timestamp) =>
    timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      {!isOpen && (
        <button className="chatbot-button" onClick={toggleChat} aria-label="Open chat">
          <span className="chatbot-icon">💬</span>
          <span className="chatbot-badge">AI</span>
        </button>
      )}

      {isOpen && (
        <div className="chatbot-widget">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-title">
              <span className="chatbot-avatar">🤖</span>
              <div className="chatbot-info">
                <h4>Event Assistant</h4>
                <span className="chatbot-status">
                  {role === "admin" ? "Admin Mode" : role === "user" ? "Online" : "Guest Mode"}
                </span>
              </div>
            </div>
            <div className="chatbot-controls">
              <button onClick={handleClearChat} title="Clear chat">
                🔄
              </button>
              <button onClick={toggleChat} title="Close chat">
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.sender}`}>
                {msg.sender === "bot" && <span className="message-avatar">🤖</span>}

                <div className="message-content">
                  <div className="message-text">{msg.text}</div>
                  <span className="message-time">{formatTime(msg.timestamp)}</span>

                  {/* Bookings */}
                  {msg.bookings?.length > 0 && (
                    <div className="booking-list">
                      {msg.bookings.map((b) => (
                        <div key={b.id} className="booking-card">
                          <h5>{b.event_name}</h5>
                          <p>Date: {b.event_date}</p>
                          <p>Status: {b.status}</p>
                          <button onClick={() => handleCancelBooking(b.id)}>Cancel</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Events */}
                  {msg.events?.length > 0 && (
                    <div className="event-list">
                      {msg.events.map((e) => (
                        <div key={e.id} className="event-card">
                          <h5>{e.name}</h5>
                          <p>Date: {e.date}</p>
                          <p>Location: {e.location}</p>
                          <button onClick={() => sendMessage(`Book event ${e.id}`)}>Book</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  {msg.stats && (
                    <div className="stats-box">
                      {Object.entries(msg.stats).map(([key, value]) => (
                        <p key={key}>
                          <strong>{key}:</strong> {value}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {msg.sender === "user" && <span className="message-avatar user-avatar">{getUserAvatar()}</span>}
              </div>
            ))}

            {loading && (
              <div className="message bot">
                <span className="message-avatar">🤖</span>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && !loading && (
            <div className="chatbot-suggestions">
              {suggestions.map((s, i) => (
                <button key={i} className="suggestion-chip" onClick={() => handleSuggestionClick(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form className="chatbot-input" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              {loading ? "⏳" : "➤"}
            </button>
          </form>

          {/* Footer */}
          <div className="chatbot-footer">Powered by Rule-Based AI • 100% Free</div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
