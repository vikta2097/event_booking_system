import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "../styles/AdminDashboard.css";
import "../styles/OrganizerDashboard.css";

import Sidebar from "./Sidebar";
import DashboardHome from "./DashboardHome";
import Events from "./Events";
import ChatbotWidget from "./ChatbotWidget";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

// Admin-only pages
import Bookings from "./Bookings";
import Users from "./Users";
import Payments from "./Payments";
import Reports from "./Reports";
import Settings from "./Settings";
import Support from "./Support";
import TicketScanner from "./TicketScanner";

// Organizer-only pages
import OrganizerBookings from "../Organizer/OrganizerBookings";
import OrganizerReports from "../Organizer/OrganizerReports";

const Dashboard = ({ onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const id = localStorage.getItem("userId");
    setCurrentUser({ id: Number(id), role });
    setReady(true);
  }, []);

  if (!ready) return <div className="loading-screen">Loading dashboard...</div>;

  const isAdmin = currentUser?.role === "admin";
  const isOrganizer = currentUser?.role === "organizer";
  const basePath = isAdmin ? "/admin/dashboard" : "/organizer/dashboard";

  return (
    <div className="admin-dashboard">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={onLogout}
        role={currentUser?.role}
        basePath={basePath}
      />

      <main className="main-content">
        <div className="page-container">

          {/* Fixed top-right header: theme toggle + bell */}
          <div className="dashboard-header">
            <div className="header-right">
              <ThemeToggle />
              {currentUser && <NotificationBell user={currentUser} />}
            </div>
          </div>

          {/* ── ADMIN ROUTES ── */}
          {isAdmin && (
            <Routes>
              <Route index element={<DashboardHome />} />
              <Route path="events"   element={<Events currentUser={currentUser} />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="users"    element={<Users />} />
              <Route path="payments" element={<Payments />} />
              <Route path="reports"  element={<Reports />} />
              <Route path="settings" element={<Settings currentUser={currentUser} />} />
              <Route path="support"  element={<Support currentUser={currentUser} />} />
              <Route path="scan"     element={<TicketScanner />} />
              <Route path="*"        element={<Navigate to="." replace />} />
            </Routes>
          )}

          {/* ── ORGANIZER ROUTES ── */}
          {isOrganizer && (
            <Routes>
              <Route index element={<DashboardHome />} />
              <Route path="events"   element={<Events currentUser={currentUser} />} />
              <Route path="bookings" element={<OrganizerBookings currentUser={currentUser} />} />
              <Route path="reports"  element={<OrganizerReports currentUser={currentUser} />} />
              <Route path="scan"     element={<TicketScanner />} />
              <Route path="*"        element={<Navigate to="." replace />} />
            </Routes>
          )}

        </div>
      </main>

      <ChatbotWidget user={currentUser} />
    </div>
  );
};

export default Dashboard;