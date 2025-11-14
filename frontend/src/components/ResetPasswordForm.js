import React, { useState } from "react";
import "../styles/AuthForm.css";
import api from "../api"; // ✅ axios instance

const ResetPasswordForm = ({ token, onLoginClick }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("No reset token provided. Please use the link from your email.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      // Remove unused variable 'res'
      await api.post("/auth/reset-password", { token, newPassword: password });

      setMessage("Password reset successful! Redirecting to login...");
      setTimeout(() => onLoginClick(), 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Reset failed");
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="form-container">
        <div className="form-header">
          <h2>Invalid Reset Link</h2>
        </div>
        <div className="error-message">
          <span>⚠️</span> No reset token provided. Please use the link from your email.
        </div>
        <button className="submit-btn" onClick={onLoginClick}>
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>Reset Password</h2>
        <p>Enter your new password</p>
      </div>

      <div className="auth-form">
        {error && (
          <div className="error-message">
            <span>⚠️</span> {error}
          </div>
        )}

        {message && (
          <div className="success-message">
            <span>✅</span> {message}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="password">New Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={16}
              placeholder="Enter new password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirm">Confirm New Password</label>
          <div className="password-input-wrapper">
            <input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              maxLength={16}
              placeholder="Confirm new password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          {confirm && password !== confirm && (
            <small className="error-text">Passwords do not match</small>
          )}
        </div>

        <button
          type="button"
          className="submit-btn"
          disabled={loading}
          onClick={handleResetSubmit}
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </div>
    </div>
  );
};

export default ResetPasswordForm;
