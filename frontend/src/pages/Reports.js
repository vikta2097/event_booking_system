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
  CartesianGrid,
  Legend,
} from "recharts";

import api from "../api";
import "../styles/Reports.css";

const socket = io(process.env.REACT_APP_SOCKET_URL);

// ================= FETCH =================
const fetchReports = async ({ queryKey }) => {
  const [, role, page, filters] = queryKey;

  const endpoint =
    role === "organizer"
      ? "/reports/organizer"
      : "/reports";

  const res = await api.get(endpoint, {
    params: {
      ...filters,
      page,
      limit: 20,
    },
  });

  return res.data;
};

// ================= FRAUD SCORE =================
const calculateFraudScore = (r, avg) => {
  let score = 0;

  const amount = Number(r.payment_amount || 0);

  if ((r.payment_status || "").toLowerCase() === "failed") {
    score += 40;
  }

  if (amount > avg * 3) {
    score += 35;
  }

  if (!r.user_name) {
    score += 15;
  }

  if (!r.booking_id) {
    score += 10;
  }

  return Math.min(score, 100);
};

export default function Reports({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const role = user?.role;

  const [page, setPage] = useState(1);

  // ================= STABLE FILTERS =================
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

  // ================= STABLE DATA =================
  const reports = useMemo(() => {
    return data?.reports || [];
  }, [data]);

  const stats = useMemo(() => {
    return (
      data?.stats || {
        totalRevenue: 0,
        totalBookings: 0,
        totalEvents: 0,
      }
    );
  }, [data]);

  const analytics = useMemo(() => {
    return data?.analytics || {};
  }, [data]);

  // ================= SOCKET =================
  useEffect(() => {
    if (!role) return;

    socket.emit("join_reports_room", { role });

    const refreshReports = () => {
      queryClient.invalidateQueries({
        queryKey: ["reports"],
      });
    };

    socket.on("report_update", refreshReports);

    return () => {
      socket.off("report_update", refreshReports);
    };
  }, [role, queryClient]);

  // ================= AVERAGE BOOKING =================
  const avgBooking = useMemo(() => {
    if (!stats.totalBookings) return 0;

    return stats.totalRevenue / stats.totalBookings;
  }, [stats]);

  // ================= FRAUD DATA =================
  const fraudData = useMemo(() => {
    const source =
      analytics?.suspiciousBookings?.length > 0
        ? analytics.suspiciousBookings
        : reports;

    return source
      .map((r) => ({
        ...r,
        fraudScore: calculateFraudScore(r, avgBooking),
      }))
      .sort((a, b) => b.fraudScore - a.fraudScore)
      .slice(0, 10);
  }, [reports, analytics, avgBooking]);

  // ================= COLORS =================
  const COLORS = [
    "#00C49F",
    "#FF8042",
    "#FFBB28",
    "#8884d8",
    "#0088FE",
  ];

  // ================= EXPORT CSV =================
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
      [
        "ID",
        "User",
        "Event",
        "Amount",
        "Payment",
        "Status",
      ].join(","),

      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = `${role}-reports.csv`;

    a.click();

    URL.revokeObjectURL(url);
  };

  // ================= EXPORT PDF =================
  const exportPDF = async () => {
    const jsPDF = (await import("jspdf")).default;

    const autoTable =
      (await import("jspdf-autotable")).default;

    const doc = new jsPDF();

    doc.text(
      `${role?.toUpperCase()} REPORTS`,
      14,
      10
    );

    autoTable(doc, {
      head: [
        [
          "ID",
          "User",
          "Event",
          "Amount",
          "Status",
        ],
      ],

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

  // ================= NAVIGATION =================
  const openEvent = (id) => {
    navigate(`/dashboard/events/${id}/analytics`);
  };

  // ================= LOADING =================
  if (isLoading) {
    return (
      <div className="reports-page">
        <div className="loading-box">
          <p>Loading reports...</p>
        </div>
      </div>
    );
  }

  // ================= ERROR =================
  if (isError) {
    return (
      <div className="reports-page">
        <div className="error-box">
          <p>Failed to load reports.</p>
        </div>
      </div>
    );
  }

  // ================= UI =================
  return (
    <div className="reports-page">

      {/* ================= HEADER ================= */}
      <div className="reports-header">

        <div>
          <h2>
            {role === "admin"
              ? "Admin Analytics Dashboard"
              : "Organizer Analytics Dashboard"}
          </h2>

          <p>
            Live reporting and analytics overview
          </p>
        </div>

        <div className="actions">
          <button onClick={exportCSV}>
            Export CSV
          </button>

          <button onClick={exportPDF}>
            Export PDF
          </button>
        </div>
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="stats-grid">

        <div className="stat-card">
          <h4>Total Revenue</h4>

          <p>
            KES{" "}
            {Number(stats.totalRevenue || 0).toLocaleString()}
          </p>
        </div>

        <div className="stat-card">
          <h4>Total Bookings</h4>

          <p>{stats.totalBookings}</p>
        </div>

        <div className="stat-card">
          <h4>Total Events</h4>

          <p>{stats.totalEvents}</p>
        </div>

        {role === "admin" && (
          <div className="stat-card">
            <h4>Risk Alerts</h4>

            <p>
              {
                fraudData.filter(
                  (f) => f.fraudScore > 60
                ).length
              }
            </p>
          </div>
        )}
      </div>

      {/* ================= CHARTS ================= */}
      <div className="stats-grid">

        {/* REVENUE TREND */}
        <div
          className="stat-card"
          style={{ height: "350px" }}
        >
          <h4>Revenue Trend</h4>

          <ResponsiveContainer
            width="100%"
            height="90%"
          >
            <LineChart
              data={analytics.timeSeriesData || []}
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="date" />

              <YAxis />

              <Tooltip />

              <Legend />

              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#00C49F"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* PAYMENT STATUS */}
        <div
          className="stat-card"
          style={{ height: "350px" }}
        >
          <h4>Payment Status</h4>

          <ResponsiveContainer
            width="100%"
            height="90%"
          >
            <PieChart>
              <Pie
                data={analytics.paymentStatus || []}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                label
              >
                {(analytics.paymentStatus || []).map(
                  (_, i) => (
                    <Cell
                      key={i}
                      fill={
                        COLORS[i % COLORS.length]
                      }
                    />
                  )
                )}
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* EVENT PERFORMANCE */}
        <div
          className="stat-card"
          style={{ height: "350px" }}
        >
          <h4>Event Performance</h4>

          <ResponsiveContainer
            width="100%"
            height="90%"
          >
            <BarChart
              data={
                analytics.eventPerformance || []
              }
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="name" />

              <YAxis />

              <Tooltip />

              <Legend />

              <Bar
                dataKey="revenue"
                fill="#8884d8"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================= ADMIN FRAUD PANEL ================= */}
      {role === "admin" && (
        <div className="table-box">

          <div className="table-header">
            <h3>Fraud Detection Panel</h3>
          </div>

          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>User</th>
                <th>Event</th>
                <th>Amount</th>
                <th>Fraud Score</th>
              </tr>
            </thead>

            <tbody>
              {fraudData.map((r) => (
                <tr key={r.booking_id}>
                  <td>{r.booking_id}</td>

                  <td>{r.user_name}</td>

                  <td>{r.event_title}</td>

                  <td>
                    KES {r.payment_amount}
                  </td>

                  <td>
                    <span
                      style={{
                        color:
                          r.fraudScore > 60
                            ? "#ef4444"
                            : "#10b981",
                        fontWeight: 700,
                      }}
                    >
                      {r.fraudScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= REPORT TABLE ================= */}
      <div className="table-box">

        <div className="table-header">
          <h3>
            {role === "admin"
              ? "System Transactions"
              : "Organizer Transactions"}
          </h3>
        </div>

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

                <td>
                  KES {r.payment_amount}
                </td>

                <td>{r.payment_status}</td>

                <td>
                  <button
                    className="drill-btn"
                    onClick={() =>
                      openEvent(r.event_id)
                    }
                  >
                    Drill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ================= PAGINATION ================= */}
        <div className="pagination">

          <button
            disabled={page === 1}
            onClick={() =>
              setPage((p) => p - 1)
            }
          >
            Prev
          </button>

          <span>Page {page}</span>

          <button
            onClick={() =>
              setPage((p) => p + 1)
            }
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}