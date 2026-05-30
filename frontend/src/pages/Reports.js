import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import api from "../api";
import "../styles/Reports.css";

const socket = io(process.env.REACT_APP_SOCKET_URL || "http://localhost:5000");

const fetchReports = async ({ queryKey }) => {
  const [, { role, page, filters }] = queryKey;

  const endpoint =
    role === "organizer" ? "/reports/organizer" : "/reports";

  const res = await api.get(endpoint, {
    params: {
      ...filters,
      page,
      limit: 20,
    },
  });

  return res.data;
};

export default function Reports({ user }) {
  const role = user?.role;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);

  const [filters] = useState({
    startDate: "",
    endDate: "",
    eventId: "",
    paymentStatus: "",
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", { role, page, filters }],
    queryFn: fetchReports,
    keepPreviousData: true,
    enabled: !!role,
  });

  const reports = data?.reports ?? [];
  const stats = data?.stats ?? {
    totalRevenue: 0,
    totalBookings: 0,
    totalEvents: 0,
  };

  // ================= SOCKET REAL-TIME =================
  useEffect(() => {
    if (!role) return;

    socket.emit("join_reports_room", { role });

    const handler = () => {
      queryClient.invalidateQueries(["reports"]);
    };

    socket.on("report_update", handler);

    return () => {
      socket.off("report_update", handler);
      socket.disconnect();
    };
  }, [role, queryClient]);

  // ================= EXPORT CSV =================
  const exportCSV = () => {
    const header = [
      "ID",
      "User",
      "Event",
      "Amount",
      "Payment Status",
      "Booking Status",
    ];

    const rows = reports.map((r) => [
      r.booking_id,
      r.user_name,
      r.event_title,
      r.payment_amount,
      r.payment_status,
      r.booking_status,
    ]);

    const csv = [
      header.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${role}-reports.csv`;
    a.click();
  };

  // ================= EXPORT PDF =================
  const exportPDF = async () => {
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();

    doc.text(`${role?.toUpperCase() ?? "REPORTS"}`, 14, 10);

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

  // ================= DRILL DOWN =================
  const openEvent = (eventId) => {
    if (!eventId) return;
    navigate(`/dashboard/events/${eventId}/analytics`);
  };

  return (
    <div className="reports-page">

      {/* HEADER */}
      <div className="reports-header">
        <div>
          <h2>
            {role === "admin"
              ? "Admin Reports"
              : "Organizer Reports"}
          </h2>
          <p>Live analytics dashboard</p>
        </div>

        <div className="actions">
          <button onClick={exportCSV}>CSV</button>
          <button onClick={exportPDF}>PDF</button>
        </div>
      </div>

      {/* STATS */}
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
      </div>

      {/* STATES */}
      {isLoading && <p className="info">Loading reports...</p>}
      {isError && <p className="error">Failed to load reports</p>}

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

        {/* PAGINATION */}
        <div className="pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>

          <span>Page {page}</span>

          <button onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}