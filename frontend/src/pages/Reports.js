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
      case "today": start.setHours(0, 0, 0, 0); break;
      case "7days": start.setDate(start.getDate() - 7); break;
      case "30days": start.setDate(start.getDate() - 30); break;
      case "90days": start.setDate(start.getDate() - 90); break;
      case "year": start.setFullYear(start.getFullYear() - 1); break;
      default: return;
    }

    setDateRange(range);
    setFilters(prev => ({
      ...prev,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    }));
  };

  // Enhanced analytics with predictions
  const enhancedAnalytics = useMemo(() => {
    if (!analytics) return null;

    const safeAnalytics = {
      timeSeriesData: analytics.timeSeriesData || [],
      dayOfWeekData: analytics.dayOfWeekData || [],
      paymentStatus: analytics.paymentStatus || [],
      bookingStatus: analytics.bookingStatus || [],
      eventPerformance: analytics.eventPerformance || [],
      suspiciousBookings: analytics.suspiciousBookings || [],
      revenueGrowth: analytics.revenueGrowth || 0,
      bookingsGrowth: analytics.bookingsGrowth || 0,
      avgBookingValue: analytics.avgBookingValue || 0
    };

    if (safeAnalytics.timeSeriesData.length < 3) return safeAnalytics;

    // Simple linear regression for predictions
    const data = [...safeAnalytics.timeSeriesData];
    const n = data.length;
    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.revenue, 0);
    const sumXY = data.reduce((sum, d, i) => sum + (i * d.revenue), 0);
    const sumX2 = data.reduce((sum, _, i) => sum + (i * i), 0);

    const denom = (n * sumX2 - sumX * sumX);
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    data.forEach((d, i) => d.prediction = Math.max(0, slope * i + intercept));

    return { ...safeAnalytics, timeSeriesData: data };
  }, [analytics]);

  // AI-Powered Insights
  const insights = useMemo(() => {
    if (!enhancedAnalytics || !reports || reports.length === 0) return [];

    const items = [];

    if (enhancedAnalytics.revenueGrowth > 10) {
      items.push({
        type: 'positive',
        title: 'Strong Revenue Growth',
        message: `Revenue is up ${enhancedAnalytics.revenueGrowth}% compared to previous period.`
      });
    } else if (enhancedAnalytics.revenueGrowth < -10) {
      items.push({
        type: 'warning',
        title: 'Revenue Decline Detected',
        message: `Revenue is down ${Math.abs(enhancedAnalytics.revenueGrowth)}%.`
      });
    }

    if (enhancedAnalytics.bookingsGrowth > 15) {
      items.push({
        type: 'positive',
        title: 'Booking Surge',
        message: `Bookings increased by ${enhancedAnalytics.bookingsGrowth}%.`
      });
    }

    const failedPayments = enhancedAnalytics.paymentStatus.find(p => p.name.toLowerCase() === 'failed');
    if (failedPayments && failedPayments.percentage > 5) {
      items.push({
        type: 'alert',
        title: 'High Payment Failure Rate',
        message: `${failedPayments.percentage.toFixed(1)}% of payments are failing.`
      });
    }

    const bestDay = enhancedAnalytics.dayOfWeekData.reduce((best, current) =>
      current.revenue > (best.revenue || 0) ? current : best, { revenue: 0 });
    if (bestDay?.revenue > 0) {
      items.push({
        type: 'info',
        title: 'Peak Performance Day',
        message: `${bestDay.day} generates the most revenue (KES ${bestDay.revenue.toLocaleString()}).`
      });
    }

    if (enhancedAnalytics.suspiciousBookings.length > 0) {
      items.push({
        type: 'alert',
        title: 'Potential Fraud Detected',
        message: `${enhancedAnalytics.suspiciousBookings.length} bookings show unusual patterns.`
      });
    }

    if (enhancedAnalytics.eventPerformance.length > 0) {
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

  const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;

  // Safe references for rendering
  const safeEnhancedAnalytics = enhancedAnalytics || {
    timeSeriesData: [],
    dayOfWeekData: [],
    paymentStatus: [],
    bookingStatus: [],
    eventPerformance: [],
    suspiciousBookings: [],
    revenueGrowth: 0,
    bookingsGrowth: 0,
    avgBookingValue: 0
  };

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
          <button onClick={exportToCSV} className="btn-secondary" disabled={!reports.length}>
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
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
          <input type="text" name="eventId" placeholder="Event ID" value={filters.eventId} onChange={handleFilterChange} />
          <select name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange}>
            <option value="">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <div className="filter-buttons">
            <button type="submit" className="btn-primary" disabled={loading}>Apply Filters</button>
            <button type="button" className="btn-secondary" onClick={resetFilters}>Reset</button>
          </div>
        </form>
      )}

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* AI Insights */}
      {insights.length > 0 && (
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
              <h3 className="stat-value">{formatCurrency(stats.totalRevenue)}</h3>
              <p className={`stat-trend ${safeEnhancedAnalytics.revenueGrowth >= 0 ? 'positive' : 'negative'}`}>
                {safeEnhancedAnalytics.revenueGrowth >= 0 ? '↗' : '↘'} {Math.abs(safeEnhancedAnalytics.revenueGrowth)}% vs previous period
              </p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎫</div>
            <div className="stat-content">
              <p className="stat-label">Total Bookings</p>
              <h3 className="stat-value">{stats.totalBookings}</h3>
              <p className={`stat-trend ${safeEnhancedAnalytics.bookingsGrowth >= 0 ? 'positive' : 'negative'}`}>
                {safeEnhancedAnalytics.bookingsGrowth >= 0 ? '↗' : '↘'} {Math.abs(safeEnhancedAnalytics.bookingsGrowth)}% vs previous period
              </p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <p className="stat-label">Total Events</p>
              <h3 className="stat-value">{stats.totalEvents}</h3>
              <p className="stat-trend neutral">Active events tracked</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <p className="stat-label">Avg Booking Value</p>
              <h3 className="stat-value">{formatCurrency(safeEnhancedAnalytics.avgBookingValue)}</h3>
              <p className="stat-trend neutral">Per booking average</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          {['overview','events','payments','trends','data'].map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' ? '📈 Overview' :
               tab === 'events' ? '🎪 Events' :
               tab === 'payments' ? '💳 Payments' :
               tab === 'trends' ? '📉 Trends' : '📋 Raw Data'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {enhancedAnalytics && (
        <div className="tab-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-content">
              <div className="chart-grid">
                {/* Revenue & Bookings Trend */}
                <div className="chart-card full-width">
                  <h3 className="chart-title">Revenue & Bookings Trend with Predictions</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={safeEnhancedAnalytics.timeSeriesData}>
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
                      <Line type="monotone" dataKey="prediction" stroke="#f59e0b" strokeDasharray="5 5" name="Revenue Prediction" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Payment Status Pie */}
                <div className="chart-card">
                  <h3 className="chart-title">Payment Status</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={safeEnhancedAnalytics.paymentStatus}
                        dataKey="percentage"
                        nameKey="name"
                        outerRadius={80}
                        label
                      >
                        {safeEnhancedAnalytics.paymentStatus.map((entry, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Booking Status Pie */}
                <div className="chart-card">
                  <h3 className="chart-title">Booking Status</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={safeEnhancedAnalytics.bookingStatus}
                        dataKey="percentage"
                        nameKey="name"
                        outerRadius={80}
                        label
                      >
                        {safeEnhancedAnalytics.bookingStatus.map((entry, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
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
            <div className="table-card">
              <h3 className="chart-title">Events Performance</h3>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Bookings</th>
                    <th>Revenue (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {safeEnhancedAnalytics.eventPerformance.map((event, idx) => (
                    <tr key={idx}>
                      <td>{event.name}</td>
                      <td>{event.bookings}</td>
                      <td>{formatCurrency(event.revenue)}</td>
                    </tr>
                  ))}
                  {safeEnhancedAnalytics.eventPerformance.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center' }}>No events data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Suspicious Bookings Tab */}
          {activeTab === 'trends' && (
            <div className="table-card">
              <h3 className="chart-title">Suspicious Bookings</h3>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>User</th>
                    <th>Event</th>
                    <th>Amount</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {safeEnhancedAnalytics.suspiciousBookings.map((b, idx) => (
                    <tr key={idx}>
                      <td>{b.booking_id}</td>
                      <td>{b.user_name}</td>
                      <td>{b.event_title}</td>
                      <td>{formatCurrency(b.amount)}</td>
                      <td>{b.reason}</td>
                    </tr>
                  ))}
                  {safeEnhancedAnalytics.suspiciousBookings.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center' }}>No suspicious bookings</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === 'data' && (
            <div className="table-card">
              <h3 className="chart-title">Raw Bookings Data</h3>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>User</th>
                    <th>Event</th>
                    <th>Seats</th>
                    <th>Booking Date</th>
                    <th>Amount</th>
                    <th>Payment Status</th>
                    <th>Booking Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, idx) => (
                    <tr key={idx}>
                      <td>{r.booking_id}</td>
                      <td>{r.user_name}</td>
                      <td>{r.event_title}</td>
                      <td>{r.seats}</td>
                      <td>{r.booking_date ? new Date(r.booking_date).toLocaleDateString() : ''}</td>
                      <td>{formatCurrency(r.payment_amount || r.booking_amount)}</td>
                      <td>{r.payment_status}</td>
                      <td>{r.booking_status}</td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center' }}>No booking data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
