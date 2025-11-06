import React, { useState } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import "../styles/AdminDashboard.css";
import Sidebar from "./Sidebar";
import DashboardHome from "./DashboardHome";
import Events from "./Events";
import Bookings from "./Bookings";
import Users from "./Users";

/*
import Payments from "./Payments";
import Reports from "./Reports";
import SettingsPage from "./SettingsPage";
import Support from "./Support";
*/

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="main-content">
        <div className="page-container">
          <Routes>
            {/* Default Dashboard route */}
            <Route index element={<DashboardHome />} />
            <Route path="events" element={<Events />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="/users" element={<Users />} />
            {/*
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/support" element={<Support />} />
            */}

            {/* Fallback to Dashboard if route not found */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
