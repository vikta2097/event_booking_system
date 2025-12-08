import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/Sidebar.css";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  BarChart3,
  MessageCircle,
  LogOut,
  ScanLine,
} from "lucide-react";

const OrganizerSidebar = ({ sidebarOpen, setSidebarOpen, onLogout }) => {
  const navItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/organizer/dashboard" },
    { name: "My Events", icon: <CalendarDays size={18} />, path: "/organizer/dashboard/events" },
    { name: "Bookings", icon: <ClipboardList size={18} />, path: "/organizer/dashboard/bookings" },
    { name: "Scan Tickets", icon: <ScanLine size={18} />, path: "/organizer/dashboard/scan" },
    { name: "Reports", icon: <BarChart3 size={18} />, path: "/organizer/dashboard/reports" },
    { name: "Support", icon: <MessageCircle size={18} />, path: "/organizer/dashboard/support" },
  ];

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
      {/* Header */}
      <div className="sidebar-header">
        <h2 className={`sidebar-title ${!sidebarOpen ? "hidden" : ""}`}>
          Organizer Panel
        </h2>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="toggle-btn"
        >
          ☰
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {navItems.map((item, idx) => (
          <NavLink
            key={idx}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }
          >
            {item.icon}
            <span className={`link-text ${!sidebarOpen ? "hidden" : ""}`}>
              {item.name}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Footer / Logout */}
      <div className="sidebar-footer">
        <button onClick={onLogout} className="logout-btn">
          <LogOut size={18} />
          <span className={`${!sidebarOpen ? "hidden" : ""}`}>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default OrganizerSidebar;
