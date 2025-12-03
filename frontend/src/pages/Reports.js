import React, { useEffect, useState } from "react";
import api from "../api"; 
import "../styles/Reports.css";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
  const [analytics, setAnalytics] = useState([]);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", eventId: "", paymentStatus: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchReports = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports", { params: filters });
      setReports(res.data?.reports || []);
      setStats(res.data?.stats || { totalRevenue: 0, totalBookings: 0, totalEvents: 0 });

      // Prepare analytics: group by booking_date and sum revenue/bookings
      const data = {};
      res.data?.reports.forEach(r => {
        const date = new Date(r.booking_date).toLocaleDateString();
        if (!data[date]) data[date] = { date, revenue: 0, bookings: 0 };
        data[date].revenue += parseFloat(r.booking_amount) || 0;
        data[date].bookings += 1;
      });
      setAnalytics(Object.values(data));
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load reports.");
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
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchReports();
  };

  return (
    <div className="reports-container">
      <h2>Detailed Reports & Analytics</h2>

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
        <button type="submit" disabled={loading}>{loading ? "Loading..." : "Filter"}</button>
      </form>

      {error && <p className="error">{error}</p>}

      {analytics.length > 0 && (
        <div className="analytics-chart">
          <h3>Revenue & Bookings Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" name="Revenue (KES)" />
              <Line type="monotone" dataKey="bookings" stroke="#82ca9d" name="Bookings" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

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
            ) : reports.map(r => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
