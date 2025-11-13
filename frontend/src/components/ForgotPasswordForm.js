import "../styles/AuthForm.css";
import React, { useState } from "react";
import api from "../api"; // ✅ use axios instance

const ForgotPasswordForm = ({ onLoginClick }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await api.post("/auth/forgot-password", { email });

      setMessage(res.data.message || "Password reset email sent! Check your inbox.");
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Failed to send reset link");
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
        <h2>Forgot Password?</h2>
        <p>Enter your email to receive a reset link</p>
      </div>
      
      <div className="auth-form">
        {error && (
          <div className="error-message">
            <span>⚠️</span>
            {error}
          </div>
        )}
        
        {message && (
          <div className="success-message">
            <span>✅</span>
            {message}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
          />
        </div>

        <button
          type="button"
          className="submit-btn"
          disabled={loading}
          onClick={handleForgotSubmit}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <div className="form-footer">
          <span>Remember your password? </span>
          <button type="button" className="link-btn primary" onClick={onLoginClick}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordForm;
