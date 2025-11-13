import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Pages
import UserDashboardHome from "./UserDashboardHome";
import EventDetails from "./EventDetails";
import BookingForm from "./BookingForm";
import PaymentPage from "./PaymentPage";
import UserBookings from "./UserBookings";

// Auth components
import LoginForm from "../components/LoginForm";
import SignupForm from "../components/SignupForm";

const UserDashboard = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loggedInUser = JSON.parse(localStorage.getItem("user"));
    setUser(loggedInUser);
  }, []);

  return (
    <Routes>
      {/* Dynamic home */}
      <Route path="/" element={<UserDashboardHome user={user} />} />

      {/* Auth */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" /> : <LoginForm setUser={setUser} />}
      />
      <Route
        path="/register"
        element={user ? <Navigate to="/" /> : <SignupForm setUser={setUser} />}
      />

      {/* Event details */}
      <Route path="/events/:id" element={<EventDetails user={user} />} />

      {/* Protected booking/payment */}
      <Route
        path="/book/:id"
        element={user ? <BookingForm user={user} /> : <Navigate to="/login" />}
      />
      <Route
        path="/payment/:bookingId"
        element={user ? <PaymentPage user={user} /> : <Navigate to="/login" />}
      />

      {/* User bookings */}
      <Route
        path="/my-bookings"
        element={user ? <UserBookings user={user} /> : <Navigate to="/login" />}
      />
    </Routes>
  );
};

export default UserDashboard;
