import React, { useEffect, useState } from "react";
import { 
  View, Text, TextInput, ScrollView, Button, Image, Switch, TouchableOpacity, StyleSheet, Alert 
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as DocumentPicker from 'expo-document-picker';
import api from "../api";

const Settings = ({ navigation }) => {
  const userId = parseInt(localStorage.getItem("userId")); // You may replace with async storage in RN
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

  const handleChange = (setter) => (key, value) => {
    setter((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async (url, data, successMsg) => {
    setSaving(true);
    try {
      await api.put(url, data);
      Alert.alert(successMsg);
    } catch (err) {
      console.error(err);
      Alert.alert(err.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const pickAvatar = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: "image/*" });
    if (result.type === "success") {
      setAvatarFile(result);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return Alert.alert("Select a file first");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("avatar", {
        uri: avatarFile.uri,
        name: avatarFile.name,
        type: "image/jpeg",
      });
      const res = await api.post(`/settings/avatar/${userId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile((prev) => ({ ...prev, avatar: res.data.filename }));
      Alert.alert("Avatar uploaded successfully");
      setAvatarFile(null);
    } catch (err) {
      console.error(err);
      Alert.alert("Failed to upload avatar");
    } finally {
      setSaving(false);
    }
  };

  const toggleTwoFA = async () => {
    setSaving(true);
    try {
      await api.put(`/settings/2fa/${userId}`, { enabled: !twoFA });
      setTwoFA(!twoFA);
      Alert.alert(!twoFA ? "2FA enabled" : "2FA disabled");
    } catch (err) {
      console.error(err);
      Alert.alert("Failed to toggle 2FA");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Text style={styles.loading}>Loading settings...</Text>;
  if (error) return <Text style={styles.error}>{error}</Text>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>User Settings</Text>

      {/* PROFILE */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={profile.fullname}
          onChangeText={(val) => handleChange(setProfile)("fullname", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={profile.email}
          onChangeText={(val) => handleChange(setProfile)("email", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          value={profile.phone}
          onChangeText={(val) => handleChange(setProfile)("phone", val)}
        />
        {profile.avatar ? (
          <Image
            source={{ uri: `${api.defaults.baseURL.replace("/api", "")}/uploads/avatars/${profile.avatar}` }}
            style={styles.avatar}
          />
        ) : null}
        <Button title="Pick Avatar" onPress={pickAvatar} />
        {avatarFile && <Button title="Upload Avatar" onPress={uploadAvatar} disabled={saving} />}
        <Button
          title="Save Profile"
          onPress={() => saveSettings(`/settings/profile/${userId}`, profile, "Profile updated successfully")}
          disabled={saving}
        />
      </View>

      {/* APPEARANCE */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Picker
          selectedValue={appearance.theme}
          onValueChange={(val) => handleChange(setAppearance)("theme", val)}
          style={styles.picker}
        >
          <Picker.Item label="Light" value="light" />
          <Picker.Item label="Dark" value="dark" />
          <Picker.Item label="System" value="system" />
        </Picker>
        <TextInput
          style={styles.input}
          placeholder="Language"
          value={appearance.language}
          onChangeText={(val) => handleChange(setAppearance)("language", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="Timezone"
          value={appearance.timezone}
          onChangeText={(val) => handleChange(setAppearance)("timezone", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="Date Format"
          value={appearance.dateFormat}
          onChangeText={(val) => handleChange(setAppearance)("dateFormat", val)}
        />
        <Button
          title="Save Appearance"
          onPress={() => saveSettings(`/settings/appearance/${userId}`, appearance, "Appearance updated successfully")}
          disabled={saving}
        />
      </View>

      {/* PRIVACY */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        {Object.keys(privacy).map((key) => (
          <View key={key} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{key}</Text>
            <Switch
              value={privacy[key]}
              onValueChange={(val) => handleChange(setPrivacy)(key, val)}
            />
          </View>
        ))}
        <Button
          title="Save Privacy"
          onPress={() => saveSettings(`/settings/privacy/${userId}`, privacy, "Privacy settings updated")}
          disabled={saving}
        />
      </View>

      {/* NOTIFICATIONS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        {Object.keys(notifications).map((key) => (
          <View key={key} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{key}</Text>
            <Switch
              value={notifications[key]}
              onValueChange={(val) => handleChange(setNotifications)(key, val)}
            />
          </View>
        ))}
        <Button
          title="Save Notifications"
          onPress={() => saveSettings(`/settings/notifications/${userId}`, notifications, "Notifications updated")}
          disabled={saving}
        />
      </View>

      {/* PASSWORD */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Current Password"
          secureTextEntry
          value={password.oldPassword}
          onChangeText={(val) => handleChange(setPassword)("oldPassword", val)}
        />
        <TextInput
          style={styles.input}
          placeholder="New Password"
          secureTextEntry
          value={password.newPassword}
          onChangeText={(val) => handleChange(setPassword)("newPassword", val)}
        />
        <Button
          title="Change Password"
          onPress={() => saveSettings(`/settings/password/${userId}`, password, "Password changed successfully")}
          disabled={saving}
        />
      </View>

      {/* 2FA */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Two-Factor Authentication (2FA)</Text>
        <Button title={twoFA ? "Disable 2FA" : "Enable 2FA"} onPress={toggleTwoFA} disabled={saving} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f9f9f9" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
    color: "#1a1a1a",
  },
  picker: {
    marginBottom: 15,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  switchLabel: { fontSize: 14 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "#ccc",
  },
  loading: { textAlign: "center", marginTop: 50, fontSize: 16 },
  error: { color: "#e74c3c", textAlign: "center", marginTop: 20 },
});

export default Settings;