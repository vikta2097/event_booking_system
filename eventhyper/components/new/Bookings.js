import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, ActivityIndicator, StyleSheet, Alert
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../api";

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => { fetchBookings(); }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/bookings");
      setBookings(res.data);
    } catch (err) {
      setError("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId, newStatus) => {
    try {
      await api.put(`/bookings/${bookingId}`, { status: newStatus });
      setBookings((prev) =>
        prev.map((b) => b.id === bookingId ? { ...b, booking_status: newStatus } : b)
      );
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update booking status");
      fetchBookings();
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this booking?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/bookings/${id}`);
            setBookings((prev) => prev.filter((b) => b.id !== id));
            setError("");
          } catch (err) {
            setError(err.response?.data?.error || "Failed to delete booking");
            fetchBookings();
          }
        }
      }
    ]);
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesStatus = filterStatus === "all" || b.booking_status === filterStatus;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      b.user_name?.toLowerCase().includes(term) ||
      b.event_title?.toLowerCase().includes(term) ||
      b.user_email?.toLowerCase().includes(term);
    return matchesStatus && matchesSearch;
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

  const statusColor = (status) => {
    if (status === "confirmed") return { color: "#27ae60", bg: "#eafaf1", border: "#27ae60" };
    if (status === "pending") return { color: "#f39c12", bg: "#fef5e7", border: "#f39c12" };
    return { color: "#e74c3c", bg: "#fadbd8", border: "#e74c3c" };
  };

  const renderBooking = ({ item: booking }) => {
    const sc = statusColor(booking.booking_status);
    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingRow}>
          <Text style={styles.bookingId}>#{booking.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
            <Text style={[styles.statusText, { color: sc.color }]}>{booking.booking_status}</Text>
          </View>
        </View>

        <Text style={styles.customerName}>{booking.user_name || "N/A"}</Text>
        <Text style={styles.customerEmail}>{booking.user_email || "N/A"}</Text>
        {booking.user_phone ? <Text style={styles.customerEmail}>{booking.user_phone}</Text> : null}

        <Text style={styles.eventTitle}>{booking.event_title || "N/A"}</Text>
        <Text style={styles.metaText}>📍 {booking.location || "N/A"}</Text>
        <Text style={styles.metaText}>
          📅 Event: {booking.event_date ? new Date(booking.event_date).toLocaleDateString() : "N/A"}
        </Text>
        <Text style={styles.metaText}>
          🕒 Booked: {booking.booking_date ? new Date(booking.booking_date).toLocaleString() : "N/A"}
        </Text>
        <Text style={styles.metaText}>🎟 Seats: {booking.seats || 0}</Text>
        <Text style={styles.amountText}>KES {parseFloat(booking.total_amount || 0).toLocaleString()}</Text>

        <View style={styles.statusPickerRow}>
          <Text style={styles.changeLabel}>Change status:</Text>
          <View style={[styles.pickerWrapper, { borderColor: sc.border }]}>
            <Picker
              selectedValue={booking.booking_status}
              onValueChange={(val) => handleStatusChange(booking.id, val)}
              style={[styles.picker, { color: sc.color }]}
            >
              <Picker.Item label="Pending" value="pending" />
              <Picker.Item label="Confirmed" value="confirmed"
                enabled={!(booking.booking_status === "pending" && booking.payment_status !== "success")}
              />
              <Picker.Item label="Cancelled" value="cancelled" />
            </Picker>
          </View>
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(booking.id)}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Manage Bookings</Text>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
        <View style={styles.statCard}><Text style={styles.statLabel}>Total</Text><Text style={styles.statValue}>{stats.total}</Text></View>
        <View style={[styles.statCard, styles.pendingCard]}><Text style={styles.statLabel}>Pending</Text><Text style={styles.statValue}>{stats.pending}</Text></View>
        <View style={[styles.statCard, styles.confirmedCard]}><Text style={styles.statLabel}>Confirmed</Text><Text style={styles.statValue}>{stats.confirmed}</Text></View>
        <View style={[styles.statCard, styles.cancelledCard]}><Text style={styles.statLabel}>Cancelled</Text><Text style={styles.statValue}>{stats.cancelled}</Text></View>
        <View style={[styles.statCard, styles.revenueCard]}><Text style={styles.statLabel}>Revenue</Text><Text style={styles.statValue}>KES {stats.totalRevenue.toLocaleString()}</Text></View>
      </ScrollView>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search by customer name, email, or event..."
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      {/* Filter Buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
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
          <TouchableOpacity onPress={() => setError("")}><Text style={styles.errorClose}>×</Text></TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#3498db" style={{ marginTop: 40 }} />
      ) : filteredBookings.length === 0 ? (
        <Text style={styles.noData}>
          {bookings.length === 0 ? "No bookings found." : "No bookings match your search criteria."}
        </Text>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBooking}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa", padding: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#0012af", marginBottom: 16 },
  statsScroll: { marginBottom: 16 },
  statCard: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginRight: 12, minWidth: 110, borderLeftWidth: 4, borderLeftColor: "#3498db", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  pendingCard: { borderLeftColor: "#f39c12" },
  confirmedCard: { borderLeftColor: "#27ae60" },
  cancelledCard: { borderLeftColor: "#e74c3c" },
  revenueCard: { borderLeftColor: "#9b59b6" },
  statLabel: { fontSize: 11, color: "#0012af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: "700", color: "#0012af" },
  searchInput: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#e0e6ed", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12 },
  filterScroll: { marginBottom: 12 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 2, borderColor: "#e0e6ed", borderRadius: 8, marginRight: 8, backgroundColor: "#fff" },
  filterBtnActive: { backgroundColor: "#3498db", borderColor: "#3498db" },
  filterBtnText: { color: "#0012af", fontWeight: "600", fontSize: 14 },
  filterBtnTextActive: { color: "#fff" },
  errorBox: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#fadbd8", borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: "#e74c3c", flex: 1 },
  errorClose: { color: "#e74c3c", fontSize: 20, fontWeight: "700", marginLeft: 8 },
  noData: { textAlign: "center", color: "#7f8c8d", fontSize: 16, marginTop: 40 },
  bookingCard: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  bookingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  bookingId: { fontWeight: "700", color: "#2c3e50", fontSize: 15 },
  statusBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  customerName: { fontWeight: "700", color: "#2c3e50", fontSize: 15, marginBottom: 2 },
  customerEmail: { color: "#7f8c8d", fontSize: 13, marginBottom: 1 },
  eventTitle: { fontWeight: "700", color: "#2c3e50", marginTop: 8, marginBottom: 2 },
  metaText: { color: "#7f8c8d", fontSize: 13, marginBottom: 2 },
  amountText: { fontWeight: "700", color: "#2c3e50", marginTop: 6, fontSize: 15 },
  statusPickerRow: { flexDirection: "row", alignItems: "center", marginTop: 10, flexWrap: "wrap" },
  changeLabel: { color: "#555", fontSize: 13, marginRight: 8 },
  pickerWrapper: { borderWidth: 2, borderRadius: 6, flex: 1, minWidth: 140 },
  picker: { height: 44 },
  deleteBtn: { backgroundColor: "#e74c3c", borderRadius: 6, padding: 10, alignItems: "center", marginTop: 10 },
  deleteBtnText: { color: "#fff", fontWeight: "700" },
});

export default Bookings;
