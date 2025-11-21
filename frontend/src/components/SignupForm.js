import React, { useState } from "react";
import "../styles/AuthForm.css";
import api from "../api"; // ✅ axios instance

const SignupForm = ({ onLoginClick }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{6,}$/;
if (!passwordRegex.test(password)) {
  setError("Password must be at least 6 characters and include a lowercase letter, number, and special character");
  return;
}

    setLoading(true);

    try {
      await api.post("/auth/register", {
        fullname: name,
        email,
        password,
      });

      alert("✅ Signup successful! Please login.");
      setTimeout(() => onLoginClick(), 1500);
    } catch (err) {
      console.error("Signup error:", err);
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Signup failed");
      } else {
        setError("Network error. Please ensure your backend is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>Create Account</h2>
        <p>Join us today</p>
      </div>

      <div className="auth-form">
        {error && (
          <div className="error-message">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={30}
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={50}
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={16}
                placeholder="Create a password"
                autoComplete="new-password"
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
            <small>Minimum 6 characters, maximum 16 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                maxLength={16}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <small className="error-text">Passwords do not match</small>
            )}
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <div className="form-footer">
          <span>Already have an account? </span>
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

export default SignupForm;
