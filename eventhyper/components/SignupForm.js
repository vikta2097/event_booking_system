// components/SignupForm.js (React Native)
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import api from "../api";

const SignupForm = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignup = async () => {
    setError("");

    if (!name || !email || !password || !confirmPassword) {
      setError("All fields are required"); return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match"); return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must be at least 6 characters with a lowercase letter, number, and special character");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/register", { fullname: name, email, password });
      Alert.alert("✅ Success", "Signup successful! Please login.", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Network error. Please ensure your backend is running.");
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
            <Text style={styles.formTitle}>Create Account</Text>
            <Text style={styles.formSubtitle}>Join us today</Text>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

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

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={50}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                secureTextEntry={!showPassword}
                maxLength={16}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Text>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Minimum 6 characters, maximum 16 characters</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry={!showConfirmPassword}
                maxLength={16}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                <Text>{showConfirmPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword !== "" && password !== confirmPassword && (
              <Text style={styles.errorHint}>Passwords do not match</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Create Account</Text>
            }
          </TouchableOpacity>

          <View style={styles.formFooter}>
            <Text style={styles.footerText}>Already have an account? </Text>
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
  hint: { fontSize: 12, color: "#666", marginTop: 4 },
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

export default SignupForm;