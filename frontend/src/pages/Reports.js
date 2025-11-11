import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Reports.css";

const Reports = ({ currentUser }) => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    eventId: "",
    paymentStatus: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch reports with filters
  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication token missing. Please log in again.");
        return;
      }

      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.eventId) params.eventId = filters.eventId;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;

      const res = await axios.get("http://localhost:3300/api/reports", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setReports(res.data.reports);
      setStats(res.data.stats);
    } catch (err) {
      console.error("Error fetching reports:", err);
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchReports();
  };

  return (
    <div className="reports-container">
      <h2>Detailed Reports</h2>

      <form className="report-filters" onSubmit={handleFilterSubmit}>
        <input
          type="date"
          name="startDate"
          value={filters.startDate}
          onChange={handleFilterChange}
        />
        <input
          type="date"
          name="endDate"
          value={filters.endDate}
          onChange={handleFilterChange}
        />
        <input
          type="text"
          name="eventId"
          placeholder="Event ID"
          value={filters.eventId}
          onChange={handleFilterChange}
        />
        <select
          name="paymentStatus"
          value={filters.paymentStatus}
          onChange={handleFilterChange}
        >
          <option value="">All Payments</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Filter"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="report-stats">
        <div>
          <strong>Total Revenue:</strong> KES {stats.totalRevenue.toLocaleString()}
        </div>
        <div>
          <strong>Total Bookings:</strong> {stats.totalBookings}
        </div>
        <div>
          <strong>Total Events:</strong> {stats.totalEvents}
        </div>
      </div>

      <table className="report-table">
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>User</th>
            <th>Event</th>
            <th>Event Date</th>
            <th>Seats</th>
            <th>Booking Date</th>
            <th>Amount</th>
            <th>Payment</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr><td colSpan="9">No records found.</td></tr>
          ) : (
            reports.map((r) => (
              <tr key={r.booking_id}>
                <td>{r.booking_id}</td>
                <td>{r.user_name}</td>
                <td>{r.event_title}</td>
                <td>{new Date(r.event_date).toLocaleDateString()}</td>
                <td>{r.seats}</td>
                <td>{new Date(r.booking_date).toLocaleDateString()}</td>
                <td>KES {r.booking_amount}</td>
                <td>{r.payment_status || "N/A"}</td>
                <td>{r.booking_status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Reports;
