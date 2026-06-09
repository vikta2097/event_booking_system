// Add to your ChatbotWidget.js - Enhanced version
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import './ChatbotWidget.css';

const ChatbotWidget = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversation history on mount
  useEffect(() => {
    if (user && isOpen) {
      loadHistory();
    }
  }, [user, isOpen]);

  const loadHistory = async () => {
    try {
      const response = await api.get('/chatbot/history');
      if (response.data.history) {
        const formattedHistory = response.data.history.map(h => ({
          text: h.message,
          sender: 'user',
          timestamp: h.created_at
        }));
        formattedHistory.push(...response.data.history.map(h => ({
          text: h.response,
          sender: 'bot',
          timestamp: h.created_at
        })));
        setMessages(formattedHistory);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setMessages(prev => [...prev, { text: userMessage, sender: 'user', timestamp: new Date() }]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await api.post('/chatbot/chat', {
        message: userMessage,
        role: user?.role || 'guest',
        userId: user?.id
      });

      const botMessage = {
        text: response.data.response,
        sender: 'bot',
        timestamp: new Date(),
        events: response.data.events,
        bookings: response.data.bookings,
        stats: response.data.stats,
        suggestions: response.data.suggestions
      };

      setMessages(prev => [...prev, botMessage]);
      setSuggestions(response.data.suggestions || []);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        text: "Sorry, I'm having trouble connecting. Please try again.",
        sender: 'bot',
        isError: true,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputMessage(suggestion);
    inputRef.current?.focus();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render event cards in chat
  const renderEventCards = (events) => {
    if (!events || events.length === 0) return null;
    return (
      <div className="event-list">
        {events.map(event => (
          <div key={event.id} className="event-card">
            <div className="event-header">
              <h5>{event.title}</h5>
              <span className="event-price">KES {event.price}</span>
            </div>
            <div className="event-details">
              <p>📅 {new Date(event.event_date).toLocaleDateString()}</p>
              <p>📍 {event.location}</p>
            </div>
            <button 
              className="btn-book"
              onClick={() => window.location.href = `/dashboard/events/${event.id}`}
            >
              View Details
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Render booking cards in chat
  const renderBookingCards = (bookings) => {
    if (!bookings || bookings.length === 0) return null;
    return (
      <div className="booking-list">
        {bookings.map(booking => (
          <div key={booking.id} className="booking-card">
            <div className="booking-header">
              <h5>{booking.title}</h5>
              <span className={`status-badge ${booking.status}`}>
                {booking.status}
              </span>
            </div>
            <div className="booking-details">
              <p>📅 {new Date(booking.event_date).toLocaleDateString()}</p>
              <p>🎟️ {booking.seats} ticket(s)</p>
              <p>💰 KES {booking.total_amount}</p>
            </div>
            <button 
              className="btn-view"
              onClick={() => window.location.href = `/dashboard/my-bookings`}
            >
              View Booking
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Render stats in chat
  const renderStats = (stats) => {
    if (!stats) return null;
    return (
      <div className="stats-grid">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="stat-card">
            <span className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</span>
            <span className="stat-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button className="chatbot-button" onClick={() => setIsOpen(true)}>
          <span className="chatbot-icon">💬</span>
          {user && <span className="chatbot-badge">●</span>}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-widget">
          <div className="chatbot-header">
            <div className="chatbot-title">
              <span className="chatbot-avatar">🤖</span>
              <div className="chatbot-info">
                <h4>Event Assistant</h4>
                <div className="chatbot-status">
                  {user ? `Welcome, ${user.fullname?.split(' ')[0]}` : 'Guest Mode'}
                </div>
              </div>
            </div>
            <div className="chatbot-controls">
              <button onClick={() => {
                setMessages([]);
                api.post('/chatbot/clear', { userId: user?.id });
              }} title="Clear chat">
                🗑️
              </button>
              <button onClick={() => setIsOpen(false)} title="Close">
                ✕
              </button>
            </div>
          </div>

          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="welcome-message">
                <p>👋 Hello! I'm your event assistant.</p>
                <p>Ask me about events, bookings, payments, or get help!</p>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.sender}`}>
                <div className="message-avatar">
                  {msg.sender === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className={`message-text ${msg.isError ? 'error' : ''}`}>
                    {msg.text}
                  </div>
                  {msg.events && renderEventCards(msg.events)}
                  {msg.bookings && renderBookingCards(msg.bookings)}
                  {msg.stats && renderStats(msg.stats)}
                  <div className="message-time">
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="message bot">
                <div className="message-avatar">🤖</div>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {suggestions.length > 0 && (
            <div className="chatbot-suggestions">
              <div className="suggestions-label">Suggested</div>
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

          <div className="chatbot-input">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={isTyping}
            />
            <button onClick={sendMessage} disabled={isTyping || !inputMessage.trim()}>
              ➤
            </button>
          </div>

          <div className="chatbot-footer">
            <span>Powered by AI</span>
            <span className="footer-divider">•</span>
            <span>Secure</span>
            <span className="footer-divider">•</span>
            <span>24/7 Support</span>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;