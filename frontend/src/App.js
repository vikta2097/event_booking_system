import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import AuthForm from "./components/AuthForm";
import AdminDashboard from "./pages/AdminDashboard";
import OrganizerDashboard from "./Organizer/OrganizerDashboard";
import UserDashboard from "./pages/UserDashboard";

import "./styles/responsive.css";

const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const logoutTimerRef = useRef(null);

  const handleLogout = () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    localStorage.clear();
    setUser(null);
    setToken(null);
  };

  const handleLogin = ({ token, role, user }) => {
    const loginTime = Date.now();
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("loginTime", loginTime);

    setToken(token);
    setUser({ ...user, role });

    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
      alert("Session expired. Please log in again.");
    }, SESSION_TIMEOUT);
  };

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    const storedUser = localStorage.getItem("user");
    const storedLoginTime = localStorage.getItem("loginTime");

    if (storedToken && storedRole && storedUser && storedLoginTime) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const elapsed = Date.now() - Number(storedLoginTime);

        if (elapsed < SESSION_TIMEOUT) {
          setToken(storedToken);
          setUser({ ...parsedUser, role: storedRole });

          logoutTimerRef.current = setTimeout(() => {
            handleLogout();
            alert("Session expired. Please log in again.");
          }, SESSION_TIMEOUT - elapsed);
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

  const roleRedirect = () => {
    if (!user?.role) return "/dashboard";
    if (user.role === "admin") return "/admin/dashboard";
    if (user.role === "organizer") return "/organizer/dashboard";
    return "/dashboard";
  };

  return (
    <Router>
      <Routes>
        {/* ================= USER DASHBOARD ================= */}
        <Route
          path="/dashboard/*"
          element={
            <UserDashboard
              user={user}
              token={token}
              onLogout={handleLogout}
              onLoginSuccess={handleLogin}
            />
          }
        />

        {/* ================= ADMIN DASHBOARD ================= */}
        <Route
          path="/admin/dashboard/*"
          element={
            isAuthenticated && user?.role === "admin" ? (
              <AdminDashboard token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to={roleRedirect()} replace />
            )
          }
        />

        {/* ================= ORGANIZER DASHBOARD ================= */}
        <Route
          path="/organizer/dashboard/*"
          element={
            isAuthenticated && user?.role === "organizer" ? (
              <OrganizerDashboard token={token} user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to={roleRedirect()} replace />
            )
          }
        />

        {/* ================= AUTH ================= */}
        <Route
          path="/login"
          element={
            user ? <Navigate to="/dashboard" replace /> : <AuthForm onLoginSuccess={handleLogin} />
          }
        />

        {/* ================= FALLBACK ================= */}
        <Route path="*" element={<Navigate to={roleRedirect()} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
