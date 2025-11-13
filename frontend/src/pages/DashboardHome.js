import React, { useState, useEffect } from "react";
import api from "../api"; // ✅ centralized axios instance
import "../styles/DashboardHome.css";

const DashboardHome = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await api.get("/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboardData(response.data);
      setError("");
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Failed to load dashboard data");
      } else {
        setError("Failed to load dashboard data. Check your network or backend.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-screen">Loading dashboard...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!dashboardData) return <div className="error-message">No data available</div>;

  const { totals, recentActivity, upcomingEvents, recentPayments } = dashboardData;

  return (
    <div className="dashboard-home">
      <div className="dashboard-header">
        <h1>Dashboard Overview</h1>
        <p>Welcome back! Here's what's happening with your events.</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon events">📅</div>
          <div className="stat-content">
            <h3>Total Events</h3>
            <p className="stat-number">{totals.totalEvents}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bookings">🎟️</div>
          <div className="stat-content">
            <h3>Total Bookings</h3>
            <p className="stat-number">{totals.totalBookings}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon revenue">💰</div>
          <div className="stat-content">
            <h3>Total Revenue</h3>
            <p className="stat-number">
              KES {totals.totalRevenue.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="dashboard-grid">
        {/* Upcoming Events */}
        <div className="dashboard-card">
          <h2>Upcoming Events</h2>
          {upcomingEvents?.length ? (
            <ul className="event-list">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="event-item">
                  <span className="event-title">{event.title}</span>
                  <span className="event-date">
                    {new Date(event.event_date).toLocaleDateString()} at {event.start_time}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">No upcoming events</p>
          )}
        </div>

        {/* Recent Bookings */}
        <div className="dashboard-card">
          <h2>Recent Bookings</h2>
          {recentActivity?.bookings?.length ? (
            <ul className="booking-list">
              {recentActivity.bookings.map((booking) => (
                <li key={booking.id} className="booking-item">
                  <span className="booking-id">Booking #{booking.id}</span>
                  <span className="booking-date">
                    {new Date(booking.booking_date).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">No recent bookings</p>
          )}
        </div>

        {/* Recent Events */}
        <div className="dashboard-card">
          <h2>Recent Events</h2>
          {recentActivity?.events?.length ? (
            <ul className="event-list">
              {recentActivity.events.map((event) => (
                <li key={event.id} className="event-item">
                  <span className="event-title">{event.title}</span>
                  <span className="event-date">
                    {new Date(event.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">No recent events</p>
          )}
        </div>

        {/* Recent Payments */}
        <div className="dashboard-card">
          <h2>Recent Payments</h2>
          {recentPayments?.length ? (
            <ul className="payment-list">
              {recentPayments.map((payment) => (
                <li key={payment.id} className="payment-item">
                  <span className="payment-method">{payment.method}</span>
                  <span className="payment-amount">
                    KES {parseFloat(payment.amount).toLocaleString()}
                  </span>
                  <span className="payment-date">
                    {new Date(payment.paid_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">No recent payments</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
