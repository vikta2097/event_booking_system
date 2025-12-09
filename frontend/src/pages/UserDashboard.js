import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

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
                onClick={() => window.location.href = "/my-bookings"}
              >
                My Bookings
              </button>
              <NotificationBell user={user} />
              <button className="logout-btn" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="login-btn"
                onClick={() => window.location.href = "/login"}
              >
                Login
              </button>
              <button
                className="signup-btn"
                onClick={() => window.location.href = "/register"}
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
          {/* Public home */}
          <Route
            path="/"
            element={<UserDashboardHome user={user} onLogout={onLogout} />}
          />

          {/* Contact page */}
          <Route path="/contact" element={<ContactUs />} />

          {/* Login */}
          <Route
            path="/login"
            element={
              user ? <Navigate to="/" replace /> : <LoginForm onLoginSuccess={onLoginSuccess} />
            }
          />

          {/* Register */}
          <Route
            path="/register"
            element={
              user ? <Navigate to="/" replace /> : <SignupForm onLoginSuccess={onLoginSuccess} />
            }
          />

          {/* Event details */}
          <Route path="/events/:id" element={<EventDetails user={user} />} />

          {/* Book event */}
          <Route
            path="/book/:id"
            element={
              user ? (
                <BookingForm user={user} />
              ) : (
                <Navigate to="/login" state={{ from: location.pathname }} replace />
              )
            }
          />

          {/* Payment */}
          <Route
            path="/payment/:bookingId"
            element={
              user ? (
                <PaymentPage user={user} />
              ) : (
                <Navigate to="/login" state={{ from: location.pathname }} replace />
              )
            }
          />

          {/* Booking success */}
          <Route
            path="/booking-success/:bookingId"
            element={
              user ? (
                <BookingSuccess user={user} />
              ) : (
                <Navigate to="/login" state={{ from: location.pathname }} replace />
              )
            }
          />

          {/* My bookings */}
          <Route
            path="/my-bookings"
            element={
              user ? (
                <UserBookings user={user} />
              ) : (
                <Navigate to="/login" state={{ from: location.pathname }} replace />
              )
            }
          />
        </Routes>
      </div>
    </div>
  );
};

export default UserDashboard;
