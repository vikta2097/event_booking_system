import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import api from "../api";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const screenWidth = Dimensions.get("window").width;

const OrganizerReports = () => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", eventId: "", paymentStatus: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30days");
  const [darkMode, setDarkMode] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports/organizer", { params: filters });
      setReports(res.data?.reports || []);
      setStats(res.data?.stats || { totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
      setAnalytics(res.data?.analytics || null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to fetch reports.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const applyDateRange = useCallback((range) => {
    const end = new Date();
    const start = new Date();
    switch (range) {
      case "today": start.setHours(0, 0, 0, 0); break;
      case "7days": start.setDate(start.getDate() - 7); break;
      case "30days": start.setDate(start.getDate() - 30); break;
      case "90days": start.setDate(start.getDate() - 90); break;
      case "year": start.setFullYear(start.getFullYear() - 1); break;
      default: return;
    }
    setDateRange(range);
    setFilters((prev) => ({
      ...prev,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    }));
  }, []);

  const enhancedAnalytics = useMemo(() => {
    if (!analytics) return null;
    return {
      timeSeriesData: analytics.timeSeriesData || [],
      dayOfWeekData: analytics.dayOfWeekData || [],
      hourlyData: analytics.hourlyData || [],
      paymentStatus: analytics.paymentStatus || [],
      eventPerformance: analytics.eventPerformance || [],
      avgBookingValue: analytics.avgBookingValue || 0,
      revenueGrowth: analytics.revenueGrowth || 0,
      bookingsGrowth: analytics.bookingsGrowth || 0,
      conversionRate: analytics.conversionRate || 0,
    };
  }, [analytics]);

  const insights = useMemo(() => {
    if (!enhancedAnalytics) return [];
    const items = [];
    if (enhancedAnalytics.revenueGrowth > 10) {
      items.push({ type: "positive", title: "Strong Revenue Growth", message: `Revenue up ${enhancedAnalytics.revenueGrowth.toFixed(1)}%` });
    }
    if (enhancedAnalytics.bookingsGrowth > 15) {
      items.push({ type: "positive", title: "Booking Surge", message: `Bookings increased by ${enhancedAnalytics.bookingsGrowth.toFixed(1)}%` });
    }
    return items;
  }, [enhancedAnalytics]);

  const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;

  // CSV Export using Expo FileSystem + Sharing
  const exportToCSV = async () => {
    if (!reports.length) return;
    const headers = ["Booking ID", "User", "Event", "Seats", "Amount", "Payment Status"];
    const rows = reports.map(r => [
      r.booking_id,
      r.user_name,
      r.event_title,
      r.seats,
      r.booking_amount || r.payment_amount,
      r.payment_status
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

    const fileUri = `${FileSystem.documentDirectory}organizer-reports-${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Share Reports CSV" });
    } else {
      alert("Sharing is not available on this device");
    }
  };

  return (
    <ScrollView style={[styles.container, darkMode && styles.darkContainer]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, darkMode && styles.darkText]}>Event Analytics</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setDarkMode(!darkMode)} style={styles.actionBtn}>
            <Text>{darkMode ? "☀️" : "🌙"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchReports} style={styles.actionBtn}>
            <Text>🔄 Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={exportToCSV} style={styles.actionBtn}>
            <Text>📥 Export CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Range */}
      <View style={styles.dateRange}>
        {["today", "7days", "30days", "90days", "year"].map(range => (
          <TouchableOpacity
            key={range}
            style={[styles.rangeBtn, dateRange === range && styles.activeRange]}
            onPress={() => applyDateRange(range)}
          >
            <Text style={darkMode && styles.darkText}>
              {range === "today" ? "Today" : range === "7days" ? "7 Days" : range === "30days" ? "30 Days" : range === "90days" ? "90 Days" : "1 Year"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator size="large" color="#3b82f6" />}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Stats */}
      <ScrollView horizontal style={styles.statsScroll}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Revenue</Text>
          <Text style={styles.statValue}>{formatCurrency(stats.totalRevenue)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Bookings</Text>
          <Text style={styles.statValue}>{stats.totalBookings}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Events</Text>
          <Text style={styles.statValue}>{stats.totalEvents}</Text>
        </View>
      </ScrollView>

      {/* Insights */}
      {insights.length > 0 && (
        <View style={styles.insights}>
          {insights.map((i, idx) => (
            <View key={idx} style={styles.insightCard}>
              <Text style={styles.insightTitle}>{i.title}</Text>
              <Text>{i.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tab Content */}
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setActiveTab("overview")} style={[styles.tabBtn, activeTab === "overview" && styles.activeTab]}>
          <Text style={darkMode && styles.darkText}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab("events")} style={[styles.tabBtn, activeTab === "events" && styles.activeTab]}>
          <Text style={darkMode && styles.darkText}>Events</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "overview" && enhancedAnalytics?.timeSeriesData.length > 0 && (
        <LineChart
          data={{
            labels: enhancedAnalytics.timeSeriesData.map(d => d.date),
            datasets: [
              { data: enhancedAnalytics.timeSeriesData.map(d => d.revenue), color: () => "#3b82f6" },
              { data: enhancedAnalytics.timeSeriesData.map(d => d.bookings), color: () => "#10b981" },
            ],
          }}
          width={screenWidth - 20}
          height={220}
          chartConfig={{
            backgroundColor: darkMode ? "#1f2937" : "#fff",
            backgroundGradientFrom: darkMode ? "#1f2937" : "#fff",
            backgroundGradientTo: darkMode ? "#374151" : "#fff",
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(59,130,246, ${opacity})`,
            labelColor: (opacity = 1) => darkMode ? "#fff" : "#000",
          }}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#f9fafb" },
  darkContainer: { backgroundColor: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 22, fontWeight: "bold" },
  darkText: { color: "#fff" },
  headerActions: { flexDirection: "row" },
  actionBtn: { marginHorizontal: 5, padding: 5, backgroundColor: "#e5e7eb", borderRadius: 5 },
  dateRange: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  rangeBtn: { margin: 3, padding: 5, borderWidth: 1, borderColor: "#3b82f6", borderRadius: 5 },
  activeRange: { backgroundColor: "#3b82f6" },
  statsScroll: { flexDirection: "row", marginBottom: 10 },
  statCard: { width: 120, padding: 10, marginRight: 5, backgroundColor: "#fff", borderRadius: 8, elevation: 2 },
  statLabel: { fontSize: 12, color: "#6b7280" },
  statValue: { fontSize: 16, fontWeight: "bold" },
  insights: { marginBottom: 10 },
  insightCard: { padding: 10, marginVertical: 5, backgroundColor: "#dbeafe", borderRadius: 8 },
  insightTitle: { fontWeight: "bold", marginBottom: 3 },
  error: { color: "red", marginBottom: 10 },
  tabs: { flexDirection: "row", marginBottom: 10 },
  tabBtn: { flex: 1, padding: 8, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: "#3b82f6" },
});

export default OrganizerReports;