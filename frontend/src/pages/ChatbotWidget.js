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

  const role = user?.role || "guest";
  const userId = user?.id || user?.user_id;
  const userName = user?.fullname || user?.full_name || user?.name || user?.username || "there";

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [messages]);

  const sendGreeting = useCallback(() => {
    const greetings = {
      guest: "Hello! 👋 Welcome to our Event Booking System. I can help you explore events, learn about registration, or answer questions. What would you like to know?",
      user: `Welcome back, ${userName}! 👋 I can help with your bookings, payments, finding events, and more.`,
      admin: `Hello Admin${userName !== "there" ? ", " + userName : ""}! 👨‍💼 I can show stats, manage bookings, track payments, and more.`
    };

    addMessage("bot", greetings[role]);

    const initialSuggestions = {
      guest: ["Show events", "How to register", "Contact support"],
      user: ["My bookings", "Find events", "How to pay"],
      admin: ["Dashboard stats", "Manage bookings", "View users"]
    };

    setSuggestions(initialSuggestions[role]);
  }, [role, userName]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      sendGreeting();
    }
  }, [isOpen, messages.length, sendGreeting]);

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

      if (data.response) {
        addMessage("bot", data.response, {
          events: data.events || [],
          bookings: data.bookings || [],
          stats: data.stats,
          categories: data.categories || [],
          reminders: data.reminders || []
        });
      }

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      addMessage("bot", "Sorry, I encountered an error. Please try again or contact support at victorlabs854@gmail.com");
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

  const handleSuggestionClick = (suggestion) => handleSend(suggestion);

  const handleClearChat = async () => {
    setMessages([]);
    setSuggestions([]);
    
    try {
      if (userId) await api.post("/chatbot/clear", { userId });
      sendGreeting();
    } catch (error) {
      console.error("Clear chat error:", error);
      addMessage("bot", "Chat cleared locally.");
      sendGreeting();
    }
  };

  const handleToggle = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) setUnreadCount(0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const handleEventAction = (eventId, action) => {
    handleSend(action === "book" ? `Book event ${eventId}` : `Tell me about event ${eventId}`);
  };

  const handleBookingAction = (bookingRef, action) => {
    handleSend(action === "cancel" ? `Cancel booking ${bookingRef}` : `Status of ${bookingRef}`);
  };

  const handleCategoryClick = (categoryName) => {
    handleSend(`Show ${categoryName} events`);
  };

  return (
    <>
      <button className="chatbot-button" onClick={handleToggle}>
        <span className="chatbot-icon">🤖</span>
        {unreadCount > 0 && <span className="chatbot-badge">{unreadCount}</span>}
      </button>

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
                <div className="message-avatar">{msg.sender === "user" ? "U" : "B"}</div>
                <div className="message-content">
                  <div className="message-text">{msg.text}</div>
                  {/* Events, Bookings, Categories, Reminders, Stats */}
                  {/* … same as before … */}
                  <div className="message-time">{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="typing-indicator">
                <span></span><span></span><span></span>
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
                  <button key={idx} className="suggestion-chip" onClick={() => handleSuggestionClick(suggestion)}>
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
            <button onClick={() => handleSend()} disabled={typing || !input.trim()}>➤</button>
          </div>

          <div className="chatbot-footer">
            EventBot • Powered by Your System
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
