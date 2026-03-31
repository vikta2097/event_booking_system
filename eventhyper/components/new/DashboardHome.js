import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const DashboardHome = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      const response = await api.get("/dashboard", {
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

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#667eea" /><Text style={styles.loadingText}>Loading dashboard...</Text></View>;
  if (error) return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text></View>;
  if (!dashboardData) return <View style={styles.centered}><Text style={styles.errorText}>No data available</Text></View>;

  const { totals, recentActivity, upcomingEvents, recentPayments } = dashboardData;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Dashboard Overview</Text>
        <Text style={styles.pageSubtitle}>Welcome back! Here's what's happening with your events.</Text>
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
        <View style={[styles.statCard, styles.statEvents]}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={styles.statLabel}>Total Events</Text>
          <Text style={styles.statNumber}>{totals.totalEvents}</Text>
        </View>
        <View style={[styles.statCard, styles.statBookings]}>
          <Text style={styles.statIcon}>🎟️</Text>
          <Text style={styles.statLabel}>Total Bookings</Text>
          <Text style={styles.statNumber}>{totals.totalBookings}</Text>
        </View>
        <View style={[styles.statCard, styles.statRevenue]}>
          <Text style={styles.statIcon}>💰</Text>
          <Text style={styles.statLabel}>Total Revenue</Text>
          <Text style={styles.statNumber}>KES {totals.totalRevenue.toLocaleString()}</Text>
        </View>
      </ScrollView>

      {/* Upcoming Events */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming Events</Text>
        {upcomingEvents?.length ? upcomingEvents.map((event) => (
          <View key={event.id} style={styles.listItem}>
            <Text style={styles.listItemTitle}>{event.title}</Text>
            <Text style={styles.listItemMeta}>{new Date(event.event_date).toLocaleDateString()} at {event.start_time}</Text>
          </View>
        )) : <Text style={styles.noData}>No upcoming events</Text>}
      </View>

      {/* Recent Bookings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Bookings</Text>
        {recentActivity?.bookings?.length ? recentActivity.bookings.map((booking) => (
          <View key={booking.id} style={styles.listItem}>
            <Text style={styles.listItemTitle}>Booking #{booking.id}</Text>
            <Text style={styles.listItemMeta}>{new Date(booking.booking_date).toLocaleDateString()}</Text>
          </View>
        )) : <Text style={styles.noData}>No recent bookings</Text>}
      </View>

      {/* Recent Events */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Events</Text>
        {recentActivity?.events?.length ? recentActivity.events.map((event) => (
          <View key={event.id} style={styles.listItem}>
            <Text style={styles.listItemTitle}>{event.title}</Text>
            <Text style={styles.listItemMeta}>{new Date(event.created_at).toLocaleDateString()}</Text>
          </View>
        )) : <Text style={styles.noData}>No recent events</Text>}
      </View>

      {/* Recent Payments */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Payments</Text>
        {recentPayments?.length ? recentPayments.map((payment) => (
          <View key={payment.id} style={styles.paymentItem}>
            <Text style={styles.listItemTitle}>{payment.method}</Text>
            <Text style={styles.paymentAmount}>KES {parseFloat(payment.amount).toLocaleString()}</Text>
            <Text style={styles.listItemMeta}>{new Date(payment.paid_at).toLocaleDateString()}</Text>
          </View>
        )) : <Text style={styles.noData}>No recent payments</Text>}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { color: "#666", marginTop: 12, fontSize: 16 },
  errorText: { color: "#ef4444", fontSize: 16, fontWeight: "500", textAlign: "center" },
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 26, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  pageSubtitle: { color: "#666", fontSize: 15 },
  statsScroll: { marginBottom: 20 },
  statCard: { borderRadius: 12, padding: 20, marginRight: 14, minWidth: 160, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  statEvents: { backgroundColor: "#667eea" },
  statBookings: { backgroundColor: "#f093fb" },
  statRevenue: { backgroundColor: "#4facfe" },
  statIcon: { fontSize: 32, marginBottom: 8 },
  statLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  statNumber: { color: "#fff", fontSize: 22, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 12, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: "#f5f5f5" },
  listItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  listItemTitle: { fontWeight: "600", color: "#1a1a1a", fontSize: 14, flex: 1 },
  listItemMeta: { color: "#666", fontSize: 13 },
  paymentItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f5f5" },
  paymentAmount: { color: "#10b981", fontWeight: "700", fontSize: 15 },
  noData: { color: "#999", fontStyle: "italic", textAlign: "center", paddingVertical: 20, fontSize: 14 },
});

export default DashboardHome;
