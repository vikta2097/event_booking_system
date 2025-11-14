// UserDashboard.js
import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// Pages
import UserDashboardHome from "./UserDashboardHome";
import EventDetails from "./EventDetails";
import BookingForm from "./BookingForm";
import PaymentPage from "./PaymentPage";
import UserBookings from "./UserBookings";

// Auth components
import LoginForm from "../components/LoginForm";
import SignupForm from "../components/SignupForm";

const UserDashboard = ({ user, token, onLogout }) => {
  const location = useLocation();

  return (
    <Routes>
      {/* Public home - EVERYONE can view */}
      <Route path="/" element={<UserDashboardHome user={user} />} />

      {/* Auth routes */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginForm />
          )
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <SignupForm />
          )
        }
      />

      {/* Event details - PUBLIC (everyone can view) */}
      <Route path="/events/:id" element={<EventDetails user={user} />} />

      {/* PROTECTED ROUTES - Login required */}
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