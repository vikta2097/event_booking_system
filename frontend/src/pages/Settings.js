import React, { useState, useEffect } from "react";
import api from "../api";
import "../styles/Settings.css";
import { toast } from "react-toastify";

const Settings = ({ currentUser }) => {
  // ===========================
  // PROFILE + PREFERENCES
  // ===========================
  const [prefs, setPrefs] = useState({
    fullname: "",
    email: "",
    phone: "",
    avatar: "",
    theme: "system",
    privacy: { showOnline: true, showLastLogin: true, analytics: true },
    system_preferences: { language: "en", timezone: "Africa/Nairobi", date_format: "YYYY-MM-DD" },
    twoFA: 0,
  });

  const fetchPreferences = async () => {
    try {
      const res = await api.get(`/settings/preferences/${currentUser.id}`);
      // Ensure privacy and system_preferences are objects
      setPrefs({
        ...res.data,
        privacy: typeof res.data.privacy === "string" ? JSON.parse(res.data.privacy) : res.data.privacy,
        system_preferences:
          typeof res.data.system_preferences === "string"
            ? JSON.parse(res.data.system_preferences)
            : res.data.system_preferences,
      });
    } catch (err) {
      console.error("Error fetching preferences:", err);
      toast.error("Failed to fetch preferences");
    }
  };

  const updatePreferences = async () => {
    try {
      await api.put(`/settings/preferences/${currentUser.id}`, prefs);
      toast.success("Preferences updated successfully!");
      fetchPreferences();
    } catch (err) {
      console.error(err);
      toast.error("Error updating preferences");
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      await api.post(`/settings/profile/image/${currentUser.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Avatar updated!");
      fetchPreferences();
    } catch (err) {
      console.error(err);
      toast.error("Error uploading avatar");
    }
  };

  // ===========================
  // PASSWORD
  // ===========================
  const [security, setSecurity] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });

  const updatePassword = async () => {
    if (security.newPassword !== security.confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }
    try {
      await api.put(`/settings/password/${currentUser.id}`, {
        oldPassword: security.oldPassword,
        newPassword: security.newPassword,
      });
      toast.success("Password updated!");
      setSecurity({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Error updating password");
    }
  };

  // ===========================
  // ACCOUNT MANAGEMENT
  // ===========================
  const deactivateAccount = async () => {
    if (!window.confirm("Are you sure you want to deactivate your account?")) return;
    try {
      await api.post(`/settings/deactivate/${currentUser.id}`);
      toast.warning("Account deactivated!");
    } catch (err) {
      console.error(err);
      toast.error("Error deactivating account");
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm("This will permanently delete your account. Proceed?")) return;
    try {
      await api.delete(`/settings/account/${currentUser.id}`);
      toast.error("Account deleted!");
    } catch (err) {
      console.error(err);
      toast.error("Error deleting account");
    }
  };

  // ===========================
  // ADMIN CONFIG
  // ===========================
  const [systemConfig, setSystemConfig] = useState({ appName: "", maintenanceMode: false, defaultRole: "user", id: 1 });

  const fetchSystemConfig = async () => {
    if (currentUser.role !== "admin") return;
    try {
      const res = await api.get(`/settings/system-config`);
      setSystemConfig(res.data);
    } catch (err) {
      console.error("Error fetching system config:", err);
    }
  };

  const updateSystemConfig = async () => {
    try {
      await api.put(`/settings/system-config/${systemConfig.id || 1}`, systemConfig);
      toast.success("System configuration updated!");
    } catch (err) {
      console.error(err);
      toast.error("Error updating system config");
    }
  };

  // ===========================
  // INITIAL LOAD
  // ===========================
  useEffect(() => {
    fetchPreferences();
    fetchSystemConfig();
  }, []);

  // ===========================
  // UI
  // ===========================
  return (
    <div className="settings-page">
      <h2>Settings</h2>

      {/* PROFILE */}
      <section>
        <h3>Profile</h3>
        <input
          value={prefs.fullname || ""}
          onChange={(e) => setPrefs({ ...prefs, fullname: e.target.value })}
          placeholder="Full Name"
        />
        <input
          value={prefs.email || ""}
          onChange={(e) => setPrefs({ ...prefs, email: e.target.value })}
          placeholder="Email"
        />
        <input
          value={prefs.phone || ""}
          onChange={(e) => setPrefs({ ...prefs, phone: e.target.value })}
          placeholder="Phone"
        />
        <input type="file" onChange={uploadAvatar} />
        <button onClick={updatePreferences}>Save Profile & Preferences</button>
      </section>

      {/* SECURITY */}
      <section>
        <h3>Security</h3>
        <input
          type="password"
          placeholder="Old Password"
          value={security.oldPassword}
          onChange={(e) => setSecurity({ ...security, oldPassword: e.target.value })}
        />
        <input
          type="password"
          placeholder="New Password"
          value={security.newPassword}
          onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={security.confirmPassword}
          onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
        />
        <button onClick={updatePassword}>Change Password</button>
        <label>
          <input
            type="checkbox"
            checked={!!prefs.twoFA}
            onChange={() => setPrefs({ ...prefs, twoFA: prefs.twoFA ? 0 : 1 })}
          />
          Enable Two-Factor Authentication
        </label>
      </section>

      {/* THEME & PRIVACY */}
      <section>
        <h3>Theme & Privacy</h3>
        <select value={prefs.theme} onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System Default</option>
        </select>
        {Object.keys(prefs.privacy).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={prefs.privacy[key]}
              onChange={(e) => setPrefs({ ...prefs, privacy: { ...prefs.privacy, [key]: e.target.checked } })}
            />
            {key.replace(/([A-Z])/g, " $1")}
          </label>
        ))}
      </section>

      {/* SYSTEM PREFERENCES */}
      <section>
        <h3>System Preferences</h3>
        <input
          value={prefs.system_preferences.language || ""}
          onChange={(e) => setPrefs({ ...prefs, system_preferences: { ...prefs.system_preferences, language: e.target.value } })}
          placeholder="Language"
        />
        <input
          value={prefs.system_preferences.timezone || ""}
          onChange={(e) => setPrefs({ ...prefs, system_preferences: { ...prefs.system_preferences, timezone: e.target.value } })}
          placeholder="Timezone"
        />
        <input
          value={prefs.system_preferences.date_format || ""}
          onChange={(e) => setPrefs({ ...prefs, system_preferences: { ...prefs.system_preferences, date_format: e.target.value } })}
          placeholder="Date Format"
        />
      </section>

      {/* ACCOUNT MANAGEMENT */}
      <section>
        <h3>Account Management</h3>
        <button className="danger" onClick={deactivateAccount}>Deactivate Account</button>
        <button className="danger" onClick={deleteAccount}>Delete Account</button>
      </section>

      {/* ADMIN CONFIG */}
      {currentUser.role === "admin" && (
        <section>
          <h3>System Configuration</h3>
          <input
            value={systemConfig.appName}
            onChange={(e) => setSystemConfig({ ...systemConfig, appName: e.target.value })}
            placeholder="App Name"
          />
          <label>
            <input
              type="checkbox"
              checked={systemConfig.maintenanceMode}
              onChange={(e) => setSystemConfig({ ...systemConfig, maintenanceMode: e.target.checked })}
            />
            Maintenance Mode
          </label>
          <button onClick={updateSystemConfig}>Save Configuration</button>
        </section>
      )}
    </div>
  );
};

export default Settings;
