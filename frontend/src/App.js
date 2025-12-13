// src/App.js
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
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("loginTime");
    setUser(null);
    setToken(null);
  };

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

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");
    const storedUser = localStorage.getItem("user");
    const storedLoginTime = localStorage.getItem("loginTime");

    if (storedToken && storedRole && storedUser && storedLoginTime) {
      let userObj = null;
      try {
        userObj = JSON.parse(storedUser);
      } catch {
        handleLogout();
        setAuthChecked(true);
        return;
      }

      const timeElapsed = Date.now() - parseInt(storedLoginTime, 10);
      if (timeElapsed < SESSION_TIMEOUT && userObj) {
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
        {/* Root path: show user dashboard for all */}
        <Route
          path="/"
          element={
            <UserDashboard
              user={user}
              token={token}
              onLogout={handleLogout}
              onLoginSuccess={handleLogin}
            />
          }
        />

        {/* Reset Password */}
        <Route
          path="/reset-password/:token"
          element={<AuthForm onLoginSuccess={handleLogin} />}
        />

        {/* Login */}
        <Route
          path="/login"
          element={<AuthForm onLoginSuccess={handleLogin} />}
        />

        {/* Admin dashboard (protected) */}
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

        {/* Organizer dashboard (protected) */}
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

        {/* User dashboard (protected) */}
        <Route
          path="/dashboard/*"
          element={
            isAuthenticated && user?.role === "user" ? (
              <UserDashboard
                user={user}
                token={token}
                onLogout={handleLogout}
                onLoginSuccess={handleLogin}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
