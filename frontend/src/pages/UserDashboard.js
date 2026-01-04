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

// Import CSS
import "../styles/UserDashboard.css";

const UserDashboard = ({ user, token, onLogout, onLoginSuccess }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Logout handler that also redirects
  const handleLogout = () => {
    onLogout();           // Clear user session/state
    navigate("login");    // Redirect to login page via SPA routing (relative path)
  };

  return (
    <div className="user-dashboard">
      {/* ====================== */}
      {/*  FIXED TOP BAR         */}
      {/* ====================== */}
      <div className="user-top-bar">
        <div className="top-bar-left">
          <h2 className="brand-title">EventHyper</h2>
        </div>
        <div className="top-bar-right">
          {user ? (
            <>
              <button
                className="my-bookings-btn"
                onClick={() => navigate("my-bookings")}
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
                onClick={() => navigate("login")}
              >
                Login
              </button>
              <button
                className="signup-btn"
                onClick={() => navigate("register")}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      {/* ====================== */}
      {/*    PAGE CONTENT        */}
      {/* ====================== */}
      <div className="user-content">
        <Routes>
          {/* Home */}
          <Route
            path=""
            element={<UserDashboardHome user={user} onLogout={handleLogout} />}
          />

          {/* Contact */}
          <Route path="contact" element={<ContactUs />} />

          {/* Login & Register */}
          <Route
            path="login"
            element={
              user ? <Navigate to="" replace /> : <LoginForm onLoginSuccess={onLoginSuccess} />
            }
          />
          <Route
            path="register"
            element={
              user ? <Navigate to="" replace /> : <SignupForm onLoginSuccess={onLoginSuccess} />
            }
          />

          {/* Event Details */}
          <Route path="events/:id" element={<EventDetails user={user} />} />

          {/* Booking / Payment */}
          <Route
            path="book/:id"
            element={
              user ? <BookingForm user={user} /> : <Navigate to="login" state={{ from: location.pathname }} replace />
            }
          />
          <Route
            path="payment/:bookingId"
            element={
              user ? <PaymentPage user={user} /> : <Navigate to="login" state={{ from: location.pathname }} replace />
            }
          />
          <Route
            path="booking-success/:bookingId"
            element={
              user ? <BookingSuccess user={user} /> : <Navigate to="login" state={{ from: location.pathname }} replace />
            }
          />

          {/* My Bookings */}
          <Route
            path="my-bookings"
            element={
              user ? <UserBookings user={user} /> : <Navigate to="login" state={{ from: location.pathname }} replace />
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default UserDashboard;
