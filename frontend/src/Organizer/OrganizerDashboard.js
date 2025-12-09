import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "../styles/AdminDashboard.css";
import "../styles/OrganizerDashboard.css";
import OrganizerSidebar from "./OrganizerSidebar"; 
import DashboardHome from "./DashboardHome";
import Events from "../pages/Events";
import OrganizerBookings from "./OrganizerBookings"; 
import OrganizerReports from "./OrganizerReports";   
import TicketScanner from "./TicketScanner"; 
import ChatbotWidget from "./ChatbotWidget";
import NotificationBell from "../pages/NotificationBell";  // ✅ ADD THIS

const OrganizerDashboard = ({ onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("role");
    const id = localStorage.getItem("userId");
    setCurrentUser({ id, role });
    setReady(true);
  }, []);

  if (!ready) return <div className="loading-screen">Loading dashboard...</div>;

  return (
    <div className="admin-dashboard">
      <OrganizerSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={onLogout}
      />

      <main className="main-content">

        {/* 🔔 Notification bell in dashboard header */}
        <div className="dashboard-header">
          <div className="header-right">
            <NotificationBell userId={currentUser?.id} />
          </div>
        </div>

        <div className="page-container">
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="events" element={<Events currentUser={currentUser} />} />
            <Route path="bookings" element={<OrganizerBookings currentUser={currentUser} />} />
            <Route path="reports" element={<OrganizerReports currentUser={currentUser} />} />
            <Route path="scan" element={<TicketScanner />} /> 
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        </div>
      </main>

      <ChatbotWidget user={currentUser} />
    </div>
  );
};

export default OrganizerDashboard;
