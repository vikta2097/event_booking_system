import React, { useEffect, useState } from "react";
import api from "../api"; // centralized axios instance
import "../styles/Support.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Support = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTicket, setNewTicket] = useState({ subject: "", message: "" });

  useEffect(() => {
    if (currentUser) fetchTickets();
  }, [currentUser]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await api.get("/support", { headers: { Authorization: `Bearer ${token}` } });
      setTickets(res.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewTicket((prev) => ({ ...prev, [name]: value }));
  };

  const submitTicket = async (e) => {
    e.preventDefault();
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error("Subject and message are required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await api.post(
        "/support",
        { ...newTicket, created_by: currentUser?.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data?.message || "Ticket submitted");
      setNewTicket({ subject: "", message: "" });
      fetchTickets();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create ticket");
    }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await api.delete(`/support/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(res.data?.message || "Ticket deleted");
      fetchTickets();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to delete ticket");
    }
  };

  if (!currentUser) return <p>Loading user...</p>;

  return (
    <div className="support-container">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Support Dashboard</h2>

      {/* New Ticket Form */}
      <div className="new-ticket-form">
        <h3>Submit a Support Ticket</h3>
        <form onSubmit={submitTicket}>
          <input
            type="text"
            name="subject"
            placeholder="Subject"
            value={newTicket.subject}
            onChange={handleChange}
          />
          <textarea
            name="message"
            placeholder="Your message..."
            value={newTicket.message}
            onChange={handleChange}
          />
          <button type="submit">Submit Ticket</button>
        </form>
      </div>

      {/* Tickets List */}
      <div className="tickets-list">
        <h3>All Tickets</h3>
        {loading ? (
          <p>Loading tickets...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : tickets.length === 0 ? (
          <p className="no-data">No tickets found</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Message</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Created At</th>
                {currentUser?.role === "admin" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>{ticket.id}</td>
                  <td>{ticket.subject}</td>
                  <td>{ticket.message}</td>
                  <td>{ticket.status}</td>
                  <td>{ticket.user_name || "N/A"}</td>
                  <td>{new Date(ticket.created_at).toLocaleString()}</td>
                  {currentUser?.role === "admin" && (
                    <td>
                      <button className="delete-btn" onClick={() => deleteTicket(ticket.id)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Support;
