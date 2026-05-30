import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";

import api from "../api";
import "../styles/Reports.css";

const socket = io(process.env.REACT_APP_SOCKET_URL);

// ================= FETCH =================
const fetchReports = async ({ queryKey }) => {
  const [, role, page, filters] = queryKey;

  const endpoint = role === "organizer" ? "/reports/organizer" : "/reports";

  const res = await api.get(endpoint, {
    params: { ...filters, page, limit: 20 },
  });

  return res.data;
};

// ================= FRAUD =================
const calculateFraudScore = (r, avg) => {
  let score = 0;

  const amount = Number(r.payment_amount || 0);

  if ((r.payment_status || "").toLowerCase() === "failed") score += 40;
  if (amount > avg * 3) score += 35;
  if (!r.user_name) score += 15;
  if (!r.booking_id) score += 10;

  return Math.min(score, 100);
};

export default function Reports({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const role = user?.role;
  const [page, setPage] = useState(1);

  // IMPORTANT: keep filters stable but NOT inside queryKey object
  const filters = useMemo(
    () => ({
      startDate: "",
      endDate: "",
      eventId: "",
      paymentStatus: "",
    }),
    []
  );

  // ================= QUERY =================
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["reports", role, page, filters],
    queryFn: fetchReports,
    enabled: !!role,
    keepPreviousData: true,
  });

  const reports = data?.reports ?? [];
  const stats = data?.stats ?? {
    totalRevenue: 0,
    totalBookings: 0,
    totalEvents: 0,
  };

  const analytics = data?.analytics ?? {};

  // ================= SOCKET =================
  useEffect(() => {
    if (!role) return;

    socket.emit("join_reports_room", { role });

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    };

    socket.on("report_update", refresh);

    return () => {
      socket.off("report_update", refresh);
    };
  }, [role, queryClient]);

  // ================= AVG =================
  const avgBooking =
    stats.totalBookings > 0
      ? stats.totalRevenue / stats.totalBookings
      : 0;

  // ================= FRAUD =================
  const fraudData = useMemo(() => {
    const source = analytics.suspiciousBookings?.length
      ? analytics.suspiciousBookings
      : reports;

    return source
      .map((r) => ({
        ...r,
        fraudScore: calculateFraudScore(r, avgBooking),
      }))
      .sort((a, b) => b.fraudScore - a.fraudScore)
      .slice(0, 10);
  }, [reports, analytics.suspiciousBookings, avgBooking]);

  const COLORS = ["#00C49F", "#FF8042", "#FFBB28", "#8884d8"];

  // ================= EXPORT =================
  const exportCSV = () => {
    const rows = reports.map((r) => [
      r.booking_id,
      r.user_name,
      r.event_title,
      r.payment_amount,
      r.payment_status,
      r.booking_status,
    ]);

    const csv = [
      ["ID", "User", "Event", "Amount", "Payment", "Status"].join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${role}-reports.csv`;
    a.click();
  };

  const exportPDF = async () => {
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    doc.text(`${role?.toUpperCase()} REPORTS`, 14, 10);

    autoTable(doc, {
      head: [["ID", "User", "Event", "Amount", "Status"]],
      body: reports.map((r) => [
        r.booking_id,
        r.user_name,
        r.event_title,
        r.payment_amount,
        r.payment_status,
      ]),
    });

    doc.save(`${role}-reports.pdf`);
  };

  const openEvent = (id) => {
    navigate(`/dashboard/events/${id}/analytics`);
  };

  // ================= UI =================
  return (
    <div className="reports-page">

      {/* LOADING / ERROR (fix CI warnings) */}
      {isLoading && <p>Loading reports...</p>}
      {isError && <p>Failed to load reports</p>}

      {/* HEADER */}
      <div className="reports-header">
        <div>
          <h2>
            {role === "admin"
              ? "Admin Analytics Dashboard"
              : "Organizer Analytics Dashboard"}
          </h2>
          <p>Live system intelligence overview</p>
        </div>

        <div className="actions">
          <button onClick={exportCSV}>CSV</button>
          <button onClick={exportPDF}>PDF</button>
        </div>
      </div>

      {/* KPI */}
      <div className="stats-grid">
        <div className="stat-card">
          <h4>Revenue</h4>
          <p>KES {stats.totalRevenue}</p>
        </div>

        <div className="stat-card">
          <h4>Bookings</h4>
          <p>{stats.totalBookings}</p>
        </div>

        <div className="stat-card">
          <h4>Events</h4>
          <p>{stats.totalEvents}</p>
        </div>

        {role === "admin" && (
          <div className="stat-card">
            <h4>Risk Alerts</h4>
            <p>{fraudData.filter((f) => f.fraudScore > 60).length}</p>
          </div>
        )}
      </div>

      {/* CHARTS */}
      <div className="stats-grid">

        <div className="stat-card" style={{ height: 300 }}>
          <h4>Revenue Trend</h4>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={analytics.timeSeriesData || []}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#00C49F" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card" style={{ height: 300 }}>
          <h4>Payment Status</h4>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={analytics.paymentStatus || []}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
              >
                {(analytics.paymentStatus || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card" style={{ height: 300 }}>
          <h4>Event Performance</h4>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={analytics.eventPerformance || []}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* FRAUD PANEL */}
      {role === "admin" && (
        <div className="table-box">
          <h4>Fraud Detection Panel</h4>

          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>User</th>
                <th>Event</th>
                <th>Amount</th>
                <th>Risk</th>
              </tr>
            </thead>

            <tbody>
              {fraudData.map((r) => (
                <tr key={r.booking_id}>
                  <td>{r.booking_id}</td>
                  <td>{r.user_name}</td>
                  <td>{r.event_title}</td>
                  <td>{r.payment_amount}</td>
                  <td style={{ color: r.fraudScore > 60 ? "red" : "green" }}>
                    {r.fraudScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLE */}
      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Event</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {reports.map((r) => (
              <tr key={r.booking_id}>
                <td>{r.booking_id}</td>
                <td>{r.user_name}</td>
                <td>{r.event_title}</td>
                <td>{r.payment_amount}</td>
                <td>{r.payment_status}</td>
                <td>
                  <button onClick={() => openEvent(r.event_id)}>
                    Drill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>

          <span>Page {page}</span>

          <button onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}