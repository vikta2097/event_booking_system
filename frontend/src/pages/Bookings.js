import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Bookings.css";

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch bookings
  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get("http://localhost:5000/api/bookings");
      setBookings(res.data);
    } catch (err) {
      setError("Failed to fetch bookings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Update booking status
  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await axios.put(`http://localhost:5000/api/bookings/${bookingId}`, {
        status: newStatus,
      });
      
      // Update local state immediately for better UX
      setBookings(prevBookings =>
        prevBookings.map(booking =>
          booking.id === bookingId
            ? { ...booking, booking_status: newStatus }
            : booking
        )
      );
    } catch (err) {
      setError("Failed to update booking status");
      console.error(err);
      // Refetch to ensure data consistency
      fetchBookings();
    }
  };

  // Delete booking
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this booking?")) return;
    
    try {
      await axios.delete(`http://localhost:3000/api/bookings/${id}`);
      
      // Remove from local state immediately
      setBookings(prevBookings => prevBookings.filter(booking => booking.id !== id));
    } catch (err) {
      setError("Failed to delete booking");
      console.error(err);
      // Refetch to ensure data consistency
      fetchBookings();
    }
  };

  // Filter and search bookings
  const filteredBookings = bookings.filter((booking) => {
    const matchesStatus = filterStatus === "all" || booking.booking_status === filterStatus;
    const matchesSearch =
      booking.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.event_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.user_email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate statistics
  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.booking_status === "pending").length,
    confirmed: bookings.filter((b) => b.booking_status === "confirmed").length,
    cancelled: bookings.filter((b) => b.booking_status === "cancelled").length,
    totalRevenue: bookings
      .filter((b) => b.booking_status === "confirmed")
      .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0),
  };

  return (
    <div className="bookings-container">
      {/* Header */}
      <div className="bookings-header">
        <h2>Manage Bookings</h2>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Bookings</h3>
          <p className="stat-value">{stats.total}</p>
        </div>
        <div className="stat-card pending">
          <h3>Pending</h3>
          <p className="stat-value">{stats.pending}</p>
        </div>
        <div className="stat-card confirmed">
          <h3>Confirmed</h3>
          <p className="stat-value">{stats.confirmed}</p>
        </div>
        <div className="stat-card cancelled">
          <h3>Cancelled</h3>
          <p className="stat-value">{stats.cancelled}</p>
        </div>
        <div className="stat-card revenue">
          <h3>Total Revenue</h3>
          <p className="stat-value">KES {stats.totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by customer name, email, or event..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <button
            className={filterStatus === "all" ? "active" : ""}
            onClick={() => setFilterStatus("all")}
          >
            All
          </button>
          <button
            className={filterStatus === "pending" ? "active" : ""}
            onClick={() => setFilterStatus("pending")}
          >
            Pending
          </button>
          <button
            className={filterStatus === "confirmed" ? "active" : ""}
            onClick={() => setFilterStatus("confirmed")}
          >
            Confirmed
          </button>
          <button
            className={filterStatus === "cancelled" ? "active" : ""}
            onClick={() => setFilterStatus("cancelled")}
          >
            Cancelled
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Bookings Table */}
      {loading ? (
        <p className="loading">Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <p className="no-data">No bookings found.</p>
      ) : filteredBookings.length === 0 ? (
        <p className="no-data">No bookings match your search criteria.</p>
      ) : (
        <div className="table-wrapper">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Event</th>
                <th>Event Date</th>
                <th>Booking Date</th>
                <th>Seats</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <tr key={booking.id}>
                  <td>#{booking.id}</td>
                  <td>
                    <div className="customer-info">
                      <strong>{booking.user_name || "N/A"}</strong>
                      <small>{booking.user_email || "N/A"}</small>
                      {booking.user_phone && <small>{booking.user_phone}</small>}
                    </div>
                  </td>
                  <td>
                    <div className="event-info">
                      <strong>{booking.event_title || "N/A"}</strong>
                      <small>{booking.location || "N/A"}</small>
                    </div>
                  </td>
                  <td>
                    {booking.event_date 
                      ? new Date(booking.event_date).toLocaleDateString() 
                      : "N/A"}
                  </td>
                  <td>
                    {booking.booking_date 
                      ? new Date(booking.booking_date).toLocaleString() 
                      : "N/A"}
                  </td>
                  <td>{booking.seats || 0}</td>
                  <td>KES {parseFloat(booking.total_amount || 0).toLocaleString()}</td>
                  <td>
                    <select
                      className={`status-select ${booking.booking_status}`}
                      value={booking.booking_status}
                      onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(booking.id)}
                      title="Delete booking"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Bookings;