import React, { useState, useEffect } from "react";
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
  ScanLine,
  Menu,
  X,
} from "lucide-react";

// Nav items per role — basePath injected so paths stay correct
const getNavItems = (role, basePath) => {
  const shared = [
    { name: "Dashboard",    icon: <LayoutDashboard size={18} />, path: basePath },
    { name: "My Events",    icon: <CalendarDays size={18} />,    path: `${basePath}/events` },
    { name: "Bookings",     icon: <ClipboardList size={18} />,   path: `${basePath}/bookings` },
    { name: "Scan Tickets", icon: <ScanLine size={18} />,        path: `${basePath}/scan` },
    { name: "Reports",      icon: <BarChart3 size={18} />,       path: `${basePath}/reports` },
  ];

  if (role === "admin") {
    return [
      { name: "Dashboard",    icon: <LayoutDashboard size={18} />, path: basePath },
      { name: "Events",       icon: <CalendarDays size={18} />,    path: `${basePath}/events` },
      { name: "Users",        icon: <Users size={18} />,           path: `${basePath}/users` },
      { name: "Bookings",     icon: <ClipboardList size={18} />,   path: `${basePath}/bookings` },
      { name: "Payments",     icon: <CreditCard size={18} />,      path: `${basePath}/payments` },
      { name: "Scan Tickets", icon: <ScanLine size={18} />,        path: `${basePath}/scan` },
      { name: "Reports",      icon: <BarChart3 size={18} />,       path: `${basePath}/reports` },
      { name: "Settings",     icon: <Settings size={18} />,        path: `${basePath}/settings` },
      { name: "Support",      icon: <MessageCircle size={18} />,   path: `${basePath}/support` },
      { name: "Security",     icon: <Shield size={18} />,          path: `${basePath}/security` },
    ];
  }

  if (role === "organizer") {
    return [
      ...shared,
      { name: "Support", icon: <MessageCircle size={18} />, path: `${basePath}/support` },
    ];
  }

  return shared;
};

const Sidebar = ({ sidebarOpen, setSidebarOpen, onLogout, role = "admin", basePath = "/admin/dashboard" }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = getNavItems(role, basePath);

  const label = role === "admin" ? "Admin Panel" : "Organizer Panel";

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [mobileOpen]);

  return (
    <>
      {/* Hamburger — visible on mobile OR when sidebar is collapsed on any width */}
      <button
        className={`mobile-menu-toggle ${!sidebarOpen ? "always-visible" : ""}`}
        onClick={() => {
          if (window.innerWidth <= 768) {
            setMobileOpen(!mobileOpen);
          } else {
            setSidebarOpen(true);
          }
        }}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"} ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <h2 className={`sidebar-title ${!sidebarOpen ? "hidden" : ""}`}>
            {label}
          </h2>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="toggle-btn"
            aria-label="Collapse sidebar"
          >
            ☰
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item, idx) => (
            <NavLink
              key={idx}
              to={item.path}
              end={item.path === basePath} // exact match only for root dashboard link
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              {item.icon}
              <span className={`link-text ${!sidebarOpen ? "hidden" : ""}`}>
                {item.name}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button onClick={onLogout} className="logout-btn">
            <LogOut size={18} />
            <span className={!sidebarOpen ? "hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;