import React, { useState, useEffect, useRef } from "react";
import api from "../api"; // your configured axios instance
import "../styles/ChatbotWidget.css";
import { format } from "date-fns";

const ChatbotWidget = ({ user, role }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [stats, setStats] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(scrollToBottom, [messages, events, bookings, reminders, stats]);

  const fetchData = async () => {
    try {
      setTyping(true);
      const [eventsRes, bookingsRes, categoriesRes, remindersRes, statsRes] =
        await Promise.all([
          api.get("/events"),
          api.get("/bookings"),
          api.get("/categories"),
          api.get("/reminders"),
          role === "admin" ? api.get("/admin/stats") : Promise.resolve({ data: [] }),
        ]);

      setEvents(eventsRes.data);
      setBookings(bookingsRes.data);
      setCategories(categoriesRes.data);
      setReminders(remindersRes.data);
      if (role === "admin") setStats(statsRes.data);

      setTyping(false);
      addMessage("bot", "Here is the latest info.");
    } catch (err) {
      setTyping(false);
      addMessage("bot", "Failed to fetch data. Try again.");
    }
  };

  const addMessage = (sender, text, extra = {}) => {
    setMessages((prev) => [...prev, { sender, text, ...extra }]);
  };

  const handleInputSend = async () => {
    if (!input.trim()) return;
    addMessage("user", input);
    setInput("");
    setTyping(true);

    // send to backend chatbot API
    try {
      const res = await api.post("/chatbot/message", { message: input });
      if (res.data?.responses) {
        res.data.responses.forEach((r) => addMessage("bot", r));
      }
    } catch (err) {
      addMessage("bot", "Sorry, something went wrong.");
    }
    setTyping(false);
  };

  const handleBookEvent = async (eventId) => {
    setTyping(true);
    try {
      const res = await api.post(`/bookings`, { eventId });
      addMessage("bot", `Event booked successfully!`);
      fetchData();
    } catch (err) {
      addMessage("bot", `Failed to book event.`);
    }
    setTyping(false);
  };

  const handleCancelBooking = async (bookingId) => {
    setTyping(true);
    try {
      await api.delete(`/bookings/${bookingId}`);
      addMessage("bot", `Booking cancelled successfully.`);
      fetchData();
    } catch (err) {
      addMessage("bot", `Failed to cancel booking.`);
    }
    setTyping(false);
  };

  const handleClearContext = async () => {
    setMessages([]);
    try {
      await api.post("/chatbot/clear");
      addMessage("bot", "Chat context cleared.");
    } catch (err) {
      addMessage("bot", "Failed to clear context.");
    }
  };

  return (
    <>
      <button className="chatbot-button" onClick={() => setIsOpen((o) => !o)}>
        <span className="chatbot-icon">🤖</span>
      </button>

      {isOpen && (
        <div className="chatbot-widget">
          <div className="chatbot-header">
            <div className="chatbot-title">
              <span className="chatbot-avatar">🤖</span>
              <div className="chatbot-info">
                <h4>EventBot</h4>
                <div className="chatbot-status">Online</div>
              </div>
            </div>
            <div className="chatbot-controls">
              <button onClick={handleClearContext}>🗑</button>
              <button onClick={() => setIsOpen(false)}>✖</button>
            </div>
          </div>

          <div className="chatbot-messages">
            {messages.map((m, idx) => (
              <div key={idx} className={`message ${m.sender}`}>
                <div className="message-avatar">{m.sender === "user" ? "U" : "B"}</div>
                <div className="message-content">
                  <div className="message-text">{m.text}</div>
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

            {/* Events */}
            {events.length > 0 && (
              <div className="event-list">
                {events.map((e) => (
                  <div key={e.id} className="event-card">
                    <div className="event-header">
                      <h5>{e.name}</h5>
                      <div className="event-price">
                        {new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(e.price)}
                      </div>
                    </div>
                    <div className="event-details">
                      <p>Date: {format(new Date(e.date), "dd MMM yyyy")}</p>
                      <p>Location: {e.location}</p>
                    </div>
                    <div className="event-actions">
                      <button className="btn-book" onClick={() => handleBookEvent(e.id)}>Book</button>
                      <button className="btn-details" onClick={() => addMessage("bot", `Event details: ${e.description}`)}>View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bookings */}
            {bookings.length > 0 && (
              <div className="booking-list">
                {bookings.map((b) => (
                  <div key={b.id} className="booking-card">
                    <div className="booking-header">
                      <h5>{b.event_name}</h5>
                      <span className={`status-badge ${b.status}`}>{b.status}</span>
                    </div>
                    <div className="booking-details">
                      <p>Date: {format(new Date(b.date), "dd MMM yyyy")}</p>
                      <p>Location: {b.location}</p>
                      <p>Payment: <span className={`payment-status ${b.payment_status}`}>{b.payment_status}</span></p>
                    </div>
                    <div className="booking-actions">
                      {b.status === "confirmed" && (
                        <button className="btn-cancel" onClick={() => handleCancelBooking(b.id)}>Cancel</button>
                      )}
                      <button className="btn-view" onClick={() => addMessage("bot", `Booking details: ${b.details}`)}>View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Categories */}
            {categories.length > 0 && (
              <div className="category-list">
                {categories.map((c) => (
                  <div key={c.id} className="category-chip" onClick={() => addMessage("bot", `Filter by ${c.name}`)}>
                    {c.name}
                  </div>
                ))}
              </div>
            )}

            {/* Reminders */}
            {reminders.length > 0 && (
              <div className="reminders-section">
                <h5>Reminders</h5>
                <div className="reminder-list">
                  {reminders.map((r) => (
                    <div key={r.id} className="reminder-card">
                      <p className="reminder-title">{r.title}</p>
                      <p className="reminder-date">{format(new Date(r.date), "dd MMM yyyy HH:mm")}</p>
                      <p className="reminder-location">{r.location}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Stats */}
            {role === "admin" && stats.length > 0 && (
              <div className="stats-grid">
                {stats.map((s) => (
                  <div key={s.label} className="stat-card">
                    <span className="stat-value">{s.value}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            <div ref={messagesEndRef}></div>
          </div>

          <div className="chatbot-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInputSend()}
              disabled={typing}
            />
            <button onClick={handleInputSend} disabled={typing}>➤</button>
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
