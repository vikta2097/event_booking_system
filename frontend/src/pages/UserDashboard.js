import React from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

// Pages
import UserDashboardHome from "./UserDashboardHome";
import EventDetails from "./EventDetails";
import BookingForm from "./BookingForm";
import PaymentPage from "./PaymentPage";
import BookingSuccess from "./BookingSuccess";
import UserBookings from "./UserBookings";
import ContactUs from "./ContactUs";

// Components
import NotificationBell from "./NotificationBell";

// Styles
import "../styles/UserDashboard.css";

const UserDashboard = ({ user, token, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate("/auth/login", { replace: true });
  };

  return (
    <div className="user-dashboard">
      {/* ================= TOP BAR ================= */}
      <div
        className="user-top-bar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <div className="top-bar-left">
          <h2
            className="brand-title"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/dashboard")}
          >
            EventHyper
          </h2>
        </div>

        <div className="top-bar-right">
          {user ? (
            <>
              <button
                className="my-bookings-btn"
                onClick={() => navigate("/dashboard/my-bookings")}
              >
                My Bookings
              </button>

              <NotificationBell user={user} />

              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="login-btn"
                onClick={() => navigate("/auth/login")}
              >
                Login
              </button>

              <button
                className="signup-btn"
                onClick={() => navigate("/auth/login")}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="user-content" style={{ paddingTop: "80px" }}>
        <Routes>
          <Route index element={<UserDashboardHome user={user} />} />
          <Route path="contact" element={<ContactUs />} />
          <Route path="events/:id" element={<EventDetails user={user} />} />

          <Route
            path="book/:id"
            element={
              user ? (
                <BookingForm user={user} />
              ) : (
                <Navigate
                  to="/auth/login"
                  state={{ from: location.pathname }}
                  replace
                />
              )
            }
          />

          <Route
            path="payment/:bookingId"
            element={
              user ? (
                <PaymentPage user={user} />
              ) : (
                <Navigate to="/auth/login" replace />
              )
            }
          />

          <Route
            path="booking-success/:bookingId"
            element={
              user ? (
                <BookingSuccess user={user} />
              ) : (
                <Navigate to="/auth/login" replace />
              )
            }
          />

          <Route
            path="my-bookings"
            element={
              user ? (
                <UserBookings user={user} />
              ) : (
                <Navigate to="/auth/login" replace />
              )
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default UserDashboard;
