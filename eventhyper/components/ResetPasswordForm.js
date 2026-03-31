// components/ResetPasswordForm.js (React Native)
// Usage: navigation.navigate("ResetPassword", { token: "..." })
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import api from "../api";

const ResetPasswordForm = ({ navigation, route }) => {
  const token = route?.params?.token;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // No token screen
  if (!token) {
    return (
      <View style={styles.authContainer}>
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Invalid Reset Link</Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ No reset token provided. Please use the link from your email.</Text>
          </View>
          <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.navigate("Login")}>
            <Text style={styles.submitBtnText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleResetSubmit = async () => {
    setError(""); setMessage("");

    if (password !== confirm) { setError("Passwords do not match"); return; }

    const passwordRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must be at least 6 characters with a lowercase letter, number, and special character");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setMessage("Password reset successful! Redirecting to login...");
      setTimeout(() => navigation.navigate("Login"), 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.authContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>

          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Reset Password</Text>
            <Text style={styles.formSubtitle}>Enter your new password</Text>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}
          {!!message && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✅ {message}</Text>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter new password"
                secureTextEntry={!showPassword}
                maxLength={16}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text>{showPassword ? "👁️" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirm}
                maxLength={16}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                <Text>{showConfirm ? "👁️" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            {confirm !== "" && password !== confirm && (
              <Text style={styles.errorHint}>Passwords do not match</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleResetSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Reset Password</Text>
            }
          </TouchableOpacity>

          <View style={styles.formFooter}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.linkBtnPrimary}>Back to Login</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  authContainer: { flex: 1, backgroundColor: "#764ba2", justifyContent: "center", padding: 20 },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  formContainer: {
    backgroundColor: "#fff", borderRadius: 16, padding: 32,
    width: "100%", maxWidth: 400,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  formHeader: { alignItems: "center", marginBottom: 28 },
  formTitle: { fontSize: 26, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  formSubtitle: { fontSize: 15, color: "#666" },
  errorBox: {
    backgroundColor: "#fee", borderColor: "#fed7d7",
    borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16,
  },
  errorText: { color: "#c53030", fontSize: 14 },
  successBox: {
    backgroundColor: "#f0fff4", borderColor: "#c6f6d5",
    borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 16,
  },
  successText: { color: "#38a169", fontSize: 14 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 6 },
  passwordWrapper: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 2, borderColor: "#e1e5e9", borderRadius: 8,
    backgroundColor: "#fff", paddingRight: 8,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 16, color: "#1a1a1a" },
  eyeBtn: { padding: 8 },
  errorHint: { fontSize: 12, color: "#c53030", marginTop: 4 },
  submitBtn: {
    backgroundColor: "#667eea", borderRadius: 8,
    padding: 14, alignItems: "center", marginTop: 12,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  formFooter: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#e1e5e9",
  },
  footerText: { fontSize: 14, color: "#666" },
  linkBtnPrimary: { color: "#667eea", fontSize: 14, fontWeight: "600" },
});

export default ResetPasswordForm;