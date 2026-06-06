import React from "react";
import { useTheme } from "./ThemeContext";
import "./ThemeToggle.css";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle theme"
    >
      <span className="theme-toggle__track">
        <span className="theme-toggle__thumb" />
      </span>
      <span className="theme-toggle__icon">
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
};

export default ThemeToggle;