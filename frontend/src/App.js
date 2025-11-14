import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthForm from "./components/AuthForm";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [token, setToken] = useState(null);
  const logoutTimerRef = useRef(null);
  const SESSION_TIMEOUT = 2 * 60 * 60 * 1000;

  const handleLogout = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    localStorage.clear();
    setIsAuthenticated(false);
    setUserRole(null);
    setToken(null);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    const storedLoginTime = localStorage.getItem("loginTime");

    if (storedToken && storedRole && storedLoginTime) {
      const timeElapsed = Date.now() - parseInt(storedLoginTime, 10);
      if (timeElapsed < SESSION_TIMEOUT) {
        setIsAuthenticated(true);
        setUserRole(storedRole);
        setToken(storedToken);

        const remainingTime = SESSION_TIMEOUT - timeElapsed;
        logoutTimerRef.current = setTimeout(() => {
          handleLogout();
          alert("Session expired. Please log in again.");
        }, remainingTime);
      } else handleLogout();
    }

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [SESSION_TIMEOUT]);

  const handleLogin = ({ token, role }) => {
    const loginTime = Date.now();
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("loginTime", loginTime);

    setIsAuthenticated(true);
    setUserRole(role);
    setToken(token);

    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
      alert("Session expired. Please log in again.");
    }, SESSION_TIMEOUT);
  };

  return (
    <Router>
      <Routes>
        {/* Login / Auth */}
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
          element={<UserDashboard token={token} onLogout={handleLogout} />}
        />

        {/* Default */}
        <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
