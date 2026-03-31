// Reports.js — React Native version
import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Share,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { PieChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import api from "../api";

const screenWidth = Dimensions.get("window").width;
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;

const insightIcon = (type) =>
  type === "positive" ? "✅" : type === "warning" ? "⚠️" : type === "alert" ? "🚨" : "ℹ️";

const insightBg = (type) => ({
  positive: "#d1fae5",
  warning: "#fef3c7",
  alert: "#fee2e2",
  info: "#dbeafe",
}[type] || "#f3f4f6");

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, trend, trendUp }) => (
  <View style={styles.statCard}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    {trend ? (
      <Text style={[styles.statTrend, { color: trendUp ? "#10b981" : "#ef4444" }]}>{trend}</Text>
    ) : null}
  </View>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", eventId: "", paymentStatus: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30days");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  // ── API ────────────────────────────────────────────────────────────────────

  const fetchReports = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/reports", { params: filters });
      setReports(res.data?.reports || []);
      setStats(res.data?.stats || { totalRevenue: 0, totalBookings: 0, totalEvents: 0 });
      setAnalytics(res.data?.analytics || null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  const applyDateRange = (range) => {
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
  };

  // ── Analytics & Insights ──────────────────────────────────────────────────

  const enhancedAnalytics = useMemo(() => {
    if (!analytics) return null;
    return {
      timeSeriesData: analytics.timeSeriesData || [],
      dayOfWeekData: analytics.dayOfWeekData || [],
      paymentStatus: analytics.paymentStatus || [],
      bookingStatus: analytics.bookingStatus || [],
      eventPerformance: analytics.eventPerformance || [],
      suspiciousBookings: analytics.suspiciousBookings || [],
      revenueGrowth: analytics.revenueGrowth || 0,
      bookingsGrowth: analytics.bookingsGrowth || 0,
      avgBookingValue: analytics.avgBookingValue || 0,
    };
  }, [analytics]);

  const safe = enhancedAnalytics || {
    timeSeriesData: [], dayOfWeekData: [], paymentStatus: [],
    bookingStatus: [], eventPerformance: [], suspiciousBookings: [],
    revenueGrowth: 0, bookingsGrowth: 0, avgBookingValue: 0,
  };

  const insights = useMemo(() => {
    if (!enhancedAnalytics || reports.length === 0) return [];
    const items = [];

    if (enhancedAnalytics.revenueGrowth > 10)
      items.push({ type: "positive", title: "Strong Revenue Growth", message: `Revenue is up ${enhancedAnalytics.revenueGrowth}% vs previous period.` });
    else if (enhancedAnalytics.revenueGrowth < -10)
      items.push({ type: "warning", title: "Revenue Decline", message: `Revenue is down ${Math.abs(enhancedAnalytics.revenueGrowth)}%.` });

    if (enhancedAnalytics.bookingsGrowth > 15)
      items.push({ type: "positive", title: "Booking Surge", message: `Bookings increased by ${enhancedAnalytics.bookingsGrowth}%.` });

    const failed = enhancedAnalytics.paymentStatus.find((p) => p.name?.toLowerCase() === "failed");
    if (failed?.percentage > 5)
      items.push({ type: "alert", title: "High Payment Failure Rate", message: `${failed.percentage.toFixed(1)}% of payments are failing.` });

    const bestDay = enhancedAnalytics.dayOfWeekData.reduce((b, c) => (c.revenue > (b.revenue || 0) ? c : b), { revenue: 0 });
    if (bestDay?.revenue > 0)
      items.push({ type: "info", title: "Peak Performance Day", message: `${bestDay.day} generates the most revenue (${formatCurrency(bestDay.revenue)}).` });

    if (enhancedAnalytics.suspiciousBookings.length > 0)
      items.push({ type: "alert", title: "Potential Fraud Detected", message: `${enhancedAnalytics.suspiciousBookings.length} bookings show unusual patterns.` });

    if (enhancedAnalytics.eventPerformance.length > 0) {
      const top = enhancedAnalytics.eventPerformance[0];
      items.push({ type: "info", title: "Best Performing Event", message: `"${top.name}" — ${top.bookings} bookings, ${formatCurrency(top.revenue)}.` });
    }

    return items;
  }, [enhancedAnalytics, reports]);

  // ── Export (Share as CSV text on mobile) ──────────────────────────────────

  const exportCSV = async () => {
    if (!reports.length) return;
    const headers = "Booking ID,User,Event,Seats,Date,Amount,Payment,Status\n";
    const rows = reports.map((r) =>
      [r.booking_id, r.user_name, r.event_title, r.seats,
        r.booking_date ? new Date(r.booking_date).toLocaleDateString() : "",
        r.payment_amount || r.booking_amount, r.payment_status, r.booking_status
      ].join(",")
    ).join("\n");
    await Share.share({ message: headers + rows, title: "Event Reports" });
  };

  // ── Pie chart data helper ─────────────────────────────────────────────────

  const toPieData = (data) =>
    data.map((d, i) => ({
      name: d.name,
      population: Math.round(d.percentage || 0),
      color: COLORS[i % COLORS.length],
      legendFontColor: "#555",
      legendFontSize: 12,
    }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Analytics & Reports</Text>
          <Text style={styles.subHeadingLight}>Insights into your event performance</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.btnSecondary} onPress={exportCSV} disabled={!reports.length}>
            <Text style={styles.btnSecondaryText}>📥 Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} onPress={fetchReports} disabled={loading}>
            <Text style={styles.btnPrimaryText}>{loading ? "⏳" : "🔄"} Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Range Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangeRow}>
        {["today", "7days", "30days", "90days", "year"].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.rangeBtn, dateRange === r && styles.rangeBtnActive]}
            onPress={() => applyDateRange(r)}
          >
            <Text style={[styles.rangeBtnText, dateRange === r && styles.rangeBtnTextActive]}>
              {r === "today" ? "Today" : r === "7days" ? "7 Days" : r === "30days" ? "30 Days" : r === "90days" ? "90 Days" : "1 Year"}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.rangeBtn} onPress={() => setShowFilters(!showFilters)}>
          <Text style={styles.rangeBtnText}>🔍 Filters</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Advanced Filters */}
      {showFilters && (
        <View style={styles.filtersCard}>
          <TextInput
            style={styles.input}
            placeholder="Start Date (YYYY-MM-DD)"
            value={filters.startDate}
            onChangeText={(v) => setFilters((p) => ({ ...p, startDate: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="End Date (YYYY-MM-DD)"
            value={filters.endDate}
            onChangeText={(v) => setFilters((p) => ({ ...p, endDate: v }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Event ID"
            value={filters.eventId}
            onChangeText={(v) => setFilters((p) => ({ ...p, eventId: v }))}
          />
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={filters.paymentStatus}
              onValueChange={(v) => setFilters((p) => ({ ...p, paymentStatus: v }))}
              style={styles.picker}
            >
              <Picker.Item label="All Payment Status" value="" />
              <Picker.Item label="Paid" value="paid" />
              <Picker.Item label="Pending" value="pending" />
              <Picker.Item label="Failed" value="failed" />
            </Picker>
          </View>
          <View style={styles.filterBtns}>
            <TouchableOpacity style={styles.btnPrimary} onPress={fetchReports}>
              <Text style={styles.btnPrimaryText}>Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => {
              setFilters({ startDate: "", endDate: "", eventId: "", paymentStatus: "" });
              setDateRange("30days");
              fetchReports();
            }}>
              <Text style={styles.btnSecondaryText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Error */}
      {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}

      {/* Loading */}
      {loading && <ActivityIndicator color="#3b82f6" style={{ marginVertical: 20 }} />}

      {/* AI Insights */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 AI-Powered Insights</Text>
          {insights.map((ins, i) => (
            <View key={i} style={[styles.insightCard, { backgroundColor: insightBg(ins.type) }]}>
              <Text style={styles.insightIcon}>{insightIcon(ins.type)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>{ins.title}</Text>
                <Text style={styles.insightMessage}>{ins.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Stats Cards */}
      {enhancedAnalytics && (
        <View style={styles.statsGrid}>
          <StatCard icon="💰" label="Total Revenue" value={formatCurrency(stats.totalRevenue)}
            trend={`${safe.revenueGrowth >= 0 ? "↗" : "↘"} ${Math.abs(safe.revenueGrowth)}% vs prev`}
            trendUp={safe.revenueGrowth >= 0} />
          <StatCard icon="🎫" label="Total Bookings" value={String(stats.totalBookings)}
            trend={`${safe.bookingsGrowth >= 0 ? "↗" : "↘"} ${Math.abs(safe.bookingsGrowth)}% vs prev`}
            trendUp={safe.bookingsGrowth >= 0} />
          <StatCard icon="📅" label="Total Events" value={String(stats.totalEvents)} trend="Active events" />
          <StatCard icon="📊" label="Avg Booking Value" value={formatCurrency(safe.avgBookingValue)} trend="Per booking" />
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow}>
        {[
          { key: "overview", label: "📈 Overview" },
          { key: "events", label: "🎪 Events" },
          { key: "trends", label: "🚨 Suspicious" },
          { key: "data", label: "📋 Raw Data" },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      {enhancedAnalytics && (
        <View style={styles.tabContent}>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <View>
              {/* Payment Status Pie */}
              {safe.paymentStatus.length > 0 && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Payment Status</Text>
                  <PieChart
                    data={toPieData(safe.paymentStatus)}
                    width={screenWidth - 48}
                    height={200}
                    chartConfig={{ color: () => "#3b82f6" }}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute
                  />
                </View>
              )}

              {/* Booking Status Pie */}
              {safe.bookingStatus.length > 0 && (
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Booking Status</Text>
                  <PieChart
                    data={toPieData(safe.bookingStatus)}
                    width={screenWidth - 48}
                    height={200}
                    chartConfig={{ color: () => "#10b981" }}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    absolute
                  />
                </View>
              )}

              {safe.paymentStatus.length === 0 && safe.bookingStatus.length === 0 && (
                <Text style={styles.noData}>No chart data available for this period.</Text>
              )}
            </View>
          )}

          {/* Events Tab */}
          {activeTab === "events" && (
            <View style={styles.tableCard}>
              <Text style={styles.chartTitle}>Event Performance</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 2 }]}>Event</Text>
                <Text style={styles.th}>Bookings</Text>
                <Text style={styles.th}>Revenue</Text>
              </View>
              {safe.eventPerformance.length === 0 ? (
                <Text style={styles.noData}>No event data</Text>
              ) : (
                safe.eventPerformance.map((e, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{e.name}</Text>
                    <Text style={styles.td}>{e.bookings}</Text>
                    <Text style={styles.td}>{formatCurrency(e.revenue)}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Suspicious Tab */}
          {activeTab === "trends" && (
            <View style={styles.tableCard}>
              <Text style={styles.chartTitle}>Suspicious Bookings</Text>
              {safe.suspiciousBookings.length === 0 ? (
                <Text style={styles.noData}>✅ No suspicious bookings found.</Text>
              ) : (
                safe.suspiciousBookings.map((b, i) => (
                  <View key={i} style={styles.suspiciousCard}>
                    <Text style={styles.suspiciousId}>Booking #{b.booking_id}</Text>
                    <Text style={styles.suspiciousDetail}>User: {b.user_name}</Text>
                    <Text style={styles.suspiciousDetail}>Event: {b.event_title}</Text>
                    <Text style={styles.suspiciousDetail}>Amount: {formatCurrency(b.amount)}</Text>
                    <Text style={styles.suspiciousReason}>⚠️ {b.reason}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Raw Data Tab */}
          {activeTab === "data" && (
            <View style={styles.tableCard}>
              <Text style={styles.chartTitle}>Raw Bookings ({reports.length})</Text>
              {reports.length === 0 ? (
                <Text style={styles.noData}>No booking data</Text>
              ) : (
                reports.map((r, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rawId}>#{r.booking_id} — {r.user_name}</Text>
                      <Text style={styles.rawDetail}>{r.event_title}</Text>
                      <Text style={styles.rawDetail}>Seats: {r.seats} | {r.booking_date ? new Date(r.booking_date).toLocaleDateString() : ""}</Text>
                      <View style={styles.rawBadges}>
                        <Text style={[styles.rawBadge, { backgroundColor: r.payment_status === "paid" ? "#10b981" : r.payment_status === "failed" ? "#ef4444" : "#f59e0b" }]}>
                          {r.payment_status}
                        </Text>
                        <Text style={[styles.rawBadge, { backgroundColor: "#3b82f6" }]}>
                          {r.booking_status}
                        </Text>
                        <Text style={styles.rawAmount}>{formatCurrency(r.payment_amount || r.booking_amount)}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      )}

      {!enhancedAnalytics && !loading && (
        <Text style={styles.noData}>No analytics data. Try refreshing or changing the date range.</Text>
      )}
    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 16 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  heading: { fontSize: 20, fontWeight: "bold", color: "#1e3a5f" },
  subHeadingLight: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 8 },
  btnPrimary: { backgroundColor: "#3b82f6", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  btnPrimaryText: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  btnSecondary: { backgroundColor: "#e5e7eb", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6 },
  btnSecondaryText: { color: "#374151", fontWeight: "bold", fontSize: 13 },

  // Date Range
  rangeRow: { flexDirection: "row", marginBottom: 14 },
  rangeBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#e5e7eb", marginRight: 8 },
  rangeBtnActive: { backgroundColor: "#3b82f6" },
  rangeBtnText: { fontSize: 12, color: "#374151", fontWeight: "600" },
  rangeBtnTextActive: { color: "#fff" },

  // Filters
  filtersCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 14, elevation: 2 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10, marginBottom: 8, fontSize: 13, backgroundColor: "#fff" },
  pickerWrapper: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, marginBottom: 8, backgroundColor: "#fff" },
  picker: { height: 50 },
  filterBtns: { flexDirection: "row", gap: 10 },

  // Error
  errorText: { color: "#ef4444", fontWeight: "bold", textAlign: "center", marginBottom: 10 },

  // Insights
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: "#1e3a5f", marginBottom: 10 },
  insightCard: { flexDirection: "row", borderRadius: 8, padding: 12, marginBottom: 8, alignItems: "flex-start" },
  insightIcon: { fontSize: 20, marginRight: 10 },
  insightTitle: { fontWeight: "bold", fontSize: 13, color: "#1f2937", marginBottom: 2 },
  insightMessage: { fontSize: 12, color: "#374151" },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, width: "47%", elevation: 2, alignItems: "center" },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statLabel: { fontSize: 11, color: "#6b7280", marginBottom: 2, textAlign: "center" },
  statValue: { fontSize: 16, fontWeight: "bold", color: "#1e3a5f", textAlign: "center" },
  statTrend: { fontSize: 11, marginTop: 4, textAlign: "center" },

  // Tabs
  tabsRow: { flexDirection: "row", marginBottom: 14 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#e5e7eb", marginRight: 8 },
  tabBtnActive: { backgroundColor: "#3b82f6" },
  tabBtnText: { fontSize: 12, color: "#374151", fontWeight: "600" },
  tabBtnTextActive: { color: "#fff" },
  tabContent: { marginTop: 4 },

  // Charts
  chartCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 16, elevation: 2 },
  chartTitle: { fontSize: 14, fontWeight: "bold", color: "#1e3a5f", marginBottom: 10 },

  // Table
  tableCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 16, elevation: 2 },
  tableHeader: { flexDirection: "row", backgroundColor: "#3b82f6", borderRadius: 6, padding: 8, marginBottom: 4 },
  th: { flex: 1, color: "#fff", fontWeight: "bold", fontSize: 12 },
  tableRow: { flexDirection: "row", padding: 8, borderRadius: 4 },
  tableRowAlt: { backgroundColor: "#f9fafb" },
  td: { flex: 1, fontSize: 12, color: "#374151" },

  // Suspicious
  suspiciousCard: { backgroundColor: "#fee2e2", borderRadius: 8, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: "#ef4444" },
  suspiciousId: { fontWeight: "bold", color: "#991b1b", marginBottom: 2 },
  suspiciousDetail: { fontSize: 12, color: "#374151" },
  suspiciousReason: { fontSize: 12, color: "#b91c1c", marginTop: 4, fontWeight: "600" },

  // Raw Data
  rawId: { fontWeight: "bold", fontSize: 13, color: "#1e3a5f" },
  rawDetail: { fontSize: 12, color: "#6b7280" },
  rawBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, alignItems: "center" },
  rawBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12, color: "#fff", fontSize: 11 },
  rawAmount: { fontSize: 12, fontWeight: "bold", color: "#1e3a5f" },

  noData: { color: "#6b7280", fontStyle: "italic", textAlign: "center", marginTop: 20, padding: 10 },
});

export default Reports;