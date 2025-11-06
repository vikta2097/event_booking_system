import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import API_BASE_URL from "./api";
import AuthForm from "./components/AuthForm";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);

  // Duration before auto logout (2 hours = 7200000 ms)
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    const storedUserId = localStorage.getItem("userId");
    const storedLoginTime = localStorage.getItem("loginTime");

    if (storedToken && storedRole && storedUserId && storedLoginTime) {
      const timeElapsed = Date.now() - parseInt(storedLoginTime, 10);

      if (timeElapsed < SESSION_TIMEOUT) {
        setIsAuthenticated(true);
        setUserRole(storedRole);
        setToken(storedToken);
        setUserId(storedUserId);

        // Set timeout for remaining time
        const remainingTime = SESSION_TIMEOUT - timeElapsed;
        const timer = setTimeout(() => {
          handleLogout();
          alert("Session expired. Please log in again.");
        }, remainingTime);

        return () => clearTimeout(timer);
      } else {
        handleLogout();
      }
    }
  }, []);

  const handleLogin = ({ token, role, userId }) => {
    const loginTime = Date.now();

    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("userId", userId);
    localStorage.setItem("loginTime", loginTime);

    setIsAuthenticated(true);
    setUserRole(role);
    setToken(token);
    setUserId(userId);

    // Set auto logout timer
    const timer = setTimeout(() => {
      handleLogout();
      alert("Session expired. Please log in again.");
    }, SESSION_TIMEOUT);

    return () => clearTimeout(timer);
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setUserRole(null);
    setToken(null);
    setUserId(null);
  };

  return (
    <Router>
      <Routes>
        {/* Login route */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={userRole === "admin" ? "/admin/dashboard" : "/user/dashboard"} replace />
            ) : (
              <AuthForm onLoginSuccess={handleLogin} />
            )
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin/dashboard/*"
          element={
            isAuthenticated && userRole === "admin" ? (
              <AdminDashboard token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* User Dashboard */}
        <Route
          path="/user/dashboard/*"
          element={
            isAuthenticated && userRole === "user" ? (
              <UserDashboard token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
