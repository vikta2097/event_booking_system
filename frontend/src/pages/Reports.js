// src/components/Reports.js
import React, { useEffect, useState, useMemo } from "react";
import api from "../api";
import "../styles/Reports.css";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from "recharts";

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    eventId: "",
    paymentStatus: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30days");
  const [darkMode, setDarkMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch reports
  const fetchReports = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports", { params: filters });
      setReports(res.data?.reports || []);
      setStats(res.data?.stats || { totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
      setAnalytics(res.data?.analytics || null);
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

  // Quick date range selector
  const applyDateRange = (range) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "7days":
        start.setDate(start.getDate() - 7);
        break;
      case "30days":
        start.setDate(start.getDate() - 30);
        break;
      case "90days":
        start.setDate(start.getDate() - 90);
        break;
      case "year":
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        return;
    }

    setDateRange(range);
    setFilters(prev => ({
      ...prev,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    }));
  };

  // Enhance analytics with predictions (optional frontend-only enhancement)
  const enhancedAnalytics = useMemo(() => {
    if (!analytics?.timeSeriesData || analytics.timeSeriesData.length < 3) return analytics;

    const timeSeriesWithPredictions = [...analytics.timeSeriesData];
    const n = timeSeriesWithPredictions.length;
    
    // Simple linear regression for revenue predictions
    const sumX = timeSeriesWithPredictions.reduce((sum, _, i) => sum + i, 0);
    const sumY = timeSeriesWithPredictions.reduce((sum, d) => sum + d.revenue, 0);
    const sumXY = timeSeriesWithPredictions.reduce((sum, d, i) => sum + (i * d.revenue), 0);
    const sumX2 = timeSeriesWithPredictions.reduce((sum, _, i) => sum + (i * i), 0);

    const denom = (n * sumX2 - sumX * sumX);
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    timeSeriesWithPredictions.forEach((d, i) => {
      d.prediction = Math.max(0, slope * i + intercept);
    });

    return {
      ...analytics,
      timeSeriesData: timeSeriesWithPredictions
    };
  }, [analytics]);

  // AI-Powered Insights
  const insights = useMemo(() => {
    if (!enhancedAnalytics || !reports || reports.length === 0) return [];

    const items = [];

    if (enhancedAnalytics.revenueGrowth > 10) {
      items.push({
        type: 'positive',
        title: 'Strong Revenue Growth',
        message: `Revenue is up ${enhancedAnalytics.revenueGrowth}% compared to the previous period. Keep up the momentum!`
      });
    } else if (enhancedAnalytics.revenueGrowth < -10) {
      items.push({
        type: 'warning',
        title: 'Revenue Decline Detected',
        message: `Revenue is down ${Math.abs(enhancedAnalytics.revenueGrowth)}%. Consider campaigns or reviewing pricing.`
      });
    }

    if (enhancedAnalytics.bookingsGrowth > 15) {
      items.push({
        type: 'positive',
        title: 'Booking Surge',
        message: `Bookings increased by ${enhancedAnalytics.bookingsGrowth}%. Marketing is working.`
      });
    }

    const failedPayments = enhancedAnalytics.paymentStatus?.find(p => p.name.toLowerCase() === 'failed');
    if (failedPayments && failedPayments.percentage > 5) {
      items.push({
        type: 'alert',
        title: 'High Payment Failure Rate',
        message: `${failedPayments.percentage.toFixed(1)}% of payments are failing. Check gateway.`
      });
    }

    // Best performing day
    if (enhancedAnalytics.dayOfWeekData && enhancedAnalytics.dayOfWeekData.length > 0) {
      const bestDay = enhancedAnalytics.dayOfWeekData.reduce((best, current) =>
        current.revenue > (best.revenue || 0) ? current : best, { revenue: 0 });
      if (bestDay && bestDay.revenue > 0) {
        items.push({
          type: 'info',
          title: 'Peak Performance Day',
          message: `${bestDay.day} generates the most revenue (KES ${bestDay.revenue.toLocaleString()}).`
        });
      }
    }

    if (enhancedAnalytics.suspiciousBookings && enhancedAnalytics.suspiciousBookings.length > 0) {
      items.push({
        type: 'alert',
        title: 'Potential Fraud Detected',
        message: `${enhancedAnalytics.suspiciousBookings.length} bookings show unusual patterns. Review them.`
      });
    }

    if (enhancedAnalytics.eventPerformance && enhancedAnalytics.eventPerformance.length > 0) {
      const topEvent = enhancedAnalytics.eventPerformance[0];
      items.push({
        type: 'info',
        title: 'Best Performing Event',
        message: `"${topEvent.name}" leads with ${topEvent.bookings} bookings and KES ${topEvent.revenue.toLocaleString()} revenue.`
      });
    }

    return items;
  }, [enhancedAnalytics, reports]);

  // Chart colors
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Export to CSV
  const exportToCSV = () => {
    if (!reports || reports.length === 0) return;

    const headers = ['Booking ID', 'User', 'Event', 'Event Date', 'Seats', 'Booking Date', 'Amount', 'Payment Status', 'Booking Status'];
    const rows = reports.map(r => [
      r.booking_id || '',
      r.user_name || '',
      r.event_title || '',
      r.event_date ? new Date(r.event_date).toLocaleDateString() : '',
      r.seats || '',
      r.booking_date ? new Date(r.booking_date).toLocaleDateString() : '',
      parseFloat(r.booking_amount || r.payment_amount || 0),
      r.payment_status || '',
      r.booking_status || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-reports-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchReports();
  };

  const resetFilters = () => {
    setFilters({ startDate: "", endDate: "", eventId: "", paymentStatus: "" });
    setDateRange("30days");
    fetchReports();
  };

  // small helpers
  const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;

  return (
    <div className={`modern-reports-container ${darkMode ? 'dark-mode' : ''}`}>
      {/* Header */}
      <div className="reports-header">
        <div>
          <h2 className="reports-title">Analytics & Reports</h2>
          <p className="reports-subtitle">Comprehensive insights into your event performance</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setDarkMode(!darkMode)} className="icon-btn" title="Toggle Dark Mode">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={exportToCSV} className="btn-secondary" disabled={!reports || reports.length === 0}>
            📥 Export CSV
          </button>
          <button onClick={fetchReports} className="btn-primary" disabled={loading}>
            {loading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Quick Date Range Selector */}
      <div className="date-range-selector">
        {['today', '7days', '30days', '90days', 'year'].map(range => (
          <button
            key={range}
            className={`range-btn ${dateRange === range ? 'active' : ''}`}
            onClick={() => applyDateRange(range)}
          >
            {range === 'today' ? 'Today' : range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : range === '90days' ? '90 Days' : '1 Year'}
          </button>
        ))}
        <button className="range-btn" onClick={() => setShowFilters(!showFilters)}>
          🔍 Advanced Filters
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <form className="advanced-filters" onSubmit={handleFilterSubmit}>
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
          <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange}>
            <option value="">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <div className="filter-buttons">
            <button type="submit" className="btn-primary" disabled={loading}>
              Apply Filters
            </button>
            <button type="button" className="btn-secondary" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="alert alert-error">
          ⚠️ {error}
        </div>
      )}

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <div className="insights-section">
          <h3 className="section-title">🤖 AI-Powered Insights</h3>
          <div className="insights-grid">
            {insights.map((insight, idx) => (
              <div key={idx} className={`insight-card insight-${insight.type}`}>
                <div className="insight-icon">
                  {insight.type === 'positive' ? '✅' : insight.type === 'warning' ? '⚠️' : insight.type === 'alert' ? '🚨' : 'ℹ️'}
                </div>
                <div>
                  <h4 className="insight-title">{insight.title}</h4>
                  <p className="insight-message">{insight.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {enhancedAnalytics && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">💰</div>
            <div className="stat-content">
              <p className="stat-label">Total Revenue</p>
              <h3 className="stat-value">{formatCurrency(stats.totalRevenue || 0)}</h3>
              <p className={`stat-trend ${enhancedAnalytics.revenueGrowth >= 0 ? 'positive' : 'negative'}`}>
                {enhancedAnalytics.revenueGrowth >= 0 ? '↗' : '↘'} {Math.abs(enhancedAnalytics.revenueGrowth)}% vs previous period
              </p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🎫</div>
            <div className="stat-content">
              <p className="stat-label">Total Bookings</p>
              <h3 className="stat-value">{stats.totalBookings || 0}</h3>
              <p className={`stat-trend ${enhancedAnalytics.bookingsGrowth >= 0 ? 'positive' : 'negative'}`}>
                {enhancedAnalytics.bookingsGrowth >= 0 ? '↗' : '↘'} {Math.abs(enhancedAnalytics.bookingsGrowth)}% vs previous period
              </p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <p className="stat-label">Total Events</p>
              <h3 className="stat-value">{stats.totalEvents || 0}</h3>
              <p className="stat-trend neutral">Active events tracked</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <p className="stat-label">Avg Booking Value</p>
              <h3 className="stat-value">{formatCurrency(enhancedAnalytics.avgBookingValue)}</h3>
              <p className="stat-trend neutral">Per booking average</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📈 Overview
          </button>
          <button
            className={`tab ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            🎪 Events
          </button>
          <button
            className={`tab ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            💳 Payments
          </button>
          <button
            className={`tab ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            📉 Trends
          </button>
          <button
            className={`tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            📋 Raw Data
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {enhancedAnalytics && (
        <div className="tab-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-content">
              <div className="chart-grid">
                <div className="chart-card full-width">
                  <h3 className="chart-title">Revenue & Bookings Trend with Predictions</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={enhancedAnalytics.timeSeriesData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name="Revenue (KES)" />
                      <Area type="monotone" dataKey="bookings" stroke="#10b981" fillOpacity={1} fill="url(#colorBookings)" name="Bookings" />
                      <Line type="monotone" dataKey="prediction" stroke="#f59e0b" strokeDasharray="5 5" name="Predicted Revenue" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3 className="chart-title">Bookings by Day of Week</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={enhancedAnalytics.dayOfWeekData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="day" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                      <Bar dataKey="bookings" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3 className="chart-title">Payment Status Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={enhancedAnalytics.paymentStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={entry => `${entry.name}: ${entry.percentage}%`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {enhancedAnalytics.paymentStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div className="events-content">
              <h3 className="section-title">Top Performing Events</h3>
              <div className="chart-card full-width">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={enhancedAnalytics.eventPerformance} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#6b7280" />
                    <YAxis dataKey="name" type="category" width={180} stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (KES)" radius={[0, 8, 8, 0]} />
                    <Bar dataKey="bookings" fill="#10b981" name="Bookings" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="events-table">
                <table>
                  <thead>
                    <tr>
                      <th>Event Name</th>
                      <th>Bookings</th>
                      <th>Revenue</th>
                      <th>Avg per Booking</th>
                      <th>Event Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enhancedAnalytics.eventPerformance.map((event, idx) => (
                      <tr key={event.id || idx}>
                        <td><strong>{event.name}</strong></td>
                        <td>{event.bookings}</td>
                        <td>{formatCurrency(event.revenue)}</td>
                        <td>{event.bookings > 0 ? formatCurrency(event.revenue / event.bookings) : formatCurrency(0)}</td>
                        <td>{event.date ? new Date(event.date).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="payments-content">
              <div className="chart-grid">
                <div className="chart-card">
                  <h3 className="chart-title">Payment Status Breakdown</h3>
                  <div className="payment-stats">
                    {enhancedAnalytics.paymentStatus.map((status, idx) => (
                      <div key={idx} className="payment-stat-item">
                        <div className="payment-stat-bar" style={{ width: `${Math.min(100, Math.round(status.percentage))}%`, backgroundColor: COLORS[idx] }} />
                        <div className="payment-stat-info">
                          <span className="payment-stat-name">{status.name}</span>
                          <span className="payment-stat-count">{status.value} ({status.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="chart-card">
                  <h3 className="chart-title">Booking Status</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={enhancedAnalytics.bookingStatus}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={entry => `${entry.name}: ${entry.value}`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {enhancedAnalytics.bookingStatus.map((entry, index) => (
                          <Cell key={`cell-booking-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {enhancedAnalytics.suspiciousBookings && enhancedAnalytics.suspiciousBookings.length > 0 && (
                <div className="suspicious-bookings">
                  <h3 className="section-title">⚠️ Suspicious Bookings ({enhancedAnalytics.suspiciousBookings.length})</h3>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Booking ID</th>
                          <th>User</th>
                          <th>Event</th>
                          <th>Amount</th>
                          <th>Payment Status</th>
                          <th>Booking Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enhancedAnalytics.suspiciousBookings.map((s, i) => (
                          <tr key={s.booking_id || i}>
                            <td>{s.booking_id || '—'}</td>
                            <td>{s.user_name || '—'}</td>
                            <td>{s.event_title || '—'}</td>
                            <td>{formatCurrency(s.booking_amount || s.payment_amount)}</td>
                            <td>{s.payment_status || '—'}</td>
                            <td>{s.booking_status || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="trends-content">
              <h3 className="section-title">Trends & Predictions</h3>
              <div className="chart-card full-width">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={enhancedAnalytics.timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" dot={false} name="Revenue (KES)" />
                    <Line type="monotone" dataKey="prediction" stroke="#f59e0b" strokeDasharray="5 5" dot={false} name="Predicted Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === 'data' && (
            <div className="data-content">
              <h3 className="section-title">Raw Booking Data</h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>User</th>
                      <th>Event</th>
                      <th>Amount</th>
                      <th>Booking Date</th>
                      <th>Payment Status</th>
                      <th>Booking Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r, idx) => (
                      <tr key={r.booking_id || idx}>
                        <td>{r.booking_id || '—'}</td>
                        <td>{r.user_name || '—'}</td>
                        <td>{r.event_title || '—'}</td>
                        <td>{formatCurrency(r.booking_amount || r.payment_amount)}</td>
                        <td>{r.booking_date ? new Date(r.booking_date).toLocaleString() : '—'}</td>
                        <td>{r.payment_status || '—'}</td>
                        <td>{r.booking_status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!enhancedAnalytics && !loading && (
        <div className="empty-state">
          <p>No report data available. Try changing the date range or refresh.</p>
        </div>
      )}
    </div>
  );
};

export default Reports;