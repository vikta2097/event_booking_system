import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// Pages
import UserDashboardHome from "./UserDashboardHome";
import EventDetails from "./EventDetails";
import BookingForm from "./BookingForm";
import PaymentPage from "./PaymentPage";
import BookingSuccess from "./BookingSuccess"; 
import UserBookings from "./UserBookings";

// Auth components
import LoginForm from "../components/LoginForm";
import SignupForm from "../components/SignupForm";

const UserDashboard = ({ user, token, onLogout, onLoginSuccess }) => {
  const location = useLocation();

  return (
    <Routes>
      {/* Public home */}
      <Route path="/" element={<UserDashboardHome user={user} />} />

      {/* Login/Register */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginForm onLoginSuccess={onLoginSuccess} />
          )
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <SignupForm onLoginSuccess={onLoginSuccess} />
          )
        }
      />

      {/* Event details - public */}
      <Route path="/events/:id" element={<EventDetails user={user} />} />

      {/* Protected routes */}
      <Route
        path="/book/:id"
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
        path="/payment/:bookingId"
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
        path="/booking-success/:bookingId"
        element={
          user ? (
            <BookingSuccess user={user} />
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
        path="/my-bookings"
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
    </Routes>
  );
};

export default UserDashboard;
