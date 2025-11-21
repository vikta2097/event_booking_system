import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AuthForm from "./components/AuthForm";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";

const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
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
      } catch (err) {
        handleLogout();
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
      } else handleLogout();
    }

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, []);

  const isAuthenticated = !!token;

  return (
    <Router>
      <Routes>
        {/* Reset Password - must be accessible without auth */}
        <Route
          path="/reset-password/:token"
          element={<AuthForm onLoginSuccess={handleLogin} />}
        />

        {/* Login */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate
                to={user?.role === "admin" ? "/admin/dashboard" : "/dashboard"}
                replace
              />
            ) : (
              <AuthForm onLoginSuccess={handleLogin} />
            )
          }
        />

        {/* Admin dashboard */}
        <Route
          path="/admin/dashboard/*"
          element={
            isAuthenticated && user?.role === "admin" ? (
              <AdminDashboard token={token} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* User dashboard */}
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

        {/* Catch-all redirect */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                isAuthenticated && user
                  ? user.role === "admin"
                    ? "/admin/dashboard"
                    : "/dashboard"
                  : "/dashboard"
              }
              replace
            />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;