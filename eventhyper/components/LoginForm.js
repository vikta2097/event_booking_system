// components/LoginForm.js (React Native)
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const LoginForm = ({ onLoginSuccess, navigation }) => {
  const [formType, setFormType] = useState("login"); // "login" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const switchForm = (type) => { setError(""); setFormType(type); };

  // ─── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError(""); setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      if (!res.data.token) { setError(res.data.message || "Login failed."); return; }

      const token = res.data.token;
      await AsyncStorage.setItem("token", token);

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
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setError(""); setLoading(true);
    try {
      const res = await api.post("/auth/signup", { email, password });
      if (res.data.success) {
        Alert.alert("Success", "Signup successful! Please login.");
        setFormType("login");
        setEmail(""); setPassword(""); setConfirmPassword("");
      } else {
        setError(res.data.message || "Signup failed.");
      }
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
      const res = await api.post("/auth/forgot-password", { email });
      if (res.data.success) {
        Alert.alert("Success", "Password reset link sent to your email!");
        setFormType("login"); setEmail("");
      } else {
        setError(res.data.message || "Request failed.");
      }
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
                : formType === "signup" ? "Sign up for a new account"
                : "Enter your email to reset password"}
            </Text>
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
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
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text>{showPassword ? "🙈" : "👁️"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Confirm Password (signup only) */}
          {formType === "signup" && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry
              />
            </View>
          )}

          {/* Forgot link (login only) */}
          {formType === "login" && (
            <TouchableOpacity onPress={() => switchForm("forgot")}>
              <Text style={styles.linkBtn}>Forgot your password?</Text>
            </TouchableOpacity>
          )}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={
              formType === "login" ? handleLogin
                : formType === "signup" ? handleSignup
                : handleForgotPassword
            }
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>
                {formType === "login" ? "Sign In"
                  : formType === "signup" ? "Sign Up"
                  : "Send Reset Link"}
              </Text>
            )}
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
  authContainer: {
    flex: 1,
    backgroundColor: "#764ba2", // gradient fallback (use LinearGradient for full effect)
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  formContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  formHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 15,
    color: "#666",
  },
  errorBox: {
    backgroundColor: "#fee",
    borderColor: "#fed7d7",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#c53030",
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: "#e1e5e9",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1a1a1a",
    backgroundColor: "#fff",
    marginBottom: 0,
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e1e5e9",
    borderRadius: 8,
    backgroundColor: "#fff",
    paddingRight: 8,
  },
  eyeBtn: {
    padding: 8,
  },
  submitBtn: {
    backgroundColor: "#667eea",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkBtn: {
    color: "#667eea",
    fontSize: 14,
    textDecorationLine: "underline",
    textAlign: "center",
    marginTop: 8,
  },
  linkBtnPrimary: {
    color: "#667eea",
    fontSize: 14,
    fontWeight: "600",
  },
  formFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e1e5e9",
  },
  footerText: {
    fontSize: 14,
    color: "#666",
  },
});

export default LoginForm;