import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  ScrollView, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator 
} from "react-native";
import api from "../api"; // centralized axios instance

const DashboardHome = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");
      const endpoint = role === "organizer" ? "/dashboard/organizer" : "/dashboard";

      const response = await api.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboardData(response.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        "Failed to load dashboard data. Check your network or backend."
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#666" />
        <Text>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorMessage}>
        <Text>{error}</Text>
      </View>
    );
  }

  if (!dashboardData) {
    return (
      <View style={styles.errorMessage}>
        <Text>No data available</Text>
      </View>
    );
  }

  const { totals, recentActivity, upcomingEvents, recentPayments } = dashboardData;

  const renderStatCard = (icon, title, value, styleIcon) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, styleIcon]}>
        <Text style={{ fontSize: 28 }}>{icon}</Text>
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statNumber}>{value}</Text>
      </View>
    </View>
  );

  const renderListItem = (item, type) => {
    switch (type) {
      case "event":
        return (
          <View style={styles.listItem}>
            <Text style={styles.titleText}>{item.title}</Text>
            <Text style={styles.dateText}>
              {new Date(item.event_date || item.created_at).toLocaleDateString()}
            </Text>
          </View>
        );
      case "booking":
        return (
          <View style={styles.listItem}>
            <Text style={styles.titleText}>Booking #{item.id}</Text>
            <Text style={styles.dateText}>
              {new Date(item.booking_date).toLocaleDateString()}
            </Text>
          </View>
        );
      case "payment":
        return (
          <View style={styles.paymentItem}>
            <Text style={styles.titleText}>{item.method}</Text>
            <Text style={styles.paymentAmount}>
              KES {parseFloat(item.amount).toLocaleString()}
            </Text>
            <Text style={styles.dateText}>
              {new Date(item.paid_at).toLocaleDateString()}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.dashboardHome}>
      <View style={styles.dashboardHeader}>
        <Text style={styles.dashboardHeaderTitle}>Dashboard Overview</Text>
        <Text style={styles.dashboardHeaderText}>
          Welcome back! Here's what's happening with your events.
        </Text>
      </View>

      {/* Statistics */}
      <View style={styles.statsGrid}>
        {renderStatCard("📅", "Total Events", totals.totalEvents, styles.statIconEvents)}
        {renderStatCard("🎟️", "Total Bookings", totals.totalBookings, styles.statIconBookings)}
        {renderStatCard(
          "💰",
          "Total Revenue",
          `KES ${totals.totalRevenue.toLocaleString()}`,
          styles.statIconRevenue
        )}
      </View>

      {/* Dashboard Cards */}
      <View style={styles.dashboardGrid}>
        {/* Upcoming Events */}
        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardCardTitle}>Upcoming Events</Text>
          {upcomingEvents?.length ? (
            <FlatList
              data={upcomingEvents}
              renderItem={({ item }) => renderListItem(item, "event")}
              keyExtractor={(item) => item.id.toString()}
            />
          ) : (
            <Text style={styles.noData}>No upcoming events</Text>
          )}
        </View>

        {/* Recent Bookings */}
        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardCardTitle}>Recent Bookings</Text>
          {recentActivity?.bookings?.length ? (
            <FlatList
              data={recentActivity.bookings}
              renderItem={({ item }) => renderListItem(item, "booking")}
              keyExtractor={(item) => item.id.toString()}
            />
          ) : (
            <Text style={styles.noData}>No recent bookings</Text>
          )}
        </View>

        {/* Recent Events */}
        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardCardTitle}>Recent Events</Text>
          {recentActivity?.events?.length ? (
            <FlatList
              data={recentActivity.events}
              renderItem={({ item }) => renderListItem(item, "event")}
              keyExtractor={(item) => item.id.toString()}
            />
          ) : (
            <Text style={styles.noData}>No recent events</Text>
          )}
        </View>

        {/* Recent Payments */}
        <View style={styles.dashboardCard}>
          <Text style={styles.dashboardCardTitle}>Recent Payments</Text>
          {recentPayments?.length ? (
            <FlatList
              data={recentPayments}
              renderItem={({ item }) => renderListItem(item, "payment")}
              keyExtractor={(item) => item.id.toString()}
            />
          ) : (
            <Text style={styles.noData}>No recent payments</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

export default DashboardHome;

// -------------------
// Stylesheet (inside the same file)
// -------------------
const styles = StyleSheet.create({
  dashboardHome: {
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  dashboardHeader: {
    marginBottom: 16,
  },
  dashboardHeaderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  dashboardHeaderText: {
    fontSize: 16,
    color: "#666",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    width: "48%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statIconEvents: { backgroundColor: "#764ba2" },
  statIconBookings: { backgroundColor: "#f5576c" },
  statIconRevenue: { backgroundColor: "#00f2fe" },
  statContent: { flex: 1 },
  statTitle: {
    fontSize: 12,
    color: "#666",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dashboardCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    width: "48%",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  dashboardCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    borderBottomWidth: 2,
    borderBottomColor: "#f5f5f5",
    paddingBottom: 8,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  titleText: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  dateText: { fontSize: 12, color: "#666" },
  paymentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  paymentAmount: { color: "#10b981", fontWeight: "700", fontSize: 14 },
  noData: { textAlign: "center", fontStyle: "italic", color: "#999", padding: 24 },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", height: 400 },
  errorMessage: { flex: 1, justifyContent: "center", alignItems: "center", height: 400 },
});