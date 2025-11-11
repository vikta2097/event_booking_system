import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Support.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Support = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTicket, setNewTicket] = useState({
    subject: "",
    message: "",
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  // Fetch all tickets
  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:3300/api/support", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTickets(res.data);
      setError("");
    } catch (err) {
      console.error("Error fetching tickets:", err);
      setError("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewTicket((prev) => ({ ...prev, [name]: value }));
  };

  // Submit new ticket
  const submitTicket = async (e) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.message) {
      toast.error("Subject and message are required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        "http://localhost:3300/api/support",
        { ...newTicket, created_by: currentUser.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      setNewTicket({ subject: "", message: "" });
      fetchTickets();
    } catch (err) {
      console.error("Error creating ticket:", err);
      toast.error(err.response?.data?.error || "Failed to create ticket");
    }
  };

  // Delete ticket (admin only)
  const deleteTicket = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await axios.delete(`http://localhost:3300/api/support/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(res.data.message);
      fetchTickets();
    } catch (err) {
      console.error("Error deleting ticket:", err);
      toast.error(err.response?.data?.error || "Failed to delete ticket");
    }
  };

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
                {currentUser.role === "admin" && <th>Actions</th>}
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
                  {currentUser.role === "admin" && (
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => deleteTicket(ticket.id)}
                      >
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
