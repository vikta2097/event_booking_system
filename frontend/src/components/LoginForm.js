import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom"; // ✅ Added useLocation
import "../styles/AuthForm.css";
import api from "../api";

const LoginForm = ({ onSignupClick, onForgotClick, onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation(); // ✅ Capture current location

  // ✅ Determine where to redirect after login
  const from = location.state?.from || null; // null if direct login click

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Login request
      const res = await api.post("/auth/login", { email, password });

      if (!res.data.token) {
        setError(res.data.message || "Login failed.");
        setLoading(false);
        return;
      }

      const token = res.data.token;
      localStorage.setItem("token", token);

      // Fetch user profile (token automatically sent via interceptor)
      const profileRes = await api.get("/auth/me");
      const role = profileRes.data.role;
      const userObj = profileRes.data;

      localStorage.setItem("role", role);
      if (userObj.id) localStorage.setItem("userId", userObj.id);

      // Pass the full user object to parent App
      onLoginSuccess({
        token,
        role,
        user: userObj,
      });

      // ✅ Post-login redirect logic
      if (from) {
        navigate(from, { replace: true }); // Return user to intended page
      } else {
        // Default role-based redirect
        if (role === "admin") {
          navigate("/admin/dashboard", { replace: true });
        } else if (role === "organizer") {
          navigate("/organizer/dashboard", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }

    } catch (err) {
      console.error("Login error:", err);
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Login failed.");
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>Welcome Back</h2>
        <p>Sign in to your account</p>
      </div>

      <div className="auth-form">
        {error && (
          <div className="error-message">
            <span role="img" aria-label="Error">⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="form-links">
          <button type="button" className="link-btn" onClick={onForgotClick}>
            Forgot your password?
          </button>
        </div>

        <div className="form-footer">
          <span>Don't have an account? </span>
          <button type="button" className="link-btn primary" onClick={onSignupClick}>
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
