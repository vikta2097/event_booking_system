import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";
import { io } from "socket.io-client";
import api from "../api";
import "../styles/Reports.css";

const socket = io(process.env.REACT_APP_SOCKET_URL, {
  transports: ["websocket"],
  withCredentials: true,
});

// ───────── helpers ─────────
const fmt = n =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maxFractionDigits: 0,
  }).format(n || 0);

const num = n =>
  new Intl.NumberFormat("en-KE").format(Math.round(n || 0));

const Empty = ({ msg = "No data available" }) => (
  <div className="rpt-empty">{msg}</div>
);

const TT = ({ active, payload, label, currency }) =>
  !active || !payload?.length ? null : (
    <div className="rpt-tooltip">
      <p>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {currency ? fmt(p.value) : num(p.value)}
        </p>
      ))}
    </div>
  );

// ───────── Revenue ─────────
const Revenue = ({ analytics, stats }) => {
  const [view, setView] = useState("area");
  const { timeSeriesData = [], revenueGrowth = 0, avgBookingValue = 0 } = analytics;

  const statCards = useMemo(
    () => [
      ["Total revenue", fmt(stats.totalRevenue), `${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth}%`],
      ["Avg booking", fmt(avgBookingValue)],
      ["Bookings", num(stats.totalBookings)],
      ["Events", num(stats.totalEvents)],
    ],
    [stats, revenueGrowth, avgBookingValue]
  );

  return (
    <div className="rpt-card">
      <div className="rpt-revenue__header">
        <h3 className="rpt-section-title">Revenue performance</h3>

        <div className="rpt-revenue__toggle">
          {["area", "bar"].map(v => (
            <button
              key={v}
              className={`rpt-toggle-btn ${view === v ? "rpt-toggle-btn--active" : ""}`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="rpt-stats-grid">
        {statCards.map(([l, v, s], i) => (
          <div key={i} className="rpt-stat-card">
            <span className="rpt-stat-card__label">{l}</span>
            <span className="rpt-stat-card__value">{v}</span>
            {s && <span className="rpt-stat-card__sub">{s}</span>}
          </div>
        ))}
      </div>

      {!timeSeriesData.length ? (
        <Empty />
      ) : (
        <ResponsiveContainer height={220}>
          {view === "area" ? (
            <AreaChart data={timeSeriesData}>
              <CartesianGrid />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<TT currency />} />
              <Area dataKey="revenue" stroke="#3B6D11" fill="#3B6D11" />
            </AreaChart>
          ) : (
            <BarChart data={timeSeriesData}>
              <CartesianGrid />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip content={<TT currency />} />
              <Bar dataKey="revenue" fill="#3B6D11" />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ───────── Booking Activity ─────────
const BookingActivity = ({ analytics }) => {
  const { timeSeriesData = [], dayOfWeekData = [] } = analytics;

  return (
    <div className="rpt-col2">
      <div className="rpt-card">
        <h3 className="rpt-section-title">Booking activity</h3>

        {!timeSeriesData.length ? (
          <Empty />
        ) : (
          <ResponsiveContainer height={180}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid />
              <XAxis dataKey="date" />
              <Tooltip content={<TT />} />
              <Line dataKey="bookings" stroke="#1D9E75" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rpt-card">
        <h3 className="rpt-section-title">Bookings by day</h3>

        {!dayOfWeekData.length ? (
          <Empty />
        ) : (
          <ResponsiveContainer height={200}>
            <BarChart data={dayOfWeekData}>
              <CartesianGrid />
              <XAxis dataKey="day" />
              <Tooltip content={<TT />} />
              <Bar dataKey="bookings" fill="#1D9E75" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

// ───────── Attendance ─────────
const Attendance = ({ analytics }) => {
  const { eventPerformance = [], bookingStatus = [] } = analytics;

  return (
    <div className="rpt-attendance">
      <div className="rpt-card">
        <h3 className="rpt-section-title">Attendance by event</h3>

        {!eventPerformance.length ? (
          <Empty />
        ) : (
          <ResponsiveContainer height={220}>
            <BarChart data={eventPerformance.slice(0, 6)} layout="vertical">
              <CartesianGrid />
              <XAxis type="number" />
              <YAxis dataKey="name" />
              <Tooltip content={<TT />} />
              <Bar dataKey="bookings" fill="#378ADD" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rpt-card">
        <h3 className="rpt-section-title">Booking status</h3>

        {!bookingStatus.length ? (
          <Empty />
        ) : (
          <ResponsiveContainer height={160}>
            <PieChart>
              <Pie data={bookingStatus} dataKey="value" nameKey="name">
                {bookingStatus.map((_, i) => (
                  <Cell key={i} />
                ))}
              </Pie>
              <Tooltip content={<TT />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

// ───────── Table ─────────
const BookingsTable = ({ reports, role }) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const size = 8;

  const filtered = useMemo(() =>
    (reports || []).filter(r => {
      const match =
        (r.event_title || "").toLowerCase().includes(search.toLowerCase()) ||
        (r.user_name || "").toLowerCase().includes(search.toLowerCase());

      const st = status === "all" || r.booking_status === status;
      return match && st;
    }), [reports, search, status]);

  const pages = Math.ceil(filtered.length / size);
  const data = filtered.slice(page * size, (page + 1) * size);

  const statuses = useMemo(
    () => ["all", ...new Set((reports || []).map(r => r.booking_status || "unknown"))],
    [reports]
  );

  return (
    <div className="rpt-card">
      <h3 className="rpt-section-title">Bookings detail</h3>

      <div className="rpt-table-controls">
        <input
          className="rpt-table-controls__search"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <select
          className="rpt-table-controls__select"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          {statuses.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <span className="rpt-table-controls__count">
          {filtered.length} records
        </span>
      </div>

      {!data.length ? (
        <Empty msg="No bookings match filters" />
      ) : (
        <table className="rpt-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Event</th>
              {role === "admin" && <th>User</th>}
              <th>Date</th>
              <th>Seats</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payment</th>
            </tr>
          </thead>

          <tbody>
            {data.map((r, i) => (
              <tr key={i}>
                <td>#{r.booking_id}</td>
                <td>{r.event_title}</td>
                {role === "admin" && <td>{r.user_name}</td>}
                <td>{r.booking_date ? new Date(r.booking_date).toLocaleDateString() : "—"}</td>
                <td>{r.seats || "—"}</td>
                <td>{fmt(r.booking_amount || r.payment_amount)}</td>
                <td>{r.booking_status}</td>
                <td>{r.payment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pages > 1 && (
        <div className="rpt-pagination">
          <button
            className="rpt-pagination__btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            Prev
          </button>

          <span className="rpt-pagination__info">
            {page + 1}/{pages}
          </span>

          <button
            className="rpt-pagination__btn"
            onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

// ───────── MAIN ─────────
const Reports = ({ user }) => {
  const role = user?.role || "user";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sec, setSec] = useState("revenue");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports");
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    socket.on("reportsUpdated", fetchData);

    return () => socket.off("reportsUpdated", fetchData);
  }, [fetchData]);

  const a = data?.analytics || {};
  const s = data?.stats || {};
  const r = data?.reports || [];

  return (
    <div className="reports-page">
      <h1>Reports & Analytics</h1>

      <nav className="reports-nav">
        {["revenue", "bookings", "attendance", "detail"].map(x => (
          <button
            key={x}
            className={`reports-nav__pill ${sec === x ? "reports-nav__pill--active" : ""}`}
            onClick={() => setSec(x)}
          >
            {x}
          </button>
        ))}
      </nav>

      {loading && <div className="reports-loading">Loading...</div>}

      {!loading && (
        <>
          {sec === "revenue" && <Revenue analytics={a} stats={s} />}
          {sec === "bookings" && <BookingActivity analytics={a} />}
          {sec === "attendance" && <Attendance analytics={a} />}
          {sec === "detail" && <BookingsTable reports={r} role={role} />}
        </>
      )}
    </div>
  );
};

export default Reports;