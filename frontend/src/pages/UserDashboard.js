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

// Auth components
import LoginForm from "../components/LoginForm";
import SignupForm from "../components/SignupForm";

// Components
import NotificationBell from "./NotificationBell";

// Styles
import "../styles/UserDashboard.css";

const UserDashboard = ({ user, token, onLogout, onLoginSuccess }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Logout clears session and sends user to login
  const handleLogout = () => {
    onLogout();
    navigate("/dashboard/login", { replace: true }); // ✅ absolute path
  };

  return (
    <div className="user-dashboard">
      {/* ====================== */}
      {/* FIXED TOP BAR          */}
      {/* ====================== */}
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
            onClick={() => navigate("/dashboard")} // ✅ absolute path
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

              <NotificationBell
                user={user}
                unreadCount={user.unreadNotifications || 0}
              />

              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="login-btn"
                onClick={() => navigate("/dashboard/login")}
              >
                Login
              </button>

              <button
                className="signup-btn"
                onClick={() => navigate("/dashboard/register")}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      {/* ====================== */}
      {/* PAGE CONTENT           */}
      {/* ====================== */}
      <div className="user-content" style={{ paddingTop: "80px" }}>
        <Routes>
          {/* Home */}
          <Route path="" element={<UserDashboardHome user={user} />} />

          {/* Contact */}
          <Route path="contact" element={<ContactUs />} />

          {/* Login & Register */}
          <Route
            path="login"
            element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginForm onLoginSuccess={onLoginSuccess} />
              )
            }
          />
          <Route
            path="register"
            element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <SignupForm onLoginSuccess={onLoginSuccess} />
              )
            }
          />

          {/* Event Details */}
          <Route path="events/:id" element={<EventDetails user={user} />} />

          {/* Booking / Payment */}
          <Route
            path="book/:id"
            element={
              user ? (
                <BookingForm user={user} />
              ) : (
                <Navigate
                  to="/dashboard/login"
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
                <Navigate
                  to="/dashboard/login"
                  state={{ from: location.pathname }}
                  replace
                />
              )
            }
          />

          <Route
            path="booking-success/:bookingId"
            element={
              user ? (
                <BookingSuccess user={user} />
              ) : (
                <Navigate to="/dashboard/login" replace />
              )
            }
          />

          {/* My Bookings */}
          <Route
            path="my-bookings"
            element={
              user ? (
                <UserBookings user={user} />
              ) : (
                <Navigate
                  to="/dashboard/login"
                  state={{ from: location.pathname }}
                  replace
                />
              )
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default UserDashboard;
