import React, { useEffect, useState } from "react";
import api from "../api";
import "../styles/Settings.css";

const Settings = () => {
  const userId = parseInt(localStorage.getItem("userId"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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

  // Load user settings
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
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

    fetchSettings();
  }, [userId]);

  // Handlers
  const handleChange = (setter) => (e) => {
    const { name, type, checked, value } = e.target;
    setter((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // Save functions
  const saveSettings = async (url, data, successMsg) => {
    setSaving(true);
    try {
      await api.put(url, data);
      alert(successMsg);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to save settings");
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
      setProfile((prev) => ({ ...prev, avatar: res.data.filename }));
      alert("Avatar uploaded successfully");
      setAvatarFile(null);
    } catch (err) {
      console.error(err);
      alert("Failed to upload avatar");
    } finally {
      setSaving(false);
    }
  };

  const toggleTwoFA = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/2fa/${userId}`, { enabled: !twoFA });
      setTwoFA(!twoFA);
      alert(!twoFA ? "2FA enabled" : "2FA disabled");
    } catch (err) {
      console.error(err);
      alert("Failed to toggle 2FA");
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
        <input type="text" name="fullname" placeholder="Full Name" value={profile.fullname} onChange={handleChange(setProfile)} />
        <input type="email" name="email" placeholder="Email" value={profile.email} onChange={handleChange(setProfile)} />
        <input type="text" name="phone" placeholder="Phone" value={profile.phone} onChange={handleChange(setProfile)} />
        <div>
          {profile.avatar && (
            <img
              src={`${api.defaults.baseURL.replace("/api", "")}/uploads/avatars/${profile.avatar}`}
              alt="avatar"
              width={100}
              height={100}
            />
          )}
          <input type="file" onChange={(e) => setAvatarFile(e.target.files[0])} />
          <button onClick={uploadAvatar} disabled={saving}>Upload Avatar</button>
        </div>
        <button onClick={() => saveSettings(`/settings/profile/${userId}`, profile, "Profile updated successfully")} disabled={saving}>
          Save Profile
        </button>
      </section>

      {/* APPEARANCE */}
      <section>
        <h3>Appearance</h3>
        <select name="theme" value={appearance.theme} onChange={handleChange(setAppearance)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <input type="text" name="language" placeholder="Language" value={appearance.language} onChange={handleChange(setAppearance)} />
        <input type="text" name="timezone" placeholder="Timezone" value={appearance.timezone} onChange={handleChange(setAppearance)} />
        <input type="text" name="dateFormat" placeholder="Date Format" value={appearance.dateFormat} onChange={handleChange(setAppearance)} />
        <button onClick={() => saveSettings(`/settings/appearance/${userId}`, appearance, "Appearance updated successfully")} disabled={saving}>
          Save Appearance
        </button>
      </section>

      {/* PRIVACY */}
      <section>
        <h3>Privacy</h3>
        {Object.keys(privacy).map((key) => (
          <label key={key}>
            <input type="checkbox" name={key} checked={privacy[key]} onChange={handleChange(setPrivacy)} /> {key}
          </label>
        ))}
        <button onClick={() => saveSettings(`/settings/privacy/${userId}`, privacy, "Privacy settings updated")} disabled={saving}>
          Save Privacy
        </button>
      </section>

      {/* NOTIFICATIONS */}
      <section>
        <h3>Notifications</h3>
        {Object.keys(notifications).map((key) => (
          <label key={key}>
            <input type="checkbox" name={key} checked={notifications[key]} onChange={handleChange(setNotifications)} /> {key}
          </label>
        ))}
        <button onClick={() => saveSettings(`/settings/notifications/${userId}`, notifications, "Notifications updated")} disabled={saving}>
          Save Notifications
        </button>
      </section>

      {/* PASSWORD */}
      <section>
        <h3>Change Password</h3>
        <input type="password" name="oldPassword" placeholder="Current Password" value={password.oldPassword} onChange={handleChange(setPassword)} />
        <input type="password" name="newPassword" placeholder="New Password" value={password.newPassword} onChange={handleChange(setPassword)} />
        <button onClick={() => saveSettings(`/settings/password/${userId}`, password, "Password changed successfully")} disabled={saving}>
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
