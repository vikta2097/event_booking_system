import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/Sidebar.css";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardList,
  CreditCard,
  BarChart3,
  Settings,
  MessageCircle,
  Shield,
  LogOut,
  ScanLine, // Add this import for scanner icon
} from "lucide-react";

const Sidebar = ({ sidebarOpen, setSidebarOpen, onLogout }) => {
  const navItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/admin/dashboard" },
    { name: "Events", icon: <CalendarDays size={18} />, path: "/admin/dashboard/events" },
    { name: "Users", icon: <Users size={18} />, path: "/admin/dashboard/users" },
    { name: "Bookings", icon: <ClipboardList size={18} />, path: "/admin/dashboard/bookings" },
    { name: "Payments", icon: <CreditCard size={18} />, path: "/admin/dashboard/payments" },
    { name: "Scan Tickets", icon: <ScanLine size={18} />, path: "/admin/dashboard/scan" }, // Add this
    { name: "Reports", icon: <BarChart3 size={18} />, path: "/admin/dashboard/reports" },
    { name: "Settings", icon: <Settings size={18} />, path: "/admin/dashboard/settings" },
    { name: "Support", icon: <MessageCircle size={18} />, path: "/admin/dashboard/support" },
    { name: "Security", icon: <Shield size={18} />, path: "/admin/dashboard/security" },
  ];

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
      {/* Header */}
      <div className="sidebar-header">
        <h2 className={`sidebar-title ${!sidebarOpen ? "hidden" : ""}`}>
          Admin Panel
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

export default Sidebar;