import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Settings.css";
import { toast } from "react-toastify";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const Settings = ({ currentUser }) => {
  // ===========================
  // SECTION 1: PROFILE SETTINGS
  // ===========================
  const [profile, setProfile] = useState({
    fullname: "",
    email: "",
    phone: "",
    avatar: "",
  });

  const fetchUserProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/settings/profile/${currentUser.id}`);
      setProfile(res.data);
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const updateUserProfile = async () => {
    try {
      await axios.put(`${API_BASE_URL}/settings/profile/${currentUser.id}`, profile);
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error("Failed to update profile");
    }
  };

  const uploadProfileImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      await axios.post(`${API_BASE_URL}/settings/profile/image/${currentUser.id}`, formData);
      toast.success("Profile image updated!");
    } catch (err) {
      toast.error("Error uploading image");
    }
  };

  // ===========================
  // SECTION 2: SECURITY
  // ===========================
  const [security, setSecurity] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFA: false,
  });

  const updatePassword = async () => {
    try {
      await axios.put(`${API_BASE_URL}/settings/password/${currentUser.id}`, {
        oldPassword: security.oldPassword,
        newPassword: security.newPassword,
      });
      toast.success("Password updated successfully!");
    } catch (err) {
      toast.error("Error updating password");
    }
  };

  const toggle2FA = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/settings/2fa/${currentUser.id}`, {
        enabled: !security.twoFA,
      });
      setSecurity({ ...security, twoFA: res.data.enabled });
      toast.info(`2FA ${res.data.enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error("Error toggling 2FA");
    }
  };

  // ===========================
  // SECTION 3: NOTIFICATIONS
  // ===========================
  const [notifications, setNotifications] = useState({
    email: true,
    inApp: true,
    sms: false,
    sound: true,
  });

  const fetchNotificationSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/settings/notifications/${currentUser.id}`);
      setNotifications(res.data);
    } catch (err) {
      console.error("Error fetching notification settings:", err);
    }
  };

  const updateNotificationSettings = async () => {
    try {
      await axios.put(`${API_BASE_URL}/settings/notifications/${currentUser.id}`, notifications);
      toast.success("Notification preferences updated!");
    } catch (err) {
      toast.error("Failed to update notification settings");
    }
  };

  // ===========================
  // SECTION 4: THEME & DISPLAY
  // ===========================
  const [theme, setTheme] = useState("system");

  const fetchThemePreference = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/settings/theme/${currentUser.id}`);
      setTheme(res.data.theme);
    } catch (err) {
      console.error("Error fetching theme preference:", err);
    }
  };

  const updateThemePreference = async (value) => {
    setTheme(value);
    try {
      await axios.put(`${API_BASE_URL}/settings/theme/${currentUser.id}`, { theme: value });
      toast.info(`Theme changed to ${value}`);
    } catch (err) {
      toast.error("Error updating theme preference");
    }
  };

  // ===========================
  // SECTION 5: PRIVACY SETTINGS
  // ===========================
  const [privacy, setPrivacy] = useState({
    showOnline: true,
    showLastLogin: true,
    analytics: false,
  });

  const fetchPrivacySettings = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/settings/privacy/${currentUser.id}`);
      setPrivacy(res.data);
    } catch (err) {
      console.error("Error fetching privacy settings:", err);
    }
  };

  const updatePrivacySettings = async () => {
    try {
      await axios.put(`${API_BASE_URL}/settings/privacy/${currentUser.id}`, privacy);
      toast.success("Privacy settings updated!");
    } catch (err) {
      toast.error("Error updating privacy settings");
    }
  };

  // ===========================
  // SECTION 6: SYSTEM PREFERENCES
  // ===========================
  const [system, setSystem] = useState({
    language: "en",
    timezone: "Africa/Nairobi",
    dateFormat: "DD/MM/YYYY",
  });

  const fetchSystemPreferences = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/settings/system/${currentUser.id}`);
      setSystem(res.data);
    } catch (err) {
      console.error("Error fetching system preferences:", err);
    }
  };

  const updateSystemPreferences = async () => {
    try {
      await axios.put(`${API_BASE_URL}/settings/system/${currentUser.id}`, system);
      toast.success("System preferences saved!");
    } catch (err) {
      toast.error("Failed to update system preferences");
    }
  };

  // ===========================
  // SECTION 7: ACCOUNT MANAGEMENT
  // ===========================
  const deactivateAccount = async () => {
    if (!window.confirm("Are you sure you want to deactivate your account?")) return;
    try {
      await axios.post(`${API_BASE_URL}/settings/deactivate/${currentUser.id}`);
      toast.warning("Account deactivated!");
    } catch (err) {
      toast.error("Error deactivating account");
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm("This will permanently delete your account. Proceed?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/settings/account/${currentUser.id}`);
      toast.error("Account deleted!");
    } catch (err) {
      toast.error("Error deleting account");
    }
  };

  // ===========================
  // SECTION 8: ADMIN CONFIG (optional)
  // ===========================
  const [systemConfig, setSystemConfig] = useState({
    appName: "",
    maintenanceMode: false,
    defaultRole: "user",
  });

  const fetchSystemConfig = async () => {
    if (currentUser.role !== "admin") return;
    try {
      const res = await axios.get(`${API_BASE_URL}/settings/system-config`);
      setSystemConfig(res.data);
    } catch (err) {
      console.error("Error fetching system config:", err);
    }
  };

  const updateSystemConfig = async () => {
    try {
      await axios.put(`${API_BASE_URL}/settings/system-config`, systemConfig);
      toast.success("System configuration updated!");
    } catch (err) {
      toast.error("Error updating system config");
    }
  };

  // ===========================
  // EFFECT: INITIAL LOAD
  // ===========================
  useEffect(() => {
    fetchUserProfile();
    fetchNotificationSettings();
    fetchThemePreference();
    fetchPrivacySettings();
    fetchSystemPreferences();
    fetchSystemConfig();
  }, []);

  // ===========================
  // UI SECTION
  // ===========================
  return (
    <div className="settings-page">
      <h2>Settings</h2>

      {/* PROFILE */}
      <section>
        <h3>Profile</h3>
        <input value={profile.fullname} onChange={(e) => setProfile({ ...profile, fullname: e.target.value })} placeholder="Full Name" />
        <input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email" />
        <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="Phone" />
        <input type="file" onChange={uploadProfileImage} />
        <button onClick={updateUserProfile}>Save Profile</button>
      </section>

      {/* SECURITY */}
      <section>
        <h3>Security</h3>
        <input type="password" placeholder="Old Password" onChange={(e) => setSecurity({ ...security, oldPassword: e.target.value })} />
        <input type="password" placeholder="New Password" onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })} />
        <button onClick={updatePassword}>Change Password</button>
        <label>
          <input type="checkbox" checked={security.twoFA} onChange={toggle2FA} /> Enable Two-Factor Authentication
        </label>
      </section>

      {/* NOTIFICATIONS */}
      <section>
        <h3>Notifications</h3>
        {Object.keys(notifications).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={notifications[key]}
              onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
            />
            {key.toUpperCase()}
          </label>
        ))}
        <button onClick={updateNotificationSettings}>Save Notifications</button>
      </section>

      {/* THEME */}
      <section>
        <h3>Theme</h3>
        <select value={theme} onChange={(e) => updateThemePreference(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System Default</option>
        </select>
      </section>

      {/* PRIVACY */}
      <section>
        <h3>Privacy</h3>
        {Object.keys(privacy).map((key) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={privacy[key]}
              onChange={(e) => setPrivacy({ ...privacy, [key]: e.target.checked })}
            />
            {key.replace(/([A-Z])/g, " $1")}
          </label>
        ))}
        <button onClick={updatePrivacySettings}>Save Privacy</button>
      </section>

      {/* SYSTEM PREFERENCES */}
      <section>
        <h3>System Preferences</h3>
        <input value={system.language} onChange={(e) => setSystem({ ...system, language: e.target.value })} placeholder="Language" />
        <input value={system.timezone} onChange={(e) => setSystem({ ...system, timezone: e.target.value })} placeholder="Timezone" />
        <input value={system.dateFormat} onChange={(e) => setSystem({ ...system, dateFormat: e.target.value })} placeholder="Date Format" />
        <button onClick={updateSystemPreferences}>Save Preferences</button>
      </section>

      {/* ACCOUNT MANAGEMENT */}
      <section>
        <h3>Account Management</h3>
        <button className="danger" onClick={deactivateAccount}>Deactivate Account</button>
        <button className="danger" onClick={deleteAccount}>Delete Account</button>
      </section>

      {/* ADMIN SETTINGS */}
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
