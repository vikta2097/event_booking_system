import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { io } from "socket.io-client";
import api from "../api";
import "../styles/Reports.css";

// ───────── socket (singleton-safe) ─────────
const socket = io(process.env.REACT_APP_SOCKET_URL);
// ───────── chart config ─────────
const C = {
  p: "var(--chart-primary,#3B6D11)",
  s: "var(--chart-secondary,#1D9E75)",
  a: "var(--chart-accent,#BA7517)",
  d: "#E24B4A",
  i: "var(--chart-info,#378ADD)",
  pr: "var(--chart-purple,#7F77DD)",
  m: "var(--chart-muted,#888780)",
  g: "var(--chart-grid,#F1EFE8)",
  t: "var(--chart-tick,#888780)",
};

const PIE = [C.p, C.s, C.a, C.i, C.pr];

// ───────── helpers ─────────
const fmt = n =>
  new Intl.NumberFormat("en-KE",{style:"currency",currency:"KES",maxFractionDigits:0}).format(n||0);

const num = n =>
  new Intl.NumberFormat("en-KE").format(Math.round(n||0));

const Empty = ({msg="No data available"}) =>
  <div className="rpt-empty">{msg}</div>;

const TT = ({active,payload,label,currency}) =>
  !active || !payload?.length ? null : (
    <div className="rpt-tooltip">
      <p>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color}}>
          {p.name}: {currency ? fmt(p.value) : num(p.value)}
        </p>
      ))}
    </div>
  );

