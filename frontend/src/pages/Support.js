import React, { useEffect, useState } from "react";
import api from "../api";
import "../styles/Support.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Support = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTicket, setNewTicket] = useState({ subject: "", message: "", priority: "low" });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [activeTab, setActiveTab] = useState("tickets"); // tickets | contacts
  const [showTicketModal, setShowTicketModal] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    fetchTickets();
    if (currentUser.role === "admin") fetchContacts();
  }, [currentUser]);

  // ======================
  // Fetch Tickets
  // ======================
  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get("/support/ticket");
      setTickets(res.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load tickets");
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // Fetch Contact Messages (Admin only)
  // ======================
  const fetchContacts = async () => {
    try {
      const res = await api.get("/support/contact");
      setContacts(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load contact messages");
    }
  };

  // ======================
  // Handle New Ticket Input
  // ======================
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
      await api.post("/support/ticket", newTicket);
      toast.success("Ticket submitted successfully");
      setNewTicket({ subject: "", message: "", priority: "low" });
      fetchTickets();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to create ticket");
    }
  };

  // ======================
  // Ticket Detail & Reply
  // ======================
  const viewTicket = async (ticketId) => {
    try {
      const res = await api.get(`/support/ticket/${ticketId}`);
      setSelectedTicket(res.data);
      setShowTicketModal(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load ticket details");
    }
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) {
      toast.error("Reply message cannot be empty");
      return;
    }
    try {
      await api.post(`/support/ticket/${selectedTicket.id}/reply`, { message: replyMessage });
      toast.success("Reply sent successfully");
      setReplyMessage("");
      viewTicket(selectedTicket.id);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to send reply");
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      await api.put(`/support/ticket/${ticketId}/status`, { status: newStatus });
      toast.success("Status updated successfully");
      fetchTickets();
      if (selectedTicket?.id === ticketId) viewTicket(ticketId);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to update status");
    }
  };

  const deleteTicket = async (ticketId) => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await api.delete(`/support/ticket/${ticketId}`);
      toast.success("Ticket deleted successfully");
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
        setShowTicketModal(false);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to delete ticket");
    }
  };

  // ======================
  // Contact Message Actions (Admin)
  // ======================
  const updateContactStatus = async (contactId, newStatus) => {
    try {
      await api.put(`/support/contact/${contactId}/status`, { status: newStatus });
      toast.success("Status updated successfully");
      fetchContacts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to update status");
    }
  };

  const deleteContact = async (contactId) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await api.delete(`/support/contact/${contactId}`);
      toast.success("Message deleted successfully");
      fetchContacts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to delete message");
    }
  };

  const getStatusBadge = (status) => {
    const classes = { open: "status-open", in_progress: "status-progress", resolved: "status-resolved", closed: "status-closed", new: "status-new" };
    return <span className={`status-badge ${classes[status]}`}>{status}</span>;
  };

  const getPriorityBadge = (priority) => {
    const classes = { low: "priority-low", medium: "priority-medium", high: "priority-high" };
    return <span className={`priority-badge ${classes[priority]}`}>{priority}</span>;
  };

  if (!currentUser) return <p>Loading user...</p>;

  return (
    <div className="support-container">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>Support Dashboard</h2>

      {/* Tabs */}
      <div className="tabs">
        <button className={activeTab === "tickets" ? "active" : ""} onClick={() => setActiveTab("tickets")}>Support Tickets</button>
        {currentUser.role === "admin" && (
          <button className={activeTab === "contacts" ? "active" : ""} onClick={() => setActiveTab("contacts")}>Contact Messages</button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "tickets" && (
        <>
          {/* New Ticket Form */}
          <div className="new-ticket-form">
            <h3>Submit a Support Ticket</h3>
            <form onSubmit={submitTicket}>
              <input type="text" name="subject" placeholder="Subject" value={newTicket.subject} onChange={handleChange} required />
              <textarea name="message" placeholder="Describe your issue..." value={newTicket.message} onChange={handleChange} rows="5" required />
              <select name="priority" value={newTicket.priority} onChange={handleChange}>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <button type="submit" className="submit-btn">Submit Ticket</button>
            </form>
          </div>

          {/* Tickets List */}
          <div className="tickets-list">
            {loading ? <p>Loading tickets...</p> : error ? <p className="error">{error}</p> : tickets.length === 0 ? <p className="no-data">No tickets found</p> :
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created By</th><th>Created At</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td>{ticket.id}</td>
                      <td>{ticket.subject}</td>
                      <td>{getPriorityBadge(ticket.priority)}</td>
                      <td>{getStatusBadge(ticket.status)}</td>
                      <td>{ticket.user_name || "N/A"}</td>
                      <td>{new Date(ticket.created_at).toLocaleString()}</td>
                      <td>
                        <button className="view-btn" onClick={() => viewTicket(ticket.id)}>View</button>
                        {currentUser?.role === "admin" && (
                          <button className="delete-btn" onClick={() => deleteTicket(ticket.id)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
          </div>
        </>
      )}

      {activeTab === "contacts" && currentUser.role === "admin" && (
        <div className="contacts-list">
          <h3>Contact Messages</h3>
          {contacts.length === 0 ? <p className="no-data">No messages found</p> :
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Email</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created At</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.name}</td>
                    <td>{c.email}</td>
                    <td>{c.subject}</td>
                    <td>{getPriorityBadge(c.priority)}</td>
                    <td>{getStatusBadge(c.status)}</td>
                    <td>{new Date(c.created_at).toLocaleString()}</td>
                    <td>
                      <select value={c.status} onChange={(e) => updateContactStatus(c.id, e.target.value)}>
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <button className="delete-btn" onClick={() => deleteContact(c.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {showTicketModal && selectedTicket && (
        <div className="modal-overlay" onClick={() => setShowTicketModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ticket #{selectedTicket.id}: {selectedTicket.subject}</h3>
              <button className="close-btn" onClick={() => setShowTicketModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="ticket-info">
                <p><strong>Status:</strong> {getStatusBadge(selectedTicket.status)}</p>
                <p><strong>Priority:</strong> {getPriorityBadge(selectedTicket.priority)}</p>
                <p><strong>Created by:</strong> {selectedTicket.user_name}</p>
                <p><strong>Created at:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</p>
              </div>
              <div className="ticket-message">
                <h4>Message:</h4>
                <p>{selectedTicket.message}</p>
              </div>

              {currentUser?.role === "admin" && (
                <div className="status-controls">
                  <h4>Update Status:</h4>
                  <select value={selectedTicket.status} onChange={(e) => updateTicketStatus(selectedTicket.id, e.target.value)}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              )}

              <div className="ticket-replies">
                <h4>Replies ({selectedTicket.replies?.length || 0})</h4>
                {selectedTicket.replies?.map((reply) => (
                  <div key={reply.id} className={`reply ${reply.sender_role}`}>
                    <div className="reply-header">
                      <strong>{reply.sender_name}</strong> <span className="reply-role">({reply.sender_role})</span>
                      <span className="reply-date">{new Date(reply.created_at).toLocaleString()}</span>
                    </div>
                    <div className="reply-message">{reply.message}</div>
                  </div>
                ))}
              </div>

              <div className="reply-form">
                <h4>Add Reply</h4>
                <form onSubmit={submitReply}>
                  <textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} placeholder="Type your reply..." rows="4" required />
                  <button type="submit" className="submit-btn">Send Reply</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Support;
