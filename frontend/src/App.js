import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import UserDashboardHome from "./components/UserDashboardHome";
import BookingPage from "./pages/BookingPage"; // ✅ Booking page route
import AdminDashboard from "./pages/AdminDashboard";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import NotFound from "./pages/NotFound";

function App() {
  const [user, setUser] = useState(null);

  // Optional: fetch user from localStorage / API on app load
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const userId = localStorage.getItem("userId");

    if (token && role && userId) {
      setUser({ token, role, id: userId });
    }
  }, []);

  const handleLoginSuccess = (userObj) => {
    setUser(userObj.user); // full user object
  };

  const ProtectedRoute = ({ children }) => {
    if (!user) {
      // Guest → redirect to login with post-login redirect
      return <Navigate to="/dashboard/login" state={{ from: window.location.pathname }} replace />;
    }
    return children;
  };

  return (
    <Router>
      <Routes>
        {/* ===== LOGIN ===== */}
        <Route
          path="/dashboard/login"
          element={<LoginForm onLoginSuccess={handleLoginSuccess} />}
        />

        {/* ===== USER DASHBOARD HOME ===== */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <UserDashboardHome user={user} />
            </ProtectedRoute>
          }
        />

        {/* ===== BOOKING PAGE ===== */}
        <Route
          path="/dashboard/book/:id"
          element={
            <ProtectedRoute>
              <BookingPage user={user} />
            </ProtectedRoute>
          }
        />

        {/* ===== ADMIN DASHBOARD ===== */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              {user?.role === "admin" ? <AdminDashboard /> : <Navigate to="/dashboard" replace />}
            </ProtectedRoute>
          }
        />

        {/* ===== ORGANIZER DASHBOARD ===== */}
        <Route
          path="/organizer/dashboard"
          element={
            <ProtectedRoute>
              {user?.role === "organizer" ? <OrganizerDashboard /> : <Navigate to="/dashboard" replace />}
            </ProtectedRoute>
          }
        />

        {/* ===== FALLBACK / 404 ===== */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
