// pages/DashboardHome.js (React Native)
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const StatCard = ({ icon, label, value, gradient }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: gradient }]}>
      <Text style={styles.statIconText}>{icon}</Text>
    </View>
    <View style={styles.statContent}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statNumber}>{value}</Text>
    </View>
  </View>
);

const SectionCard = ({ title, children }) => (
  <View style={styles.dashCard}>
    <Text style={styles.dashCardTitle}>{title}</Text>
    <View style={styles.divider} />
    {children}
  </View>
);

const DashboardHome = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // ✅ AsyncStorage instead of localStorage
      const role = await AsyncStorage.getItem("role");
      const token = await AsyncStorage.getItem("token");
      const endpoint = role === "organizer" ? "/dashboard/organizer" : "/dashboard";
      const response = await api.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboardData(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchDashboardData}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dashboardData) return null;

  const { totals, recentActivity, upcomingEvents, recentPayments } = dashboardData;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.pageTitle}>Dashboard Overview</Text>
      <Text style={styles.pageSubtitle}>
        Welcome back! Here's what's happening with your events.
      </Text>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <StatCard icon="📅" label="Total Events" value={totals.totalEvents} gradient="#667eea" />
        <StatCard icon="🎟️" label="Total Bookings" value={totals.totalBookings} gradient="#f5576c" />
        <StatCard
          icon="💰"
          label="Total Revenue"
          value={`KES ${totals.totalRevenue.toLocaleString()}`}
          gradient="#4facfe"
        />
      </View>

      {/* Upcoming Events */}
      <SectionCard title="Upcoming Events">
        {upcomingEvents?.length ? (
          upcomingEvents.map((event) => (
            <View key={event.id} style={styles.listItem}>
              <Text style={styles.listItemTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.listItemSub}>
                {new Date(event.event_date).toLocaleDateString()} at {event.start_time}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>No upcoming events</Text>
        )}
      </SectionCard>

      {/* Recent Bookings */}
      <SectionCard title="Recent Bookings">
        {recentActivity?.bookings?.length ? (
          recentActivity.bookings.map((booking) => (
            <View key={booking.id} style={styles.listItem}>
              <Text style={styles.listItemTitle}>Booking #{booking.id}</Text>
              <Text style={styles.listItemSub}>
                {new Date(booking.booking_date).toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>No recent bookings</Text>
        )}
      </SectionCard>

      {/* Recent Events */}
      <SectionCard title="Recent Events">
        {recentActivity?.events?.length ? (
          recentActivity.events.map((event) => (
            <View key={event.id} style={styles.listItem}>
              <Text style={styles.listItemTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.listItemSub}>
                {new Date(event.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>No recent events</Text>
        )}
      </SectionCard>

      {/* Recent Payments */}
      <SectionCard title="Recent Payments">
        {recentPayments?.length ? (
          recentPayments.map((payment) => (
            <View key={payment.id} style={styles.paymentItem}>
              <Text style={styles.listItemTitle}>{payment.method}</Text>
              <Text style={styles.paymentAmount}>
                KES {parseFloat(payment.amount).toLocaleString()}
              </Text>
              <Text style={styles.listItemSub}>
                {new Date(payment.paid_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noData}>No recent payments</Text>
        )}
      </SectionCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  loadingText: { marginTop: 12, color: "#666", fontSize: 16 },
  errorText: { color: "#ef4444", fontSize: 16, textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: "#667eea", borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryBtnText: { color: "#fff", fontWeight: "600" },
  pageTitle: { fontSize: 24, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  pageSubtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  statsGrid: { gap: 16, marginBottom: 24 },
  statCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  statIcon: { width: 60, height: 60, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  statIconText: { fontSize: 28 },
  statContent: { flex: 1 },
  statLabel: { fontSize: 12, color: "#666", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statNumber: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  dashCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  dashCardTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 12 },
  divider: { height: 2, backgroundColor: "#f5f5f5", marginBottom: 12 },
  listItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  listItemTitle: { fontSize: 15, fontWeight: "600", color: "#1a1a1a", marginBottom: 2 },
  listItemSub: { fontSize: 13, color: "#666" },
  paymentItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  paymentAmount: { fontSize: 16, fontWeight: "700", color: "#10b981", marginVertical: 2 },
  noData: { color: "#999", textAlign: "center", padding: 24, fontStyle: "italic" },
});

export default DashboardHome;