// ───────── SECTION: Revenue ─────────
const Revenue = ({analytics,stats}) => {
  const [view,setView] = useState("area");
  const {timeSeriesData=[],revenueGrowth=0,avgBookingValue=0}=analytics;

  const statCards = useMemo(() => ([
    ["Total revenue", fmt(stats.totalRevenue), `${revenueGrowth>=0?"+":""}${revenueGrowth}%`],
    ["Avg booking", fmt(avgBookingValue)],
    ["Bookings", num(stats.totalBookings)],
    ["Events", num(stats.totalEvents)],
  ]), [stats, revenueGrowth, avgBookingValue]);

  return (
    <div className="rpt-card">
      <div className="rpt-revenue__header">
        <h3 className="rpt-section-title">Revenue performance</h3>
        <div>
          {["area","bar"].map(v=>(
            <button key={v}
              className={`rpt-toggle-btn${view===v?" rpt-toggle-btn--active":""}`}
              onClick={()=>setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="rpt-stats-grid">
        {statCards.map(([l,v,s],i)=>(
          <div key={i} className="rpt-stat-card">
            <span className="rpt-stat-card__label">{l}</span>
            <span className="rpt-stat-card__value">{v}</span>
            {s && <span className="rpt-stat-card__sub">{s}</span>}
          </div>
        ))}
      </div>

      {!timeSeriesData.length ? <Empty/> :
        <ResponsiveContainer height={220}>
          {view==="area" ? (
            <AreaChart data={timeSeriesData}>
              <CartesianGrid stroke={C.g}/>
              <XAxis dataKey="date" tick={{fontSize:11,fill:C.t}}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<TT currency/>}/>
              <Area dataKey="revenue" stroke={C.p} fill={C.p}/>
            </AreaChart>
          ) : (
            <BarChart data={timeSeriesData}>
              <CartesianGrid stroke={C.g}/>
              <XAxis dataKey="date" tick={{fontSize:11,fill:C.t}}/>
              <YAxis tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
              <Tooltip content={<TT currency/>}/>
              <Bar dataKey="revenue" fill={C.p}/>
            </BarChart>
          )}
        </ResponsiveContainer>
      }
    </div>
  );
};

// ───────── Booking Activity ─────────
const BookingActivity = ({analytics}) => {
  const {timeSeriesData=[],dayOfWeekData=[]}=analytics;
  const total = useMemo(
    () => timeSeriesData.reduce((s,d)=>s+d.bookings,0),
    [timeSeriesData]
  );

  return (
    <div className="rpt-col2">
      <div className="rpt-card">
        <h3 className="rpt-section-title">Booking activity</h3>
        <div>{num(total)}</div>

        {!timeSeriesData.length ? <Empty/> :
          <ResponsiveContainer height={180}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid stroke={C.g}/>
              <XAxis dataKey="date"/>
              <Tooltip content={<TT/>}/>
              <Line dataKey="bookings" stroke={C.s}/>
            </LineChart>
          </ResponsiveContainer>
        }
      </div>

      <div className="rpt-card">
        <h3 className="rpt-section-title">Bookings by day</h3>
        {!dayOfWeekData.length ? <Empty/> :
          <ResponsiveContainer height={200}>
            <BarChart data={dayOfWeekData}>
              <CartesianGrid stroke={C.g}/>
              <XAxis dataKey="day"/>
              <Tooltip content={<TT/>}/>
              <Bar dataKey="bookings" fill={C.s}/>
            </BarChart>
          </ResponsiveContainer>
        }
      </div>
    </div>
  );
};

// ───────── Attendance ─────────
const Attendance = ({analytics}) => {
  const {eventPerformance=[],bookingStatus=[]}=analytics;

  return (
    <div className="rpt-attendance">
      <div className="rpt-card">
        <h3 className="rpt-section-title">Attendance by event</h3>
        {!eventPerformance.length ? <Empty/> :
          <ResponsiveContainer height={220}>
            <BarChart data={eventPerformance.slice(0,6)} layout="vertical">
              <CartesianGrid stroke={C.g} horizontal={false}/>
              <XAxis type="number"/>
              <YAxis dataKey="name"/>
              <Tooltip content={<TT/>}/>
              <Bar dataKey="bookings" fill={C.i}/>
            </BarChart>
          </ResponsiveContainer>
        }
      </div>

      <div className="rpt-card">
        <h3 className="rpt-section-title">Booking status</h3>
        {!bookingStatus.length ? <Empty/> :
          <ResponsiveContainer height={160}>
            <PieChart>
              <Pie data={bookingStatus} dataKey="value" nameKey="name">
                {bookingStatus.map((e,i)=>(
                  <Cell key={i} fill={PIE[i%PIE.length]}/>
                ))}
              </Pie>
              <Tooltip content={<TT/>}/>
            </PieChart>
          </ResponsiveContainer>
        }
      </div>
    </div>
  );
};

// ───────── BOOKINGS TABLE (FULL PRESERVED) ─────────
const BookingsTable = ({reports,role}) => {
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [page,setPage]=useState(0);
  const size=8;

  const filtered = useMemo(() =>
    (reports||[]).filter(r=>{
      const match =
        (r.event_title||"").toLowerCase().includes(search.toLowerCase()) ||
        (r.user_name||"").toLowerCase().includes(search.toLowerCase());

      const st = status==="all" || r.booking_status===status;
      return match && st;
    }), [reports,search,status]);

  const pages = Math.ceil(filtered.length/size);
  const data = filtered.slice(page*size,(page+1)*size);

  const statuses = useMemo(() =>
    ["all", ...new Set((reports||[]).map(r=>r.booking_status||"unknown"))],
  [reports]);

  return (
    <div className="rpt-card">
      <h3 className="rpt-section-title">Bookings detail</h3>

      <div className="rpt-table-controls">
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} />
        <select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}>
          {statuses.map(s=><option key={s}>{s}</option>)}
        </select>
        <span>{filtered.length} records</span>
      </div>

      {!data.length ? <Empty msg="No bookings match filters"/> :
        <table className="rpt-table">
          <thead>
            <tr>
              <th>ID</th><th>Event</th>
              {role==="admin" && <th>User</th>}
              <th>Date</th><th>Seats</th><th>Amount</th>
              <th>Status</th><th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r,i)=>(
              <tr key={i}>
                <td>#{r.booking_id}</td>
                <td>{r.event_title}</td>
                {role==="admin" && <td>{r.user_name}</td>}
                <td>{r.booking_date?new Date(r.booking_date).toLocaleDateString("en-GB"):"—"}</td>
                <td>{r.seats||"—"}</td>
                <td>{fmt(r.booking_amount||r.payment_amount)}</td>
                <td>{r.booking_status}</td>
                <td>{r.payment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }

      {pages>1 &&
        <div className="rpt-pagination">
          <button onClick={()=>setPage(p=>Math.max(0,p-1))}>Prev</button>
          <span>{page+1}/{pages}</span>
          <button onClick={()=>setPage(p=>Math.min(pages-1,p+1))}>Next</button>
        </div>
      }
    </div>
  );
};

// ───────── MAIN (REAL-TIME ENABLED) ─────────
const Reports = ({user}) => {
  const role = user?.role || "user";

  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(null);
  const [sec,setSec]=useState("revenue");

  const fetchData = useCallback(async()=>{
    try{
      setLoading(true);
      setData((await api.get("/reports")).data);
    }catch(e){setErr("Failed to load");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{
    fetchData();

    socket.on("reportsUpdated", fetchData);

    return () => socket.off("reportsUpdated", fetchData);
  },[fetchData]);

  const a=data?.analytics||{};
  const s=data?.stats||{};
  const r=data?.reports||[];

  return (
    <div className="reports-page">
      <h1>Reports & Analytics</h1>

      <nav className="reports-nav">
        {["revenue","bookings","attendance","detail"].map(x=>(
          <button key={x} onClick={()=>setSec(x)}
            className={sec===x?"active":""}>{x}</button>
        ))}
      </nav>

      {loading && <Empty msg="Loading..."/>}
      {err && <div className="reports-error">{err}</div>}

      {!loading && !err && data && (
        <>
          {sec==="revenue" && <Revenue analytics={a} stats={s}/>}
          {sec==="bookings" && <BookingActivity analytics={a}/>}
          {sec==="attendance" && <Attendance analytics={a}/>}
          {sec==="detail" && <BookingsTable reports={r} role={role}/>}
        </>
      )}
    </div>
  );
};

export default Reports;