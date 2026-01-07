import React, { useState, useEffect } from "react";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import ResetPasswordForm from "./ResetPasswordForm";
import "../styles/AuthForm.css";

const AuthForm = ({ onLoginSuccess }) => {
  const [view, setView] = useState("login"); // login, signup, forgot, reset
  const [resetToken, setResetToken] = useState("");

  // Extract reset token from URL if available
  useEffect(() => {
    const pathMatch = window.location.pathname.match(/\/reset-password\/(.+)/);
    if (pathMatch && pathMatch[1]) {
      setResetToken(pathMatch[1]);
      setView("reset");
    }
  }, []);

  const handleSwitch = (target) => setView(target);

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
