import React, { useEffect, useState, useMemo } from "react";
import api from "../api";
import "../styles/Reports.css";
import {
  Line,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart
} from "recharts";
import jsPDF from "jspdf";
import "jspdf-autotable";

const OrganizerReports = ({ currentUser }) => {
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
  const [compareMode, setCompareMode] = useState(false);
  const [previousPeriodData, setPreviousPeriodData] = useState(null);

  // Fetch reports for organizer's events only
  const fetchReports = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports/organizer", { params: filters });
      setReports(res.data?.reports || []);
      setStats(res.data?.stats || { totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
      setAnalytics(res.data?.analytics || null);

      // Fetch comparison data if compare mode is on
      if (compareMode && filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        const diff = end - start;
        const prevStart = new Date(start.getTime() - diff);
        const prevEnd = new Date(start);

        const prevRes = await api.get("/reports/organizer", {
          params: {
            ...filters,
            startDate: prevStart.toISOString().split('T')[0],
            endDate: prevEnd.toISOString().split('T')[0]
          }
        });
        setPreviousPeriodData(prevRes.data);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
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
      case "custom":
        return;
      default:
        return;
    }

    setDateRange(range);
    setFilters((prev) => ({
      ...prev,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    }));
  };

  // Enhanced analytics with predictions
  const enhancedAnalytics = useMemo(() => {
    if (!analytics) return null;

    const safeAnalytics = {
      timeSeriesData: analytics.timeSeriesData || [],
      dayOfWeekData: analytics.dayOfWeekData || [],
      hourlyData: analytics.hourlyData || [],
      paymentStatus: analytics.paymentStatus || [],
      bookingStatus: analytics.bookingStatus || [],
      eventPerformance: analytics.eventPerformance || [],
      ticketTypePerformance: analytics.ticketTypePerformance || [],
      demographicsData: analytics.demographicsData || [],
      revenueGrowth: analytics.revenueGrowth || 0,
      bookingsGrowth: analytics.bookingsGrowth || 0,
      avgBookingValue: analytics.avgBookingValue || 0,
      conversionRate: analytics.conversionRate || 0,
    };

    if (safeAnalytics.timeSeriesData.length < 3) return safeAnalytics;

    // Simple linear regression for predictions
    const data = [...safeAnalytics.timeSeriesData];
    const n = data.length;
    const sumX = data.reduce((sum, _, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.revenue, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.revenue, 0);
    const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);

    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    // Add predictions for next 7 days
    const lastDate = new Date(data[data.length - 1].date);
    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(lastDate);
      nextDate.setDate(lastDate.getDate() + i);
      data.push({
        date: nextDate.toISOString().split("T")[0],
        revenue: 0,
        bookings: 0,
        prediction: Math.max(0, slope * (n + i - 1) + intercept),
      });
    }

    return { ...safeAnalytics, timeSeriesData: data };
  }, [analytics]);

  // AI-Powered Insights
  const insights = useMemo(() => {
    if (!enhancedAnalytics || !reports || reports.length === 0) return [];

    const items = [];

    if (enhancedAnalytics.revenueGrowth > 10) {
      items.push({
        type: "positive",
        title: "Strong Revenue Growth",
        message: `Your events revenue is up ${enhancedAnalytics.revenueGrowth.toFixed(1)}% compared to previous period.`,
      });
    } else if (enhancedAnalytics.revenueGrowth < -10) {
      items.push({
        type: "warning",
        title: "Revenue Decline Detected",
        message: `Your events revenue is down ${Math.abs(enhancedAnalytics.revenueGrowth).toFixed(1)}%. Consider promotional campaigns.`,
      });
    }

    if (enhancedAnalytics.bookingsGrowth > 15) {
      items.push({
        type: "positive",
        title: "Booking Surge",
        message: `Bookings for your events increased by ${enhancedAnalytics.bookingsGrowth.toFixed(1)}%.`,
      });
    }

    if (enhancedAnalytics.conversionRate > 0) {
      if (enhancedAnalytics.conversionRate < 2) {
        items.push({
          type: "warning",
          title: "Low Conversion Rate",
          message: `Only ${enhancedAnalytics.conversionRate.toFixed(1)}% of views convert to bookings. Consider improving event descriptions and pricing.`,
        });
      } else if (enhancedAnalytics.conversionRate > 5) {
        items.push({
          type: "positive",
          title: "Excellent Conversion Rate",
          message: `${enhancedAnalytics.conversionRate.toFixed(1)}% conversion rate is above industry average!`,
        });
      }
    }

    const bestDay = enhancedAnalytics.dayOfWeekData.reduce(
      (best, current) => (current.revenue > (best.revenue || 0) ? current : best),
      { revenue: 0 }
    );
    if (bestDay?.revenue > 0) {
      items.push({
        type: "info",
        title: "Peak Performance Day",
        message: `${bestDay.day} generates the most revenue (KES ${bestDay.revenue.toLocaleString()}). Schedule more events on this day.`,
      });
    }

    if (enhancedAnalytics.hourlyData && enhancedAnalytics.hourlyData.length > 0) {
      const peakHour = enhancedAnalytics.hourlyData.reduce(
        (best, current) => (current.bookings > (best.bookings || 0) ? current : best),
        { bookings: 0 }
      );
      if (peakHour?.bookings > 0) {
        items.push({
          type: "info",
          title: "Peak Booking Hour",
          message: `Most bookings happen at ${peakHour.hour}:00. Consider sending promotions before this time.`,
        });
      }
    }

    if (enhancedAnalytics.eventPerformance.length > 0) {
      const topEvent = enhancedAnalytics.eventPerformance[0];
      items.push({
        type: "info",
        title: "Best Performing Event",
        message: `"${topEvent.name}" leads with ${topEvent.bookings} bookings and KES ${topEvent.revenue.toLocaleString()} revenue.`,
      });

      const lowPerformer = enhancedAnalytics.eventPerformance[enhancedAnalytics.eventPerformance.length - 1];
      if (lowPerformer.bookings < 5) {
        items.push({
          type: "alert",
          title: "Underperforming Event",
          message: `"${lowPerformer.name}" only has ${lowPerformer.bookings} bookings. Consider boosting promotion or adjusting pricing.`,
        });
      }
    }

    return items;
  }, [enhancedAnalytics, reports]);

  // Chart colors
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  // Export to CSV
  const exportToCSV = () => {
    if (!reports || reports.length === 0) return;

    const headers = [
      "Booking ID",
      "User",
      "Event",
      "Event Date",
      "Seats",
      "Booking Date",
      "Amount",
      "Payment Status",
      "Booking Status",
    ];
    const rows = reports.map((r) => [
      r.booking_id || "",
      r.user_name || "",
      r.event_title || "",
      r.event_date ? new Date(r.event_date).toLocaleDateString() : "",
      r.seats || "",
      r.booking_date ? new Date(r.booking_date).toLocaleDateString() : "",
      parseFloat(r.booking_amount || r.payment_amount || 0),
      r.payment_status || "",
      r.booking_status || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `organizer-reports-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Title
    doc.setFontSize(18);
    doc.text("Event Performance Report", pageWidth / 2, 15, { align: "center" });

    // Date range
    doc.setFontSize(10);
    doc.text(
      `Period: ${filters.startDate || "All time"} to ${filters.endDate || new Date().toISOString().split("T")[0]}`,
      pageWidth / 2,
      22,
      { align: "center" }
    );

    // Summary stats
    doc.setFontSize(12);
    doc.text(`Total Revenue: KES ${stats.totalRevenue.toLocaleString()}`, 14, 35);
    doc.text(`Total Bookings: ${stats.totalBookings}`, 14, 42);
    doc.text(`Total Events: ${stats.totalEvents}`, 14, 49);

    // Event performance table
    if (enhancedAnalytics && enhancedAnalytics.eventPerformance.length > 0) {
      doc.text("Event Performance", 14, 60);
      doc.autoTable({
        startY: 65,
        head: [["Event", "Bookings", "Revenue (KES)"]],
        body: enhancedAnalytics.eventPerformance.map((e) => [
          e.name,
          e.bookings,
          e.revenue.toLocaleString(),
        ]),
      });
    }

    // Raw bookings data
    if (reports.length > 0) {
      doc.addPage();
      doc.text("Bookings Data", 14, 15);
      doc.autoTable({
        startY: 20,
        head: [["Booking ID", "User", "Event", "Seats", "Amount", "Status"]],
        body: reports.map((r) => [
          r.booking_id,
          r.user_name,
          r.event_title,
          r.seats,
          Number(r.payment_amount || r.booking_amount).toLocaleString(),
          r.payment_status,
        ]),
      });
    }

    doc.save(`organizer-report-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
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
    hourlyData: [],
    paymentStatus: [],
    bookingStatus: [],
    eventPerformance: [],
    ticketTypePerformance: [],
    demographicsData: [],
    revenueGrowth: 0,
    bookingsGrowth: 0,
    avgBookingValue: 0,
    conversionRate: 0,
  };

  return (
    <div className={`modern-reports-container ${darkMode ? "dark-mode" : ""}`}>
      {/* Header */}
      <div className="reports-header">
        <div>
          <h2 className="reports-title">Event Analytics Dashboard</h2>
          <p className="reports-subtitle">Performance insights for your events</p>
        </div>
        <div className="header-actions">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="icon-btn"
            title="Toggle Dark Mode"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`icon-btn ${compareMode ? "active" : ""}`}
            title="Compare Periods"
          >
            📊
          </button>
          <button onClick={exportToPDF} className="btn-secondary" disabled={!reports.length}>
            📄 Export PDF
          </button>
          <button onClick={exportToCSV} className="btn-secondary" disabled={!reports.length}>
            📥 Export CSV
          </button>
          <button onClick={fetchReports} className="btn-primary" disabled={loading}>
            {loading ? "⏳ Loading..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {/* Quick Date Range Selector */}
      <div className="date-range-selector">
        {["today", "7days", "30days", "90days", "year"].map((range) => (
          <button
            key={range}
            className={`range-btn ${dateRange === range ? "active" : ""}`}
            onClick={() => applyDateRange(range)}
          >
            {range === "today"
              ? "Today"
              : range === "7days"
              ? "7 Days"
              : range === "30days"
              ? "30 Days"
              : range === "90days"
              ? "90 Days"
              : "1 Year"}
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
            placeholder="Start Date"
          />
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            placeholder="End Date"
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

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="insights-section">
          <h3 className="section-title">🤖 AI-Powered Insights</h3>
          <div className="insights-grid">
            {insights.map((insight, idx) => (
              <div key={idx} className={`insight-card insight-${insight.type}`}>
                <div className="insight-icon">
                  {insight.type === "positive"
                    ? "✅"
                    : insight.type === "warning"
                    ? "⚠️"
                    : insight.type === "alert"
                    ? "🚨"
                    : "ℹ️"}
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
              <p
                className={`stat-trend ${
                  safeEnhancedAnalytics.revenueGrowth >= 0 ? "positive" : "negative"
                }`}
              >
                {safeEnhancedAnalytics.revenueGrowth >= 0 ? "↗" : "↘"}{" "}
                {Math.abs(safeEnhancedAnalytics.revenueGrowth).toFixed(1)}% vs previous period
              </p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🎫</div>
            <div className="stat-content">
              <p className="stat-label">Total Bookings</p>
              <h3 className="stat-value">{stats.totalBookings}</h3>
              <p
                className={`stat-trend ${
                  safeEnhancedAnalytics.bookingsGrowth >= 0 ? "positive" : "negative"
                }`}
              >
                {safeEnhancedAnalytics.bookingsGrowth >= 0 ? "↗" : "↘"}{" "}
                {Math.abs(safeEnhancedAnalytics.bookingsGrowth).toFixed(1)}% vs previous period
              </p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-content">
              <p className="stat-label">My Events</p>
              <h3 className="stat-value">{stats.totalEvents}</h3>
              <p className="stat-trend neutral">Active events</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <p className="stat-label">Avg Booking Value</p>
              <h3 className="stat-value">
                {formatCurrency(safeEnhancedAnalytics.avgBookingValue)}
              </h3>
              <p className="stat-trend neutral">Per booking average</p>
            </div>
          </div>
          {safeEnhancedAnalytics.conversionRate > 0 && (
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-content">
                <p className="stat-label">Conversion Rate</p>
                <h3 className="stat-value">
                  {safeEnhancedAnalytics.conversionRate.toFixed(1)}%
                </h3>
                <p className="stat-trend neutral">Views to bookings</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          {["overview", "events", "trends", "demographics", "data"].map((tab) => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "overview"
                ? "📈 Overview"
                : tab === "events"
                ? "🎪 Events"
                : tab === "trends"
                ? "📉 Trends"
                : tab === "demographics"
                ? "👥 Demographics"
                : "📋 Raw Data"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {enhancedAnalytics && (
        <div className="tab-content">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="overview-content">
              <div className="chart-grid">
                {/* Revenue & Bookings Trend with Predictions */}
                <div className="chart-card full-width">
                  <h3 className="chart-title">Revenue & Bookings Trend (with 7-day forecast)</h3>
                  <ResponsiveContainer width="100%" height={400}>
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
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        name="Revenue (KES)"
                      />
                      <Area
                        type="monotone"
                        dataKey="bookings"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorBookings)"
                        name="Bookings"
                      />
                      <Line
                        type="monotone"
                        dataKey="prediction"
                        stroke="#f59e0b"
                        strokeDasharray="5 5"
                        name="Revenue Forecast"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Payment Status Pie */}
                <div className="chart-card">
                  <h3 className="chart-title">Payment Status</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={safeEnhancedAnalytics.paymentStatus}
                        dataKey="percentage"
                        nameKey="name"
                        outerRadius={90}
                        label
                      >
                        {safeEnhancedAnalytics.paymentStatus.map((entry, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Booking Status Pie */}
                <div className="chart-card">
                  <h3 className="chart-title">Booking Status</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={safeEnhancedAnalytics.bookingStatus}
                        dataKey="percentage"
                        nameKey="name"
                        outerRadius={90}
                        label
                      >
                        {safeEnhancedAnalytics.bookingStatus.map((entry, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Events Tab */}
          {activeTab === "events" && (
            <div className="table-card">
              <h3 className="chart-title">Event Performance</h3>
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Bookings</th>
                    <th>Revenue (KES)</th>
                    <th>Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  {safeEnhancedAnalytics.eventPerformance.map((event, idx) => (
                    <tr key={idx}>
                      <td>{event.name}</td>
                      <td>{event.bookings}</td>
                      <td>{formatCurrency(event.revenue)}</td>
                      <td>
                        {event.bookings > 0
                          ? formatCurrency(event.revenue / event.bookings)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                  {safeEnhancedAnalytics.eventPerformance.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center" }}>
                        No events data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Ticket Type Performance */}
              {safeEnhancedAnalytics.ticketTypePerformance.length > 0 && (
                <>
                  <h3 className="chart-title" style={{ marginTop: "2rem" }}>
                    Ticket Type Performance
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={safeEnhancedAnalytics.ticketTypePerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sold" fill="#3b82f6" name="Tickets Sold" />
                      <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === "trends" && (
            <div className="trends-content">
              {/* Day of Week Performance */}
              <div className="chart-card">
                <h3 className="chart-title">Day of Week Performance</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={safeEnhancedAnalytics.dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                    <Bar dataKey="bookings" fill="#10b981" name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Hourly Booking Pattern */}
              {safeEnhancedAnalytics.hourlyData.length > 0 && (
                <div className="chart-card">
                  <h3 className="chart-title">Hourly Booking Pattern</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={safeEnhancedAnalytics.hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="bookings"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        name="Bookings"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Demographics Tab */}
          {activeTab === "demographics" && (
            <div className="demographics-content">
              {safeEnhancedAnalytics.demographicsData.length > 0 ? (
                <>
                  <div className="chart-card">
                    <h3 className="chart-title">Attendee Demographics</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={safeEnhancedAnalytics.demographicsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#ec4899" name="Attendees" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="table-card">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Demographic</th>
                          <th>Count</th>
                          <th>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {safeEnhancedAnalytics.demographicsData.map((demo, idx) => (
                          <tr key={idx}>
                            <td>{demo.category}</td>
                            <td>{demo.count}</td>
                            <td>{demo.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="no-data">
                  <p>No demographic data available for this period.</p>
                </div>
              )}
            </div>
          )}

          {/* Raw Data Tab */}
          {activeTab === "data" && (
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
                      <td>
                        {r.booking_date
                          ? new Date(r.booking_date).toLocaleDateString()
                          : ""}
                      </td>
                      <td>{formatCurrency(r.payment_amount || r.booking_amount)}</td>
                      <td>
                        <span className={`status-badge ${r.payment_status}`}>
                          {r.payment_status}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${r.booking_status}`}>
                          {r.booking_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center" }}>
                        No booking data
                      </td>
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

export default OrganizerReports;