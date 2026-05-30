import React, { useEffect, useState, useMemo } from "react";
import "./Reports.css";
import api from "../api";
import jsPDF from "jspdf";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const formatCurrency = (v) => `KES ${Number(v || 0).toLocaleString()}`;

const deltaText = (v) => `${v >= 0 ? "↑" : "↓"} ${Math.abs(v || 0)}%`;

export default function Reports({ user, token }) {
  const isAdmin = user?.role === "admin";

  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({});
  const [analytics, setAnalytics] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("overview");

  const [dateRange, setDateRange] = useState("30days");

  const [compareMode, setCompareMode] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState([]);

  const safe = analytics || {
    paymentStatus: [],
    bookingStatus: [],
    eventPerformance: [],
    suspiciousBookings: [],
    timeSeries: [],
    revenueGrowth: 0,
    bookingsGrowth: 0,
    avgBookingValue: 0,
  };

  // ── DATE FILTER ─────────────────────────────
  const applyDateRange = (range) => {
    const end = new Date();
    const start = new Date();

    if (range === "7days") start.setDate(start.getDate() - 7);
    if (range === "30days") start.setDate(start.getDate() - 30);
    if (range === "90days") start.setDate(start.getDate() - 90);

    setDateRange(range);

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  };

  // ── FETCH ─────────────────────────────
  const fetchReports = async (range = dateRange) => {
    setLoading(true);
    setError("");

    const dateFilter = applyDateRange(range);

    try {
      const endpoint = isAdmin
        ? "/reports/admin"
        : "/reports/organizer";

      const res = await api.get(endpoint, {
        params: dateFilter,
        headers: { Authorization: `Bearer ${token}` },
      });

      setReports(res.data.reports);
      setStats(res.data.stats);
      setAnalytics(res.data.analytics);
    } catch (err) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  // ── LIVE UPDATES ─────────────────────────────
  useEffect(() => {
    socket.on("reports-update", (data) => {
      setReports(data.reports);
      setStats(data.stats);
      setAnalytics(data.analytics);
    });

    return () => socket.off("reports-update");
  }, []);

  useEffect(() => {
    fetchReports();
  }, []);

  // ── EXPORT CSV ─────────────────────────────
  const exportCSV = () => {
    const header = "ID,User,Event,Amount,Status\n";

    const rows = reports
      .map((r) =>
        `${r.booking_id},${r.user_name},${r.event_title},${r.amount},${r.status}`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "reports.csv";
    a.click();
  };

  // ── EXPORT PDF ─────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Event Reports", 10, 10);

    reports.slice(0, 25).forEach((r, i) => {
      doc.text(
        `${r.booking_id} | ${r.user_name} | ${r.event_title} | ${r.amount}`,
        10,
        20 + i * 8
      );
    });

    doc.save("reports.pdf");
  };

  // ── EVENT COMPARISON ─────────────────────────────
  const comparedEvents = compareMode
    ? safe.eventPerformance.filter((e) =>
        selectedEvents.includes(e.name)
      )
    : safe.eventPerformance;

  const timeSeries = safe.timeSeries || [];

  // ── UI ─────────────────────────────
  return (
    <div className="reports-container">

      {/* HEADER */}
      <div className="reports-header">
        <div>
          <h2>
            {isAdmin ? "Admin Dashboard" : "Organizer Dashboard"}
          </h2>
          <p>
            {isAdmin
              ? "System-wide analytics"
              : "Your event performance"}
          </p>
        </div>

        <div className="header-actions">
          <button onClick={fetchReports}>Refresh</button>
          <button onClick={exportCSV}>CSV</button>
          <button onClick={exportPDF}>PDF</button>
        </div>
      </div>

      {/* DATE FILTERS */}
      <div className="date-filters">
        {["7days", "30days", "90days"].map((r) => (
          <button
            key={r}
            className={dateRange === r ? "active" : ""}
            onClick={() => fetchReports(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <div className="loading">Loading...</div>}

      {/* KPI */}
      <div className="stats-grid">
        <div className="stat-card">
          <h4>Revenue</h4>
          <p>{formatCurrency(stats.totalRevenue)}</p>
          <small className={safe.revenueGrowth >= 0 ? "up" : "down"}>
            {deltaText(safe.revenueGrowth)}
          </small>
        </div>

        <div className="stat-card">
          <h4>Bookings</h4>
          <p>{stats.totalBookings}</p>
          <small className={safe.bookingsGrowth >= 0 ? "up" : "down"}>
            {deltaText(safe.bookingsGrowth)}
          </small>
        </div>

        <div className="stat-card">
          <h4>Events</h4>
          <p>{stats.totalEvents}</p>
        </div>

        <div className="stat-card">
          <h4>Avg Booking</h4>
          <p>{formatCurrency(safe.avgBookingValue)}</p>
        </div>
      </div>

      {/* COMPARE MODE */}
      <div className="compare">
        <label>
          <input
            type="checkbox"
            checked={compareMode}
            onChange={() => setCompareMode(!compareMode)}
          />
          Compare Events
        </label>

        {compareMode && (
          <select
            multiple
            onChange={(e) =>
              setSelectedEvents(
                Array.from(e.target.selectedOptions, (o) => o.value)
              )
            }
          >
            {safe.eventPerformance.map((e, i) => (
              <option key={i} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* TABS */}
      <div className="tabs">
        {["overview", "events", "trends"].map((t) => (
          <button
            key={t}
            className={activeTab === t ? "active" : ""}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === "overview" && (
        <div className="charts">

          {/* TREND */}
          <div className="chart-box full">
            <h4>Revenue Trend</h4>

            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line dataKey="revenue" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* PIE */}
          <div className="chart-box">
            <h4>Payment Status</h4>
            <PieChart width={300} height={250}>
              <Pie data={safe.paymentStatus} dataKey="percentage">
                {safe.paymentStatus.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </div>

          <div className="chart-box">
            <h4>Booking Status</h4>
            <PieChart width={300} height={250}>
              <Pie data={safe.bookingStatus} dataKey="percentage">
                {safe.bookingStatus.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </div>

        </div>
      )}

      {/* EVENTS */}
      {activeTab === "events" && (
        <div className="table">
          <h4>Event Performance</h4>

          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Bookings</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {comparedEvents.map((e, i) => (
                <tr key={i}>
                  <td>{e.name}</td>
                  <td>{e.bookings}</td>
                  <td>{formatCurrency(e.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ALERTS */}
      {activeTab === "trends" && (
        <div className="table">
          <h4>Alerts</h4>

          {safe.suspiciousBookings.map((b, i) => (
            <div key={i} className="alert">
              {b.reason}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}