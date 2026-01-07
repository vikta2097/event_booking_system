import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; 
import "../styles/AuthForm.css";
import api from "../api";

const LoginForm = ({ onLoginSuccess }) => {
  const [formType, setFormType] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  // --------------------
  // Handlers for form switching
  // --------------------
  const onSignupClick = () => {
    setError("");
    setFormType("signup");
  };

  const onForgotClick = () => {
    setError("");
    setFormType("forgot");
  };

  const onBackToLogin = () => {
    setError("");
    setFormType("login");
  };

  // --------------------
  // Login handler
  // --------------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });

      if (!res.data.token) {
        setError(res.data.message || "Login failed.");
        setLoading(false);
        return;
      }

      const token = res.data.token;
      localStorage.setItem("token", token);

      const profileRes = await api.get("/auth/me");
      const role = profileRes.data.role;
      const userObj = profileRes.data;

      localStorage.setItem("role", role);
      if (userObj.id) localStorage.setItem("userId", userObj.id);

      onLoginSuccess({
        token,
        role,
        user: userObj,
      });

      // Role-based redirect
      if (role === "admin") navigate("/admin/dashboard", { replace: true });
      else if (role === "organizer") navigate("/organizer/dashboard", { replace: true });
      else navigate("/dashboard", { replace: true });

    } catch (err) {
      console.error("Login error:", err);
      if (err.response && err.response.data) setError(err.response.data.message || "Login failed.");
      else setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------
  // Sign Up handler
  // --------------------
  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/signup", { email, password });

      if (res.data.success) {
        alert("Signup successful! Please login.");
        setFormType("login");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      } else {
        setError(res.data.message || "Signup failed.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------
  // Forgot Password handler
  // --------------------
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/forgot-password", { email });
      if (res.data.success) {
        alert("Password reset link sent to your email!");
        setFormType("login");
        setEmail("");
      } else {
        setError(res.data.message || "Request failed.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --------------------
  // Form JSX
  // --------------------
  return (
    <div className="form-container">
      <div className="form-header">
        {formType === "login" && <h2>Welcome Back</h2>}
        {formType === "signup" && <h2>Create Account</h2>}
        {formType === "forgot" && <h2>Forgot Password</h2>}
        <p>
          {formType === "login" && "Sign in to your account"}
          {formType === "signup" && "Sign up for a new account"}
          {formType === "forgot" && "Enter your email to reset password"}
        </p>
      </div>

      <div className="auth-form">
        {error && (
          <div className="error-message">
            <span role="img" aria-label="Error">⚠️</span> {error}
          </div>
        )}

        {formType === "login" && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
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
          </form>
        )}

        {formType === "signup" && (
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Signing up..." : "Sign Up"}
            </button>

            <div className="form-footer">
              <button type="button" className="link-btn" onClick={onBackToLogin}>
                Back to Login
              </button>
            </div>
          </form>
        )}

        {formType === "forgot" && (
          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="form-footer">
              <button type="button" className="link-btn" onClick={onBackToLogin}>
                Back to Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginForm;
