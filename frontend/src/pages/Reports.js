import React, { useEffect, useState } from "react";
import api from "../api"; // centralized axios instance
import "../styles/Reports.css";

const Reports = ({ currentUser }) => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
  const [filters, setFilters] = useState({ startDate: "", endDate: "", eventId: "", paymentStatus: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/reports", { params: filters });
        setReports(res.data?.reports || []);
        setStats(res.data?.stats || { totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || "Failed to load reports.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    // Re-fetch reports with new filters
    const fetchFilteredReports = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/reports", { params: filters });
        setReports(res.data?.reports || []);
        setStats(res.data?.stats || { totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || "Failed to load reports.");
      } finally {
        setLoading(false);
      }
    };
    fetchFilteredReports();
  };

  return (
    <div className="reports-container">
      <h2>Detailed Reports</h2>

      <form className="report-filters" onSubmit={handleFilterSubmit}>
        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
        <input type="text" name="eventId" placeholder="Event ID" value={filters.eventId} onChange={handleFilterChange} />
        <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange}>
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
        <div><strong>Total Revenue:</strong> KES {parseFloat(stats.totalRevenue || 0).toLocaleString()}</div>
        <div><strong>Total Bookings:</strong> {stats.totalBookings || 0}</div>
        <div><strong>Total Events:</strong> {stats.totalEvents || 0}</div>
      </div>

      <div className="table-wrapper">
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
                  <td>{r.user_name || "N/A"}</td>
                  <td>{r.event_title || "N/A"}</td>
                  <td>{r.event_date ? new Date(r.event_date).toLocaleDateString() : "N/A"}</td>
                  <td>{r.seats || 0}</td>
                  <td>{r.booking_date ? new Date(r.booking_date).toLocaleDateString() : "N/A"}</td>
                  <td>KES {parseFloat(r.booking_amount || 0).toLocaleString()}</td>
                  <td>{r.payment_status || "N/A"}</td>
                  <td>{r.booking_status || "N/A"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
