import React, { useState, useEffect } from "react";
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
  Menu,
  X,
} from "lucide-react";

const OrganizerSidebar = ({ sidebarOpen, setSidebarOpen, onLogout }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/organizer/dashboard" },
    { name: "My Events", icon: <CalendarDays size={18} />, path: "/organizer/dashboard/events" },
    { name: "Bookings", icon: <ClipboardList size={18} />, path: "/organizer/dashboard/bookings" },
    { name: "Scan Tickets", icon: <ScanLine size={18} />, path: "/organizer/dashboard/scan" },
    { name: "Reports", icon: <BarChart3 size={18} />, path: "/organizer/dashboard/reports" },
    { name: "Support", icon: <MessageCircle size={18} />, path: "/organizer/dashboard/support" },
  ];

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [window.location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button 
        className="mobile-menu-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          position: 'fixed',
          top: '15px',
          left: '15px',
          zIndex: 1001,
          background: '#0d47a1',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '10px',
          cursor: 'pointer',
          display: 'none',
        }}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"} ${mobileOpen ? "mobile-open" : ""}`}>
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
              onClick={() => setMobileOpen(false)}
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

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'none',
          }}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-toggle {
            display: block !important;
          }
          
          .mobile-overlay {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
};

export default OrganizerSidebar;