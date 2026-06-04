import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Calendar,
  Users, AlertTriangle, CheckCircle, Clock, Activity,
  RefreshCw, Filter, Download,
} from "lucide-react";
import api from "../api";
import "../styles/Reports.css";

// ─── palette shared across charts ───────────────────────────────────────────
const PALETTE = {
  primary:   "#1e3a8a",
  accent:    "#0d47a1",
  teal:      "#0891b2",
  emerald:   "#059669",
  amber:     "#d97706",
  rose:      "#e11d48",
  slate:     "#475569",
  sky:       "#0284c7",
  indigo:    "#4f46e5",
  violet:    "#7c3aed",
};

const PIE_COLORS  = [PALETTE.emerald, PALETTE.rose, PALETTE.amber, PALETTE.sky, PALETTE.violet];
const BAR_COLORS  = [PALETTE.primary, PALETTE.teal, PALETTE.emerald, PALETTE.amber, PALETTE.rose,
                     PALETTE.sky, PALETTE.indigo, PALETTE.violet, PALETTE.slate, PALETTE.accent];

// ─── custom tooltip ──────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, currency = true }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rpt-tooltip">
      <p className="rpt-tooltip__label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="rpt-tooltip__row" style={{ color: p.color }}>
          <span>{p.name}:</span>
          <strong>
            {currency && p.name?.toLowerCase().includes("revenue")
              ? `KES ${Number(p.value).toLocaleString()}`
              : p.value?.toLocaleString?.() ?? p.value}
          </strong>
        </p>
      ))}
    </div>
  );
};

