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

  // Determine user role
  const getUserRole = () => {
    if (!user) return "guest";
    return user.role || "user";
  };

  const role = getUserRole();

  // Get initial greeting based on role
  const getInitialGreeting = () => {
    if (role === "admin") {
      return "👨‍💼 Hello Admin! I'm your assistant. I can help you manage events, bookings, payments, and more. What do you need?";
    } else if (role === "user") {
      const userName = user?.fullname || user?.full_name || user?.name || "";
      return `👋 Welcome back${userName ? ", " + userName : ""}! I can help you find events, check bookings, or answer questions. How can I assist you?`;
    } else {
      return "👋 Welcome! I'm here to help you explore events and answer your questions. What would you like to know?";
    }
  };

  // Get initial suggestions based on role
  const getInitialSuggestions = () => {
    if (role === "admin") {
      return [
        "Show dashboard stats",
        "View recent bookings",
        "Payment summary",
        "Help"
      ];
    } else if (role === "user") {
      return [
        "Show my bookings",
        "Upcoming events",
        "How to pay",
        "Contact support"
      ];
    } else {
      return [
        "Show upcoming events",
        "How to register",
        "How to login",
        "Contact information"
      ];
    }
  };

  // Initialize chat on mount
  useEffect(() => {
    const greeting = getInitialGreeting();
    setMessages([{ 
      sender: "bot", 
      text: greeting, 
      timestamp: new Date() 
    }]);
    setSuggestions(getInitialSuggestions());
  }, [user, role]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Send message to backend
  const sendMessage = async (messageText = input) => {
    if (!messageText || !messageText.trim()) return;

    // Add user message to chat
    const userMessage = {
      sender: "user",
      text: messageText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Call chatbot API
      const response = await api.post("/chatbot/chat", {
        message: messageText,
        role: role
      });

      // Add bot response
      const botMessage = {
        sender: "bot",
        text: response.data.response,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, botMessage]);

      // Update suggestions if provided
      if (response.data.suggestions && Array.isArray(response.data.suggestions)) {
        setSuggestions(response.data.suggestions);
      }

    } catch (err) {
      console.error("Chatbot error:", err);
      
      // Show error message to user
      const errorMessage = {
        sender: "bot",
        text: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  // Clear chat and reset to initial state
  const handleClearChat = () => {
    const greeting = getInitialGreeting();
    setMessages([{ 
      sender: "bot", 
      text: greeting, 
      timestamp: new Date() 
    }]);
    setSuggestions(getInitialSuggestions());
    setInput("");
  };

  // Toggle chat window
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Get user avatar initial
  const getUserAvatar = () => {
    if (!user) return "👤";
    const name = user.fullname || user.full_name || user.name || user.email || "";
    return name.charAt(0).toUpperCase() || "👤";
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button 
          className="chatbot-button" 
          onClick={toggleChat}
          aria-label="Open chat"
        >
          <span className="chatbot-icon">💬</span>
          <span className="chatbot-badge">AI</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-widget">
          
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-title">
              <span className="chatbot-avatar">🤖</span>
              <div className="chatbot-info">
                <h4>Event Assistant</h4>
                <span className="chatbot-status">
                  {role === "admin" ? "Admin Mode" : 
                   role === "user" ? "Online" : 
                   "Guest Mode"}
                </span>
              </div>
            </div>
            <div className="chatbot-controls">
              <button 
                onClick={handleClearChat} 
                title="Clear chat"
                aria-label="Clear chat"
              >
                🔄
              </button>
              <button 
                onClick={toggleChat} 
                title="Close chat"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="chatbot-messages">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`message ${msg.sender}`}
              >
                {msg.sender === "bot" && (
                  <span className="message-avatar">🤖</span>
                )}
                
                <div className="message-content">
                  <div className="message-text">
                    {msg.text}
                  </div>
                  <span className="message-time">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                
                {msg.sender === "user" && (
                  <span className="message-avatar user-avatar">
                    {getUserAvatar()}
                  </span>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
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

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          {suggestions.length > 0 && !loading && (
            <div className="chatbot-suggestions">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="suggestion-chip"
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={loading}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form className="chatbot-input" onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              aria-label="Message input"
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              {loading ? "⏳" : "➤"}
            </button>
          </form>

          {/* Footer */}
          <div className="chatbot-footer">
            <span>Powered by Rule-Based AI • 100% Free</span>
          </div>
          
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;