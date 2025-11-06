import React from "react";
import "../styles/DashboardHome.css";

const DashboardHome = () => {
  return (
    <div className="dashboard-home">
      <h1 className="dashboard-title">Admin Dashboard Overview</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h2>Total Events</h2>
          <p>24</p>
        </div>
        <div className="stat-card">
          <h2>Total Bookings</h2>
          <p>142</p>
        </div>
        <div className="stat-card">
          <h2>Total Revenue</h2>
          <p>$12,300</p>
        </div>
      </div>

      <div className="activity-section">
        <h2>Recent Activity</h2>
        <ul>
          <li>New event “Tech Expo 2025” added</li>
          <li>5 new bookings confirmed today</li>
          <li>Refund processed for Event #102</li>
        </ul>
      </div>
    </div>
  );
};

export default DashboardHome;
