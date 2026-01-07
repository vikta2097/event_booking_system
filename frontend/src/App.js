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

  return (
    <Router>
      <Routes>
        {/* ================= USER DASHBOARD (Public + User routes) ================= */}
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
            ) : isAuthenticated ? (
              // If authenticated but not admin, redirect to their correct dashboard
              user?.role === "organizer" ? (
                <Navigate to="/organizer/dashboard" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              // If not authenticated, redirect to public dashboard
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* ================= ORGANIZER DASHBOARD ================= */}
        <Route
          path="/organizer/dashboard/*"
          element={
            isAuthenticated && user?.role === "organizer" ? (
              <OrganizerDashboard token={token} user={user} onLogout={handleLogout} />
            ) : isAuthenticated ? (
              // If authenticated but not organizer, redirect to their correct dashboard
              user?.role === "admin" ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              // If not authenticated, redirect to public dashboard
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* ================= AUTH (Legacy route - redirect to dashboard) ================= */}
        <Route
          path="/login"
          element={<Navigate to="/dashboard/login" replace />}
        />

        {/* ================= ROOT & FALLBACK ================= */}
        {/* Root path: redirect based on authentication */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              // Authenticated users go to their role-specific dashboard
              user?.role === "admin" ? (
                <Navigate to="/admin/dashboard" replace />
              ) : user?.role === "organizer" ? (
                <Navigate to="/organizer/dashboard" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              // Unauthenticated users go to public dashboard
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* All other paths: redirect to public dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;