// components/ForgotPasswordForm.js (React Native)
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import api from "../api";

const ForgotPasswordForm = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotSubmit = async () => {
    setError(""); setMessage("");

    if (!email) { setError("Please enter your email address."); return; }

    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });

      if (res.data?.token) {
        setMessage("Check your email for the reset link!");
      } else {
        setMessage("If the email exists, a reset link has been sent.");
      }

      // Navigate back to login after 3 seconds
      setTimeout(() => navigation.navigate("Login"), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Network error. Please make sure your backend is running.");
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
            <Text style={styles.formTitle}>Forgot Password</Text>
            <Text style={styles.formSubtitle}>Enter your email to reset your password</Text>
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
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your registered email"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={50}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleForgotSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Send Reset Link</Text>
            }
          </TouchableOpacity>

          <View style={styles.formFooter}>
            <Text style={styles.footerText}>Remembered your password? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.linkBtnPrimary}>Sign in</Text>
            </TouchableOpacity>
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
  input: {
    borderWidth: 2, borderColor: "#e1e5e9", borderRadius: 8,
    padding: 12, fontSize: 16, color: "#1a1a1a", backgroundColor: "#fff",
  },
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

export default ForgotPasswordForm;