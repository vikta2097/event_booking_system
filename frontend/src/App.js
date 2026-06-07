import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

// Unified dashboard (replaces AdminDashboard + OrganizerDashboard)
import Dashboard from "./pages/Dashboard";

// User-facing dashboard
import UserDashboard from "./pages/UserDashboard";

// Auth
import LoginForm from "./components/LoginForm";

// Styles
import "./styles/responsive.css";

const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

// Reads location.state.from so we can return the user to where they came from
function LoginRedirectWrapper({ onLoginSuccess }) {
  const location = useLocation();
  const from = location.state?.from || null;

  const handleLogin = (result) => {
    onLoginSuccess(result, from);
  };

  return <LoginForm onLoginSuccess={handleLogin} />;
}

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

  const handleLogin = ({ token, role, user }, redirectTo = null) => {
    const loginTime = Date.now();
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("loginTime", loginTime);

    setToken(token);
    setUser({ ...user, role });

    // If there's a specific page to return to (e.g. event detail), store it
    if (redirectTo) {
      localStorage.setItem("postLoginRedirect", redirectTo);
    }

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
    return () => logoutTimerRef.current && clearTimeout(logoutTimerRef.current);
  }, []);

  if (!authChecked) return <div>Loading...</div>;

  const isAuthenticated = !!token;
  const role = user?.role;

  // Where to redirect after login based on role
  const dashboardPath =
    role === "admin" ? "/admin/dashboard" :
    role === "organizer" ? "/organizer/dashboard" :
    "/dashboard";

  return (
    <Router>
      <Routes>

        {/* ── AUTH ── */}
        <Route
          path="/auth/login"
          element={
            isAuthenticated
              ? <Navigate to={dashboardPath} replace />
              : <LoginRedirectWrapper onLoginSuccess={handleLogin} />
          }
        />

        {/* ── USER DASHBOARD ── */}
        <Route
          path="/dashboard/*"
          element={
            isAuthenticated && (role === "admin" || role === "organizer")
              ? <Navigate to={dashboardPath} replace />
              : <UserDashboard user={user} token={token} onLogout={handleLogout} />
          }
        />

        {/* ── ADMIN DASHBOARD (unified) ── */}
        <Route
          path="/admin/dashboard/*"
          element={
            isAuthenticated && role === "admin"
              ? <Dashboard onLogout={handleLogout} />
              : <Navigate to="/auth/login" replace />
          }
        />

        {/* ── ORGANIZER DASHBOARD (unified) ── */}
        <Route
          path="/organizer/dashboard/*"
          element={
            isAuthenticated && role === "organizer"
              ? <Dashboard onLogout={handleLogout} />
              : <Navigate to="/auth/login" replace />
          }
        />

        {/* ── ROOT ── */}
        <Route
          path="/"
          element={
            isAuthenticated
              ? <Navigate to={dashboardPath} replace />
              : <Navigate to="/dashboard" replace />
          }
        />

        {/* ── FALLBACK ── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </Router>
  );
}

export default App;