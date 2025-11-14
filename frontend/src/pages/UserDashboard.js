import React, { useState, useEffect } from "react";
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

const UserDashboard = () => {
  const [user, setUser] = useState(null);
  const location = useLocation();

  // Track where the user tried to go (for redirect after login)
  const [redirectAfterLogin, setRedirectAfterLogin] = useState(null);

  useEffect(() => {
    const loggedInUser = JSON.parse(localStorage.getItem("user"));
    setUser(loggedInUser);
  }, []);

  const requireAuth = (component) => {
    if (!user) {
      setRedirectAfterLogin(location.pathname);
      return <Navigate to="/login" />;
    }
    return component;
  };

  const handleLoginSuccess = (loggedUser) => {
    setUser(loggedUser);
    localStorage.setItem("user", JSON.stringify(loggedUser));

    if (redirectAfterLogin) {
      window.location.href = redirectAfterLogin; // redirect to the page user wanted
      setRedirectAfterLogin(null);
    }
  };

  return (
    <Routes>
      {/* Public home */}
      <Route path="/" element={<UserDashboardHome user={user} />} />

      {/* Auth */}
      <Route
        path="/login"
        element={user ? (
          <Navigate to="/" />
        ) : (
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        )}
      />
      <Route
        path="/register"
        element={user ? (
          <Navigate to="/" />
        ) : (
          <SignupForm onLoginSuccess={handleLoginSuccess} />
        )}
      />

      {/* Event details (public) */}
      <Route path="/events/:id" element={<EventDetails user={user} />} />

      {/* Protected booking/payment */}
      <Route
        path="/book/:id"
        element={requireAuth(<BookingForm user={user} />)}
      />
      <Route
        path="/payment/:bookingId"
        element={requireAuth(<PaymentPage user={user} />)}
      />

      {/* User bookings */}
      <Route
        path="/my-bookings"
        element={requireAuth(<UserBookings user={user} />)}
      />
    </Routes>
  );
};

export default UserDashboard;
