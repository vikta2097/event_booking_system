/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import api from "../api";

const PaymentPage = ({ user }) => {
  const route = useRoute();
  const navigation = useNavigation();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const pollIntervalRef = useRef(null);
  const pollCountRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 60;

  useEffect(() => {
    const loadBooking = async () => {
      try {
        const res = await api.get(`/bookings/${bookingId}`);
        const bookingData = res.data;
        setBooking(bookingData);
        if (bookingData.booking_status === "confirmed") {
          navigation.replace("BookingSuccess", { bookingId });
        }
      } catch {
        setError("Failed to load booking details.");
      }
    };
    loadBooking();
  }, [bookingId]);

  useEffect(() => {
    if (!booking) return;
    const checkExistingPayment = async () => {
      try {
        const res = await api.get(`/payments/by-booking/${bookingId}`);
        const paymentData = res.data;
        if (!paymentData) return;
        if (paymentData.status === "success") navigation.replace("BookingSuccess", { bookingId });
        else if (paymentData.status === "pending") { pollCountRef.current = 0; setIsPolling(true); }
      } catch {}
    };
    checkExistingPayment();
  }, [booking, bookingId]);

  useEffect(() => {
    if (user?.phone) setPhoneNumber(user.phone);
  }, [user]);

  useEffect(() => {
    if (!isPolling) return;
    pollIntervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      setPollCount(pollCountRef.current);
      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        clearInterval(pollIntervalRef.current);
        setIsPolling(false);
        setError("Payment verification timeout. Please check your M-Pesa messages or contact support.");
        return;
      }
      try {
        const bookingRes = await api.get(`/bookings/${bookingId}`);
        if (bookingRes.data.booking_status === "confirmed") {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          navigation.replace("BookingSuccess", { bookingId });
          return;
        }
        const paymentRes = await api.get(`/payments/by-booking/${bookingId}`);
        if (paymentRes.data?.status === "success") {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          navigation.replace("BookingSuccess", { bookingId });
          return;
        }
        if (paymentRes.data?.status === "failed") {
          clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          setError("Payment failed or was cancelled. Please try again.");
        }
      } catch {}
    }, 3000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [isPolling, bookingId]);

  const handlePayment = async () => {
    if (!phoneNumber.trim()) { setError("Phone number is required"); return; }
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, "");
    const phoneRegex = /^(\+?254|0)(7\d{8}|1\d{8})$/;
    if (!phoneRegex.test(cleanPhone)) { setError("Please enter a valid Safaricom phone number (07 or 01)"); return; }
    setLoading(true);
    setError("");
    pollCountRef.current = 0;
    try {
      await api.post("/payments/mpesa", { booking_id: bookingId, phone: cleanPhone });
      setIsPolling(true);
      Alert.alert("M-Pesa Request Sent", "Please enter your M-Pesa PIN to complete payment.");
    } catch (err) {
      setError(err.response?.data?.error || "Payment initiation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsPolling(false);
    setError("");
    pollCountRef.current = 0;
    setPollCount(0);
  };

  if (!booking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.heading}>Complete Your Payment</Text>

        {/* Booking Details */}
        <View style={styles.bookingDetails}>
          <Text style={styles.eventTitle}>{booking.event_title}</Text>
          <Text style={styles.metaText}>
            {new Date(booking.event_date).toLocaleDateString("en-GB", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </Text>
          <Text style={styles.metaText}>{booking.location}</Text>

          {booking.tickets?.length > 0 && (
            <View style={styles.ticketsSection}>
              <Text style={styles.ticketsSectionTitle}>Tickets</Text>
              {booking.tickets.map((ticket, index) => (
                <View key={index} style={styles.ticketRow}>
                  <Text style={styles.ticketName}>{ticket.ticket_name} x {ticket.quantity}</Text>
                  <Text style={styles.ticketPrice}>KES {(ticket.price * ticket.quantity).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalAmount}>KES {parseFloat(booking.total_amount).toLocaleString()}</Text>
          </View>
        </View>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Phone Input */}
        {!isPolling && (
          <View style={styles.form}>
            <Text style={styles.label}>M-Pesa Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="0712345678 or 0112345678"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              editable={!loading}
            />
            <Text style={styles.hint}>You will receive an M-Pesa prompt on this number</Text>

            <TouchableOpacity
              style={[styles.payBtn, loading && styles.payBtnDisabled]}
              onPress={handlePayment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payBtnText}>Pay with M-Pesa</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Polling State */}
        {isPolling && (
          <View style={styles.pendingBox}>
            <ActivityIndicator size="large" color="#007bff" style={{ marginBottom: 16 }} />
            <Text style={styles.pendingTitle}>Waiting for Payment Confirmation</Text>
            <Text style={styles.pendingText}>Please check your phone for the M-Pesa prompt</Text>
            <Text style={styles.pendingText}>Enter your M-Pesa PIN to complete the payment</Text>
            <Text style={styles.pollCount}>Checking... ({pollCount}/{MAX_POLL_ATTEMPTS})</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelPolling}>
              <Text style={styles.cancelBtnText}>Cancel & Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#666", marginTop: 12, fontSize: 15 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 20, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  heading: { fontSize: 22, fontWeight: "700", color: "#333", textAlign: "center", marginBottom: 20 },
  bookingDetails: { backgroundColor: "#f8f9fa", borderRadius: 10, padding: 16, marginBottom: 16 },
  eventTitle: { fontSize: 20, fontWeight: "700", color: "#333", marginBottom: 6 },
  metaText: { color: "#666", fontSize: 14, marginBottom: 4 },
  ticketsSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#ddd" },
  ticketsSectionTitle: { color: "#555", fontWeight: "700", marginBottom: 8, fontSize: 15 },
  ticketRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  ticketName: { color: "#666", fontSize: 14 },
  ticketPrice: { color: "#333", fontSize: 14, fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 2, borderTopColor: "#ddd" },
  totalLabel: { fontWeight: "700", fontSize: 16, color: "#333" },
  totalAmount: { fontWeight: "700", fontSize: 18, color: "#007bff" },
  errorBox: { backgroundColor: "#fee", borderWidth: 1, borderColor: "#fcc", borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: "#c33", textAlign: "center" },
  form: { marginTop: 8 },
  label: { fontWeight: "700", color: "#333", marginBottom: 8, fontSize: 15 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 6 },
  hint: { color: "#666", fontSize: 13, marginBottom: 16 },
  payBtn: { backgroundColor: "#28a745", borderRadius: 10, padding: 16, alignItems: "center" },
  payBtnDisabled: { backgroundColor: "#ccc" },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  pendingBox: { alignItems: "center", backgroundColor: "#e7f3ff", borderRadius: 10, padding: 24, marginTop: 8 },
  pendingTitle: { fontSize: 17, fontWeight: "700", color: "#333", marginBottom: 8 },
  pendingText: { color: "#666", fontSize: 14, marginBottom: 4, textAlign: "center" },
  pollCount: { color: "#999", fontSize: 13, marginTop: 10 },
  cancelBtn: { marginTop: 16, backgroundColor: "#dc3545", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  cancelBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

export default PaymentPage;
