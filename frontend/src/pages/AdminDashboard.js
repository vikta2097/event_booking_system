import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "../styles/AdminDashboard.css";
import Sidebar from "./Sidebar";
import DashboardHome from "./DashboardHome";
import Events from "./Events";
import Bookings from "./Bookings";
import Users from "./Users";
import Payments from "./Payments";
import Reports from "./Reports";
import Settings from "./Settings";
import Support from "./Support";

const AdminDashboard = ({ onLogout }) => {
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
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={onLogout}
      />
      <main className="main-content">
        <div className="page-container">
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="events" element={<Events currentUser={currentUser} />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="users" element={<Users />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings currentUser={currentUser} />} />
            <Route path="support" element={<Support />} />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
