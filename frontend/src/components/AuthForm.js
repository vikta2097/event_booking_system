import React, { useState, useEffect } from "react";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import ResetPasswordForm from "./ResetPasswordForm";
import "../styles/AuthForm.css";

const AuthForm = ({ onLoginSuccess }) => {
  const [view, setView] = useState("login");
  const [resetToken, setResetToken] = useState("");

  // Handle password reset token manually (optional)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromURL = params.get("token");
    if (tokenFromURL) {
      setResetToken(tokenFromURL);
      setView("reset");
    }
  }, []);

  const handleSwitch = (target) => {
    setView(target);
  };

  return (
    <div className="auth-container">
      {view === "login" && (
        <LoginForm
          onSignupClick={() => handleSwitch("signup")}
          onForgotClick={() => handleSwitch("forgot")}
          onLoginSuccess={onLoginSuccess}
        />
      )}
      {view === "signup" && (
        <SignupForm onLoginClick={() => handleSwitch("login")} />
      )}
      {view === "forgot" && (
        <ForgotPasswordForm
          onLoginClick={() => handleSwitch("login")}
          onResetClick={(token) => {
            setResetToken(token);
            setView("reset");
            // no need for URL params
          }}
        />
      )}
      {view === "reset" && (
        <ResetPasswordForm
          token={resetToken}
          onLoginClick={() => handleSwitch("login")}
        />
      )}
    </div>
  );
};

export default AuthForm;
