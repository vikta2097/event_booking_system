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

import NotificationBell from "./NotificationBell"; // 🔔 Notification

const UserDashboard = ({ user, token, onLogout, onLoginSuccess }) => {
  const location = useLocation();

  return (
    <div className="user-dashboard">

      {/* ====================== */}
      {/*    DASHBOARD HEADER   */}
      {/* ====================== */}
      <div className="dashboard-header">
        <h2 className="dashboard-title">EventHyper</h2>
        <div className="header-right">
          {user && <NotificationBell user={user} />}
        </div>
      </div>

      {/* ====================== */}
      {/*        ROUTES         */}
      {/* ====================== */}
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
            user ? (
              <Navigate to="/" replace />
            ) : (
              <LoginForm onLoginSuccess={onLoginSuccess} />
            )
          }
        />

        {/* Register */}
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <SignupForm onLoginSuccess={onLoginSuccess} />
            )
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
              <Navigate
                to="/login"
                state={{ from: location.pathname }}
                replace
              />
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
              <Navigate
                to="/login"
                state={{ from: location.pathname }}
                replace
              />
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
              <Navigate
                to="/login"
                state={{ from: location.pathname }}
                replace
              />
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
              <Navigate
                to="/login"
                state={{ from: location.pathname }}
                replace
              />
            )
          }
        />

      </Routes>
    </div>
  );
};

export default UserDashboard;
