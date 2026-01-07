import React, { useState } from "react";
import "../styles/AuthForm.css";
import api from "../api";

const ForgotPasswordForm = ({ onLoginClick, onResetClick }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      // Send request to backend
      const res = await api.post("/auth/forgot-password", { email });

      if (res.data && res.data.token) {
        setMessage("Check your email for the reset link!");
        // Pass token to ResetPasswordForm if you want inline reset
        onResetClick && onResetClick(res.data.token);
      } else {
        setMessage("If the email exists, a reset link has been sent.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Failed to send reset link");
      } else {
        setError(
          "Network error. Please make sure your backend is running."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>Forgot Password</h2>
        <p>Enter your email to reset your password</p>
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

        <form onSubmit={handleForgotSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your registered email"
              maxLength={50}
            />
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="form-footer">
          <span>Remembered your password? </span>
          <button
            type="button"
            className="link-btn primary"
            onClick={onLoginClick}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
