import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthForm from "./components/AuthForm";
import AdminDashboard from "./pages/AdminDashboard";
import OrganizerDashboard from "./Organizer/OrganizerDashboard";
import UserDashboard from "./pages/UserDashboard";
import BookingForm from "./pages/BookingForm"; // ✅ new booking page route
import "./styles/responsive.css";

const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const logoutTimerRef = useRef(null);

  // Logout handler
  const handleLogout = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("loginTime");
    setUser(null);
    setToken(null);
  };

  // Login handler
  const handleLogin = ({ token, role, user }) => {
    const loginTime = Date.now();
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("loginTime", loginTime);
    localStorage.setItem("user", JSON.stringify(user));

    setToken(token);
    setUser({ ...user, role });

    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
      alert("Session expired. Please log in again.");
    }, SESSION_TIMEOUT);
  };

  // Restore session on page load
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    const storedUser = localStorage.getItem("user");
    const storedLoginTime = localStorage.getItem("loginTime");

    if (storedToken && storedRole && storedUser && storedLoginTime) {
      try {
        const userObj = JSON.parse(storedUser);
        const timeElapsed = Date.now() - Number(storedLoginTime);

        if (timeElapsed < SESSION_TIMEOUT) {
          setToken(storedToken);
          setUser({ ...userObj, role: storedRole });

          const remainingTime = SESSION_TIMEOUT - timeElapsed;
          logoutTimerRef.current = setTimeout(() => {
            handleLogout();
            alert("Session expired. Please log in again.");
          }, remainingTime);
        } else {
          handleLogout();
        }
      } catch {
        handleLogout();
      }
    }

    setAuthChecked(true);

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  if (!authChecked) return <div>Loading...</div>;

  const isAuthenticated = !!token;

  return (
    <Router>
      <Routes>
        {/* Root / dashboard routes */}
        <Route path="/dashboard/*" element={<UserDashboard user={user} token={token} onLogout={handleLogout} onLoginSuccess={handleLogin} />} />

        {/* Booking route (protected) */}
        <Route
          path="/dashboard/book/:id"
          element={
            isAuthenticated ? (
              <BookingForm user={user} token={token} />
            ) : (
              <Navigate
                to="/dashboard/login"
                state={{ from: window.location.pathname }}
                replace
              />
            )
          }
        />

        {/* Login / Auth */}
        <Route
          path="/dashboard/login"
          element={<AuthForm onLoginSuccess={handleLogin} />}
        />
        <Route
          path="/reset-password/:token"
          element={<AuthForm onLoginSuccess={handleLogin} />}
        />

        {/* Admin dashboard */}
        <Route
          path="/admin/dashboard/*"
          element={
            isAuthenticated && user?.role === "admin" ? (
              <AdminDashboard token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        {/* Organizer dashboard */}
        <Route
          path="/organizer/dashboard/*"
          element={
            isAuthenticated && user?.role === "organizer" ? (
              <OrganizerDashboard token={token} user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
