// Organizer/OrganizerBookings.js (React Native)
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import api from "../shared/api";

const STATUS_COLORS = {
  pending:   { bg: "#fef5e7", border: "#f39c12", text: "#f39c12" },
  confirmed: { bg: "#eafaf1", border: "#27ae60", text: "#27ae60" },
  cancelled: { bg: "#fadbd8", border: "#e74c3c", text: "#e74c3c" },
};

const OrganizerBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { fetchBookings(); }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true); setError("");
      const res = await api.get("/bookings/organizer");
      setBookings(res.data);
    } catch (err) {
      setError("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    // Show action sheet for status selection
    Alert.alert("Update Status", `Change to "${newStatus}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            await api.put(`/bookings/organizer/${bookingId}`, { status: newStatus });
            setBookings((prev) =>
              prev.map((b) => b.id === bookingId ? { ...b, booking_status: newStatus } : b)
            );
          } catch (err) {
            setError(err.response?.data?.error || "Failed to update booking status");
            fetchBookings();
          }
        },
      },
    ]);
  };

  const showStatusOptions = (booking) => {
    const options = ["pending", "confirmed", "cancelled"].filter(
      (s) => s !== booking.booking_status
    );
    Alert.alert("Change Status", "Select new status:", [
      ...options.map((s) => ({
        text: s.charAt(0).toUpperCase() + s.slice(1),
        onPress: () => handleStatusChange(booking.id, s),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchStatus = filterStatus === "all" || booking.booking_status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchSearch =
      booking.user_name?.toLowerCase().includes(term) ||
      booking.event_title?.toLowerCase().includes(term) ||
      booking.user_email?.toLowerCase().includes(term);
    return matchStatus && matchSearch;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter((b) => b.booking_status === "pending").length,
    confirmed: bookings.filter((b) => b.booking_status === "confirmed").length,
    cancelled: bookings.filter((b) => b.booking_status === "cancelled").length,
    totalRevenue: bookings
      .filter((b) => b.booking_status === "confirmed")
      .reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0),
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.pageTitle}>Manage Bookings</Text>
      <Text style={styles.pageSubtitle}>Bookings for your events only</Text>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow}>
        {[
          { label: "Total", value: stats.total, color: "#3498db" },
          { label: "Pending", value: stats.pending, color: "#f39c12" },
          { label: "Confirmed", value: stats.confirmed, color: "#27ae60" },
          { label: "Cancelled", value: stats.cancelled, color: "#e74c3c" },
          { label: "Revenue", value: `KES ${stats.totalRevenue.toLocaleString()}`, color: "#9b59b6" },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { borderLeftColor: s.color }]}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search by name, email, or event..."
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      {/* Filter buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {["all", "pending", "confirmed", "cancelled"].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterBtn, filterStatus === status && styles.filterBtnActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterBtnText, filterStatus === status && styles.filterBtnTextActive]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Error */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError("")}>
            <Text style={styles.errorClose}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 40 }} />
      ) : filteredBookings.length === 0 ? (
        <Text style={styles.noData}>
          {bookings.length === 0 ? "No bookings found for your events." : "No bookings match your search."}
        </Text>
      ) : (
        filteredBookings.map((booking) => {
          const colors = STATUS_COLORS[booking.booking_status] || STATUS_COLORS.pending;
          return (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <Text style={styles.bookingId}>Booking #{booking.id}</Text>
                <TouchableOpacity
                  style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}
                  onPress={() => showStatusOptions(booking)}
                >
                  <Text style={[styles.statusText, { color: colors.text }]}>
                    {booking.booking_status} ▾
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bookingRow}>
                <Text style={styles.bookingFieldLabel}>Customer</Text>
                <Text style={styles.bookingFieldValue}>{booking.user_name || "N/A"}</Text>
              </View>
              <View style={styles.bookingRow}>
                <Text style={styles.bookingFieldLabel}>Email</Text>
                <Text style={styles.bookingFieldValue}>{booking.user_email || "N/A"}</Text>
              </View>
              <View style={styles.bookingRow}>
                <Text style={styles.bookingFieldLabel}>Event</Text>
                <Text style={styles.bookingFieldValue}>{booking.event_title || "N/A"}</Text>
              </View>
              <View style={styles.bookingRow}>
                <Text style={styles.bookingFieldLabel}>Event Date</Text>
                <Text style={styles.bookingFieldValue}>
                  {booking.event_date ? new Date(booking.event_date).toLocaleDateString() : "N/A"}
                </Text>
              </View>
              <View style={styles.bookingRow}>
                <Text style={styles.bookingFieldLabel}>Seats</Text>
                <Text style={styles.bookingFieldValue}>{booking.seats || 0}</Text>
              </View>
              <View style={styles.bookingRow}>
                <Text style={styles.bookingFieldLabel}>Amount</Text>
                <Text style={[styles.bookingFieldValue, styles.amountText]}>
                  KES {parseFloat(booking.total_amount || 0).toLocaleString()}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#0012af", marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: "#666", marginBottom: 20 },

  statsRow: { marginBottom: 20 },
  statCard: {
    backgroundColor: "#fff", padding: 14, borderRadius: 10, marginRight: 12,
    borderLeftWidth: 4, minWidth: 120,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  statLabel: { fontSize: 12, color: "#666", textTransform: "uppercase", marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "700" },

  searchInput: {
    backgroundColor: "#fff", borderWidth: 2, borderColor: "#e0e6ed",
    borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12,
  },
  filterRow: { marginBottom: 20 },
  filterBtn: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
    borderWidth: 2, borderColor: "#e0e6ed", marginRight: 8, backgroundColor: "#fff",
  },
  filterBtnActive: { backgroundColor: "#3498db", borderColor: "#3498db" },
  filterBtnText: { color: "#0012af", fontWeight: "500", fontSize: 14 },
  filterBtnTextActive: { color: "#fff" },

  errorBox: {
    backgroundColor: "#fadbd8", borderRadius: 8, padding: 12,
    flexDirection: "row", justifyContent: "space-between", marginBottom: 16,
  },
  errorText: { color: "#e74c3c", flex: 1 },
  errorClose: { color: "#e74c3c", fontSize: 20, fontWeight: "700" },

  bookingCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  bookingHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
  },
  bookingId: { fontSize: 16, fontWeight: "700", color: "#2c3e50" },
  statusBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  bookingRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  bookingFieldLabel: { fontSize: 13, color: "#7f8c8d", fontWeight: "500" },
  bookingFieldValue: { fontSize: 13, color: "#2c3e50", fontWeight: "500", maxWidth: "60%", textAlign: "right" },
  amountText: { color: "#27ae60", fontWeight: "700" },
  noData: { textAlign: "center", color: "#999", padding: 40, fontStyle: "italic" },
});

export default OrganizerBookings;