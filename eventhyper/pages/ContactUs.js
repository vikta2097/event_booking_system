import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../api";

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: "", email: "", subject: "", message: "", priority: "low",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.email.trim() ||
        !formData.subject.trim() || !formData.message.trim()) {
      Alert.alert("Validation", "All fields are required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert("Validation", "Please enter a valid email address");
      return;
    }
    try {
      setSubmitting(true);
      const res = await api.post("/contact", formData);
      Alert.alert("Success", res.data?.message || "Message sent successfully!");
      setFormData({ name: "", email: "", subject: "", message: "", priority: "low" });
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Failed to send message. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <Text style={styles.headerSubtitle}>Have a question or need assistance? We're here to help!</Text>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Get in Touch</Text>
        <Text style={styles.infoText}>📧 victorlabs854@gmail.com</Text>
        <Text style={styles.infoText}>📞 +254 (7)59205319</Text>
        <Text style={styles.infoText}>📍 MAIN CAMPUS WAY, KARATINA</Text>
        <Text style={styles.infoText}>🕐 Mon–Fri 9:00–18:00, Sat 10:00–16:00, Sun Closed</Text>
      </View>

      {/* Form Section */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Send Us a Message</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={formData.name}
          onChangeText={(v) => handleChange("name", v)}
        />
        <TextInput
          style={styles.input}
          placeholder="Email Address"
          value={formData.email}
          onChangeText={(v) => handleChange("email", v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Subject"
          value={formData.subject}
          onChangeText={(v) => handleChange("subject", v)}
        />

        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={formData.priority}
            onValueChange={(v) => handleChange("priority", v)}
            style={styles.picker}
          >
            <Picker.Item label="Low - General inquiry" value="low" />
            <Picker.Item label="Medium - Need assistance" value="medium" />
            <Picker.Item label="High - Urgent issue" value="high" />
          </Picker>
        </View>

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Type your message here..."
          value={formData.message}
          onChangeText={(v) => handleChange("message", v)}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Send Message</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const PURPLE = "#667eea";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f0ff" },
  content: { paddingBottom: 40 },
  header: { backgroundColor: PURPLE, padding: 40, alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 32, fontWeight: "700", marginBottom: 10 },
  headerSubtitle: { color: "rgba(255,255,255,0.92)", fontSize: 16, textAlign: "center" },
  infoSection: { backgroundColor: "#f8f9fa", padding: 24, borderBottomWidth: 1, borderBottomColor: "#e9ecef" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#333", marginBottom: 16 },
  infoText: { color: "#6c757d", fontSize: 14, marginBottom: 10, lineHeight: 22 },
  formSection: { backgroundColor: "#fff", padding: 24 },
  input: { borderWidth: 2, borderColor: "#e9ecef", borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 16, color: "#333" },
  textArea: { minHeight: 130, textAlignVertical: "top" },
  pickerWrapper: { borderWidth: 2, borderColor: "#e9ecef", borderRadius: 8, marginBottom: 16, overflow: "hidden" },
  picker: { height: 50, color: "#333" },
  submitBtn: { backgroundColor: PURPLE, borderRadius: 8, padding: 16, alignItems: "center", marginTop: 8, shadowColor: PURPLE, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnDisabled: { backgroundColor: "#6c757d" },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

export default ContactUs;
