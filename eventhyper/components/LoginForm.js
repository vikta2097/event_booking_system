// components/LoginForm.js (React Native)
// Uses api.js for all requests.
// Endpoint mapping matches server.js exactly:
//   POST /auth/login          → login
//   POST /auth/register       → signup (NOT /auth/signup — server uses /register)
//   POST /auth/forgot-password → forgot password
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const LoginForm = ({ onLoginSuccess, navigation }) => {
  const [formType, setFormType] = useState("login"); // "login" | "signup" | "forgot"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const switchForm = (type) => {
    setError("");
    setSuccessMsg("");
    setFormType(type);
  };

  const resetFields = () => {
    setName(""); setEmail(""); setPassword(""); setConfirmPassword("");
  };

  // ─── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    try {
      // POST /api/auth/login
      const res = await api.post("/auth/login", { email, password });
      if (!res.data.token) { setError(res.data.message || "Login failed."); return; }

      const token = res.data.token;
      await AsyncStorage.setItem("token", token);

      // GET /api/auth/me — fetch full profile + role
      const profileRes = await api.get("/auth/me");
      const { role, ...userObj } = profileRes.data;

      await AsyncStorage.multiSet([
        ["role", role],
        ["userId", String(userObj.id ?? "")],
      ]);

      onLoginSuccess({ token, role, user: profileRes.data });
    } catch (err) {
      setError(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Sign Up ──────────────────────────────────────────────────────────────
  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setError("All fields are required."); return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match."); return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must be at least 6 characters with a lowercase letter, number, and special character.");
      return;
    }
    setError(""); setLoading(true);
    try {
      // ✅ POST /api/auth/register — matches server.js authRoutes
      // (server had no /auth/signup — that's why it was returning 404)
      await api.post("/auth/register", { fullname: name, email, password });
      resetFields();
      setSuccessMsg("Account created! Please sign in.");
      switchForm("login");
    } catch (err) {
      setError(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Forgot Password ──────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email) { setError("Please enter your email."); return; }
    setError(""); setLoading(true);
    try {
      // POST /api/auth/forgot-password
      const res = await api.post("/auth/forgot-password", { email });
      setSuccessMsg("If that email exists, a reset link has been sent.");
      setTimeout(() => switchForm("login"), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.authContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>

          {/* Header */}
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {formType === "login" ? "Welcome Back"
                : formType === "signup" ? "Create Account"
                : "Forgot Password"}
            </Text>
            <Text style={styles.formSubtitle}>
              {formType === "login" ? "Sign in to your account"
                : formType === "signup" ? "Join EventHyper today"
                : "Enter your email to reset your password"}
            </Text>
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Success */}
          {!!successMsg && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✅ {successMsg}</Text>
            </View>
          )}

          {/* Full Name (signup only) */}
          {formType === "signup" && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your full name"
                maxLength={30}
              />
            </View>
          )}

          {/* Email (all forms) */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password (login + signup) */}
          {(formType === "login" || formType === "signup") && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  maxLength={16}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text>{showPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Confirm Password (signup only) */}
          {formType === "signup" && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  secureTextEntry={!showConfirm}
                  maxLength={16}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                  <Text>{showConfirm ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
              {confirmPassword !== "" && password !== confirmPassword && (
                <Text style={styles.errorHint}>Passwords do not match</Text>
              )}
            </View>
          )}

          {/* Forgot link (login only) */}
          {formType === "login" && (
            <TouchableOpacity onPress={() => switchForm("forgot")} style={{ marginBottom: 4 }}>
              <Text style={styles.linkBtn}>Forgot your password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={
              formType === "login" ? handleLogin
                : formType === "signup" ? handleSignup
                : handleForgotPassword
            }
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>
                  {formType === "login" ? "Sign In"
                    : formType === "signup" ? "Create Account"
                    : "Send Reset Link"}
                </Text>
            }
          </TouchableOpacity>

          {/* Footer links */}
          <View style={styles.formFooter}>
            {formType === "login" && (
              <>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => switchForm("signup")}>
                  <Text style={styles.linkBtnPrimary}>Sign Up</Text>
                </TouchableOpacity>
              </>
            )}
            {(formType === "signup" || formType === "forgot") && (
              <TouchableOpacity onPress={() => switchForm("login")}>
                <Text style={styles.linkBtn}>Back to Login</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  authContainer: { flex: 1, backgroundColor: "#764ba2" },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  formContainer: {
    backgroundColor: "#fff", borderRadius: 16, padding: 32,
    width: "100%", maxWidth: 400,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  formHeader: { alignItems: "center", marginBottom: 28 },
  formTitle: { fontSize: 26, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  formSubtitle: { fontSize: 15, color: "#666", textAlign: "center" },
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
  input: {
    borderWidth: 2, borderColor: "#e1e5e9", borderRadius: 8,
    padding: 12, fontSize: 16, color: "#1a1a1a", backgroundColor: "#fff",
  },
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
  linkBtn: {
    color: "#667eea", fontSize: 14, textDecorationLine: "underline",
    textAlign: "center", marginTop: 4,
  },
  linkBtnPrimary: { color: "#667eea", fontSize: 14, fontWeight: "600" },
  formFooter: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#e1e5e9",
  },
  footerText: { fontSize: 14, color: "#666" },
});

export default LoginForm;