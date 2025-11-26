import React, { useEffect, useState } from "react";
import api from "../api";
import "../styles/Settings.css";

const Settings = () => {
  const userId = parseInt(localStorage.getItem("userId"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({
    fullname: "",
    email: "",
    phone: "",
    avatar: "",
  });
  const [appearance, setAppearance] = useState({
    theme: "system",
    language: "en",
    timezone: "Africa/Nairobi",
    dateFormat: "YYYY-MM-DD",
  });
  const [privacy, setPrivacy] = useState({
    showOnline: true,
    showLastLogin: true,
    analytics: true,
  });
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    taskReminders: true,
    weeklyReports: false,
  });
  const [password, setPassword] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [twoFA, setTwoFA] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load user settings
  const fetchSettings = async () => {
    try {
      const res = await api.get(`/settings/user/${userId}`);
      const data = res.data;
      setProfile(data.profile);
      setAppearance(data.appearance);
      setPrivacy(data.privacy);
      setNotifications(data.notifications);
      setTwoFA(data.security.twoFA);
    } catch (err) {
      console.error(err);
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Handle input changes
  const handleProfileChange = (e) =>
    setProfile({ ...profile, [e.target.name]: e.target.value });
  const handleAppearanceChange = (e) =>
    setAppearance({ ...appearance, [e.target.name]: e.target.value });
  const handlePrivacyChange = (e) =>
    setPrivacy({ ...privacy, [e.target.name]: e.target.checked });
  const handleNotificationsChange = (e) =>
    setNotifications({ ...notifications, [e.target.name]: e.target.checked });
  const handlePasswordChange = (e) =>
    setPassword({ ...password, [e.target.name]: e.target.value });

  // Save helpers
  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/profile/${userId}`, profile);
      alert("Profile updated successfully");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const saveAppearance = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/appearance/${userId}`, appearance);
      alert("Appearance updated successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to update appearance");
    } finally {
      setSaving(false);
    }
  };

  const savePrivacy = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/privacy/${userId}`, privacy);
      alert("Privacy settings updated");
    } catch (err) {
      console.error(err);
      alert("Failed to update privacy");
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/notifications/${userId}`, notifications);
      alert("Notification preferences updated");
    } catch (err) {
      console.error(err);
      alert("Failed to update notifications");
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/password/${userId}`, password);
      alert("Password changed successfully");
      setPassword({ oldPassword: "", newPassword: "" });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const toggleTwoFA = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/2fa/${userId}`, { enabled: !twoFA });
      setTwoFA(!twoFA);
      alert(twoFA ? "2FA disabled" : "2FA enabled");
    } catch (err) {
      console.error(err);
      alert("Failed to toggle 2FA");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return alert("Select a file first");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const res = await api.post(`/settings/avatar/${userId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile({ ...profile, avatar: res.data.filename });
      alert("Avatar uploaded successfully");
      setAvatarFile(null);
    } catch (err) {
      console.error(err);
      alert("Failed to upload avatar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading settings...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="settings-container">
      <h2>User Settings</h2>

      {/* PROFILE */}
      <section>
        <h3>Profile</h3>
        <input
          type="text"
          name="fullname"
          placeholder="Full Name"
          value={profile.fullname}
          onChange={handleProfileChange}
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={profile.email}
          onChange={handleProfileChange}
        />
        <input
          type="text"
          name="phone"
          placeholder="Phone"
          value={profile.phone}
          onChange={handleProfileChange}
        />
        <div>
          {profile.avatar && (
            <img
              src={`${api.defaults.baseURL.replace("/api", "")}/uploads/avatars/${profile.avatar}`}
              alt="avatar"
              width={100}
              height={100}
            />
          )}
          <input
            type="file"
            onChange={(e) => setAvatarFile(e.target.files[0])}
          />
          <button onClick={uploadAvatar} disabled={saving}>
            Upload Avatar
          </button>
        </div>
        <button onClick={saveProfile} disabled={saving}>
          Save Profile
        </button>
      </section>

      {/* APPEARANCE */}
      <section>
        <h3>Appearance</h3>
        <select
          name="theme"
          value={appearance.theme}
          onChange={handleAppearanceChange}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <input
          type="text"
          name="language"
          value={appearance.language}
          onChange={handleAppearanceChange}
          placeholder="Language"
        />
        <input
          type="text"
          name="timezone"
          value={appearance.timezone}
          onChange={handleAppearanceChange}
          placeholder="Timezone"
        />
        <input
          type="text"
          name="dateFormat"
          value={appearance.dateFormat}
          onChange={handleAppearanceChange}
          placeholder="Date Format"
        />
        <button onClick={saveAppearance} disabled={saving}>
          Save Appearance
        </button>
      </section>

      {/* PRIVACY */}
      <section>
        <h3>Privacy</h3>
        <label>
          <input
            type="checkbox"
            name="showOnline"
            checked={privacy.showOnline}
            onChange={handlePrivacyChange}
          />{" "}
          Show Online
        </label>
        <label>
          <input
            type="checkbox"
            name="showLastLogin"
            checked={privacy.showLastLogin}
            onChange={handlePrivacyChange}
          />{" "}
          Show Last Login
        </label>
        <label>
          <input
            type="checkbox"
            name="analytics"
            checked={privacy.analytics}
            onChange={handlePrivacyChange}
          />{" "}
          Analytics
        </label>
        <button onClick={savePrivacy} disabled={saving}>
          Save Privacy
        </button>
      </section>

      {/* NOTIFICATIONS */}
      <section>
        <h3>Notifications</h3>
        <label>
          <input
            type="checkbox"
            name="emailNotifications"
            checked={notifications.emailNotifications}
            onChange={handleNotificationsChange}
          />{" "}
          Email Notifications
        </label>
        <label>
          <input
            type="checkbox"
            name="pushNotifications"
            checked={notifications.pushNotifications}
            onChange={handleNotificationsChange}
          />{" "}
          Push Notifications
        </label>
        <label>
          <input
            type="checkbox"
            name="taskReminders"
            checked={notifications.taskReminders}
            onChange={handleNotificationsChange}
          />{" "}
          Task Reminders
        </label>
        <label>
          <input
            type="checkbox"
            name="weeklyReports"
            checked={notifications.weeklyReports}
            onChange={handleNotificationsChange}
          />{" "}
          Weekly Reports
        </label>
        <button onClick={saveNotifications} disabled={saving}>
          Save Notifications
        </button>
      </section>

      {/* PASSWORD */}
      <section>
        <h3>Change Password</h3>
        <input
          type="password"
          name="oldPassword"
          placeholder="Current Password"
          value={password.oldPassword}
          onChange={handlePasswordChange}
        />
        <input
          type="password"
          name="newPassword"
          placeholder="New Password"
          value={password.newPassword}
          onChange={handlePasswordChange}
        />
        <button onClick={savePassword} disabled={saving}>
          Change Password
        </button>
      </section>

      {/* 2FA */}
      <section>
        <h3>Two-Factor Authentication (2FA)</h3>
        <button onClick={toggleTwoFA} disabled={saving}>
          {twoFA ? "Disable 2FA" : "Enable 2FA"}
        </button>
      </section>
    </div>
  );
};

export default Settings;