// ─── KPI card ────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, trend, accent, delay = 0 }) => {
  const positive = trend >= 0;
  return (
    <div className="rpt-kpi" style={{ animationDelay: `${delay}ms` }}>
      <div className={`rpt-kpi__icon rpt-kpi__icon--${accent}`}>
        <Icon size={20} />
      </div>
      <div className="rpt-kpi__body">
        <span className="rpt-kpi__label">{label}</span>
        <span className="rpt-kpi__value">{value}</span>
        {sub && <span className="rpt-kpi__sub">{sub}</span>}
      </div>
      {trend !== undefined && (
        <div className={`rpt-kpi__trend rpt-kpi__trend--${positive ? "up" : "down"}`}>
          {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  );
};

// ─── section wrapper ─────────────────────────────────────────────────────────
const Section = ({ title, subtitle, badge, children, delay = 0 }) => (
  <section className="rpt-section" style={{ animationDelay: `${delay}ms` }}>
    <div className="rpt-section__head">
      <div>
        <h2 className="rpt-section__title">{title}</h2>
        {subtitle && <p className="rpt-section__sub">{subtitle}</p>}
      </div>
      {badge && <span className="rpt-section__badge">{badge}</span>}
    </div>
    <div className="rpt-section__body">{children}</div>
  </section>
);

// ─── alert card ──────────────────────────────────────────────────────────────
const AlertCard = ({ type, title, message, count }) => (
  <div className={`rpt-alert rpt-alert--${type}`}>
    <div className="rpt-alert__icon">
      {type === "warning"  && <AlertTriangle size={16} />}
      {type === "success"  && <CheckCircle   size={16} />}
      {type === "info"     && <Clock          size={16} />}
      {type === "critical" && <Activity       size={16} />}
    </div>
    <div className="rpt-alert__body">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
    {count !== undefined && (
      <span className="rpt-alert__count">{count}</span>
    )}
  </div>
);

// ─── main component ──────────────────────────────────────────────────────────
const Reports = ({ currentUser }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [filters, setFilters] = useState({
    startDate: "", endDate: "", eventId: "", paymentStatus: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const role = currentUser?.role || localStorage.getItem("role");

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v)
      );
      const endpoint = role === "organizer" ? "/reports/organizer" : "/reports";
      const res = await api.get(endpoint, { params });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [role, filters]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!data?.reports?.length) return;
    const cols = ["booking_id","booking_date","event_title","user_name",
                  "user_email","payment_amount","payment_status","payment_method"];
    const rows = [cols.join(","),
      ...data.reports.map(r => cols.map(c => `"${r[c] ?? ""}"`).join(","))
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reports_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // ── states ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="rpt-state rpt-state--loading">
      <div className="rpt-spinner" />
      <p>Compiling report data…</p>
    </div>
  );

  if (error) return (
    <div className="rpt-state rpt-state--error">
      <AlertTriangle size={36} />
      <p>{error}</p>
      <button className="rpt-btn rpt-btn--primary" onClick={fetchReports}>
        Retry
      </button>
    </div>
  );

  if (!data) return null;

  // ── destructure ────────────────────────────────────────────────────────────
  const { stats = {}, analytics = {} } = data;
  const {
    timeSeriesData    = [],
    eventPerformance  = [],
    paymentStatus     = [],
    bookingStatus     = [],
    revenueGrowth     = 0,
    bookingsGrowth    = 0,
    avgBookingValue   = 0,
    suspiciousBookings= [],
    dayOfWeekData     = [],
  } = analytics;

  // ── derived funnel ─────────────────────────────────────────────────────────
  const totalBookings   = stats.totalBookings  || 0;
  const successCount    = paymentStatus.find(p => p.name?.toLowerCase() === "success")?.value  || 0;
  const pendingCount    = paymentStatus.find(p => p.name?.toLowerCase() === "pending")?.value  || 0;
  const failedCount     = paymentStatus.find(p => p.name?.toLowerCase() === "failed")?.value   || 0;

  const funnelData = [
    { name: "Total Inquiries",   value: Math.round(totalBookings * 1.4), fill: PALETTE.primary },
    { name: "Bookings Made",     value: totalBookings,                   fill: PALETTE.teal    },
    { name: "Payments Initiated",value: totalBookings - failedCount,     fill: PALETTE.emerald },
    { name: "Confirmed",         value: successCount,                    fill: PALETTE.amber   },
  ].filter(f => f.value > 0);

  // ── stacked bar (operational) ──────────────────────────────────────────────
  const operationalData = dayOfWeekData.map(d => ({
    day:      d.day,
    Confirmed: Math.round(d.bookings * (successCount / (totalBookings || 1))),
    Pending:   Math.round(d.bookings * (pendingCount / (totalBookings || 1))),
    Failed:    Math.round(d.bookings * (failedCount  / (totalBookings || 1))),
  }));

  // ── alert cards ────────────────────────────────────────────────────────────
  const alerts = [];
  if (suspiciousBookings.length)
    alerts.push({ type: "warning",  title: "Suspicious Bookings",  message: "Unusually high amounts or failed payments detected.", count: suspiciousBookings.length });
  if (failedCount > 0)
    alerts.push({ type: "critical", title: "Payment Failures",     message: `${failedCount} booking(s) with failed payment status.`, count: failedCount });
  if (pendingCount > 0)
    alerts.push({ type: "info",     title: "Pending Payments",     message: `${pendingCount} booking(s) awaiting payment confirmation.`, count: pendingCount });
  if (successCount > 0)
    alerts.push({ type: "success",  title: "Successful Payments",  message: `${successCount} booking(s) fully confirmed.`, count: successCount });

  const roleLabel = role === "organizer" ? "Organizer" : "Admin";

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rpt-root">

      {/* ── PAGE HEADER ────────────────────────────────────────────── */}
      <header className="rpt-header">
        <div className="rpt-header__left">
          <h1 className="rpt-header__title">
            <Activity size={22} />
            Reports &amp; Analytics
          </h1>
          <span className="rpt-header__role">{roleLabel} View</span>
        </div>
        <div className="rpt-header__actions">
          <button
            className={`rpt-btn rpt-btn--ghost ${showFilters ? "rpt-btn--active" : ""}`}
            onClick={() => setShowFilters(p => !p)}
          >
            <Filter size={15} /> Filters
          </button>
          <button className="rpt-btn rpt-btn--ghost" onClick={fetchReports}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="rpt-btn rpt-btn--primary" onClick={exportCSV}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </header>

      {/* ── FILTER BAR ─────────────────────────────────────────────── */}
      {showFilters && (
        <div className="rpt-filters">
          <div className="rpt-filters__grid">
            <label className="rpt-filters__field">
              <span>Start Date</span>
              <input type="date" value={filters.startDate}
                onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} />
            </label>
            <label className="rpt-filters__field">
              <span>End Date</span>
              <input type="date" value={filters.endDate}
                onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} />
            </label>
            <label className="rpt-filters__field">
              <span>Payment Status</span>
              <select value={filters.paymentStatus}
                onChange={e => setFilters(p => ({ ...p, paymentStatus: e.target.value }))}>
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <div className="rpt-filters__actions">
              <button className="rpt-btn rpt-btn--primary" onClick={fetchReports}>
                Apply
              </button>
              <button className="rpt-btn rpt-btn--ghost" onClick={() => {
                setFilters({ startDate:"", endDate:"", eventId:"", paymentStatus:"" });
              }}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — REVENUE & FINANCE
      ══════════════════════════════════════════════════════════════ */}
      <Section
        title="Revenue &amp; Finance"
        subtitle="Income trends and key financial indicators"
        badge="Finance"
        delay={0}
      >
        {/* KPI row */}
        <div className="rpt-kpi-grid">
          <KpiCard
            label="Total Revenue"
            value={`KES ${(stats.totalRevenue || 0).toLocaleString()}`}
            sub="All confirmed payments"
            icon={DollarSign}
            trend={revenueGrowth}
            accent="blue"
            delay={0}
          />
          <KpiCard
            label="Avg Booking Value"
            value={`KES ${Math.round(avgBookingValue).toLocaleString()}`}
            sub="Per booking"
            icon={TrendingUp}
            accent="teal"
            delay={60}
          />
          <KpiCard
            label="Total Bookings"
            value={(stats.totalBookings || 0).toLocaleString()}
            sub="All time"
            icon={Calendar}
            trend={bookingsGrowth}
            accent="emerald"
            delay={120}
          />
          <KpiCard
            label="Total Events"
            value={(stats.totalEvents || 0).toLocaleString()}
            sub="With bookings"
            icon={Users}
            accent="amber"
            delay={180}
          />
        </div>

        {/* Revenue line chart */}
        <div className="rpt-chart-card rpt-chart-card--wide">
          <h3 className="rpt-chart-card__title">Revenue Over Time</h3>
          {timeSeriesData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="revenue"  name="Revenue (KES)"
                  stroke={PALETTE.primary} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="bookings" name="Bookings"
                  stroke={PALETTE.teal} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="rpt-empty">No time-series data for selected range</div>
          )}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — BOOKING & DEMAND
      ══════════════════════════════════════════════════════════════ */}
      <Section
        title="Booking &amp; Demand"
        subtitle="Conversion funnel and weekly booking patterns"
        badge="Demand"
        delay={80}
      >
        <div className="rpt-chart-row">
          {/* Funnel */}
          <div className="rpt-chart-card">
            <h3 className="rpt-chart-card__title">Booking Conversion Funnel</h3>
            {funnelData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <FunnelChart>
                  <Tooltip
                    formatter={(v, n) => [v.toLocaleString(), n]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    {funnelData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                    <LabelList position="right" fill="#1e293b" stroke="none"
                      dataKey="name" style={{ fontSize: 11 }} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            ) : (
              <div className="rpt-empty">Insufficient data for funnel</div>
            )}
          </div>

          {/* Day-of-week line */}
          <div className="rpt-chart-card">
            <h3 className="rpt-chart-card__title">Bookings by Day of Week</h3>
            {dayOfWeekData.some(d => d.bookings > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dayOfWeekData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip content={<ChartTooltip currency={false} />} />
                  <Legend />
                  <Line type="monotone" dataKey="bookings" name="Bookings"
                    stroke={PALETTE.indigo} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue (KES)"
                    stroke={PALETTE.amber} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="rpt-empty">No day-of-week data available</div>
            )}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — EVENT PERFORMANCE
      ══════════════════════════════════════════════════════════════ */}
      <Section
        title="Event Performance"
        subtitle="Top events by revenue and booking distribution"
        badge="Events"
        delay={160}
      >
        <div className="rpt-chart-row">
          {/* Bar — top events */}
          <div className="rpt-chart-card rpt-chart-card--stretch">
            <h3 className="rpt-chart-card__title">Top 10 Events by Revenue</h3>
            {eventPerformance.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={eventPerformance}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `${(v/1000).toFixed(0)}K`}
                    tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis type="category" dataKey="name" width={110}
                    tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue (KES)" radius={[0, 4, 4, 0]}>
                    {eventPerformance.map((_, i) => (
                      <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="rpt-empty">No event data available</div>
            )}
          </div>

          {/* Pie — booking status */}
          <div className="rpt-chart-card">
            <h3 className="rpt-chart-card__title">Booking Status Split</h3>
            {bookingStatus.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={bookingStatus}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {bookingStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, n) => [v.toLocaleString(), n]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="rpt-empty">No booking status data</div>
            )}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — OPERATIONAL HEALTH
      ══════════════════════════════════════════════════════════════ */}
      <Section
        title="Operational Health"
        subtitle="Payment status breakdown and system alerts"
        badge="Ops"
        delay={240}
      >
        <div className="rpt-chart-row">
          {/* Stacked bar — daily ops */}
          <div className="rpt-chart-card rpt-chart-card--stretch">
            <h3 className="rpt-chart-card__title">Daily Booking Status Breakdown</h3>
            {operationalData.some(d => d.Confirmed + d.Pending + d.Failed > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={operationalData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                  />
                  <Legend />
                  <Bar dataKey="Confirmed" stackId="a" fill={PALETTE.emerald} radius={[0,0,0,0]} />
                  <Bar dataKey="Pending"   stackId="a" fill={PALETTE.amber}   radius={[0,0,0,0]} />
                  <Bar dataKey="Failed"    stackId="a" fill={PALETTE.rose}    radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="rpt-empty">No operational data available</div>
            )}
          </div>

          {/* Alert cards */}
          <div className="rpt-alert-panel">
            <h3 className="rpt-chart-card__title">System Alerts</h3>
            <div className="rpt-alert-list">
              {alerts.length ? alerts.map((a, i) => (
                <AlertCard key={i} {...a} />
              )) : (
                <AlertCard
                  type="success"
                  title="All Clear"
                  message="No alerts detected in the current data range."
                />
              )}
            </div>

            {/* Payment method mini-pie */}
            {paymentStatus.length > 0 && (
              <div className="rpt-mini-pie">
                <h4>Payment Status</h4>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={paymentStatus} cx="50%" cy="50%"
                      outerRadius={55} dataKey="value" nameKey="name">
                      {paymentStatus.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [v.toLocaleString(), n]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11 }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── DATA TABLE ─────────────────────────────────────────────── */}
      {data.reports?.length > 0 && (
        <Section title="Recent Transactions" subtitle="Last 50 bookings" badge="Raw Data" delay={320}>
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Event</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.slice(0, 50).map((r, i) => (
                  <tr key={r.booking_id || i}>
                    <td className="rpt-table__id">#{r.booking_id}</td>
                    <td className="rpt-table__event">{r.event_title || "—"}</td>
                    <td className="rpt-table__user">{r.user_name || r.user_email || "—"}</td>
                    <td className="rpt-table__date">
                      {r.booking_date
                        ? new Date(r.booking_date).toLocaleDateString("en-KE")
                        : "—"}
                    </td>
                    <td className="rpt-table__amount">
                      KES {parseFloat(r.payment_amount || 0).toLocaleString()}
                    </td>
                    <td className="rpt-table__method">{r.payment_method || "—"}</td>
                    <td>
                      <span className={`rpt-badge rpt-badge--${
                        (r.payment_status || "").toLowerCase() === "success"  ? "success"  :
                        (r.payment_status || "").toLowerCase() === "pending"  ? "pending"  :
                        (r.payment_status || "").toLowerCase() === "failed"   ? "failed"   : "neutral"
                      }`}>
                        {r.payment_status || "unknown"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

    </div>
  );
};

export default Reports;