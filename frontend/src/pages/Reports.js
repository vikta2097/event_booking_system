import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Share,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { PieChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import api from "../api";

const screenWidth = Dimensions.get("window").width;
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString()}`;

const Reports = ({ user, token }) => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalBookings: 0,
    totalEvents: 0,
  });
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    eventId: "",
    paymentStatus: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30days");
  const [showFilters, setShowFilters] = useState(false);

  // ✅ FIX: stable function (fixes useEffect warning)
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const endpoint =
        user?.role === "admin"
          ? "/reports/admin"
          : "/reports/organizer";

      const res = await api.get(endpoint, {
        params: filters,
        headers: { Authorization: `Bearer ${token}` },
      });

      setReports(res.data?.reports || []);
      setStats(res.data?.stats || {});
      setAnalytics(res.data?.analytics || null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [filters, token, user?.role]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]); // ✅ FIXED

  const applyDateRange = (range) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "7days":
        start.setDate(start.getDate() - 7);
        break;
      case "30days":
        start.setDate(start.getDate() - 30);
        break;
      case "90days":
        start.setDate(start.getDate() - 90);
        break;
      case "year":
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    setDateRange(range);
    setFilters((prev) => ({
      ...prev,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    }));
  };

  const exportCSV = async () => {
    if (!reports.length) return;

    const headers =
      "Booking ID,User,Event,Seats,Date,Amount,Payment,Status\n";

    const rows = reports
      .map((r) =>
        [
          r.booking_id,
          r.user_name,
          r.event_title,
          r.seats,
          r.booking_date
            ? new Date(r.booking_date).toLocaleDateString()
            : "",
          r.payment_amount || r.booking_amount,
          r.payment_status,
          r.booking_status,
        ].join(",")
      )
      .join("\n");

    await Share.share({ message: headers + rows });
  };

  const toPieData = (data) =>
    data.map((d, i) => ({
      name: d.name,
      population: Math.round(d.percentage || 0),
      color: COLORS[i % COLORS.length],
      legendFontColor: "#555",
      legendFontSize: 12,
    }));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>
          {user?.role === "admin" ? "Admin Reports" : "Organizer Reports"}
        </Text>

        <View style={{ flexDirection: "row" }}>
          <TouchableOpacity onPress={exportCSV}>
            <Text>Export</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={fetchReports}>
            <Text>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && <ActivityIndicator />}

      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      <ScrollView horizontal>
        {["today", "7days", "30days", "90days", "year"].map((r) => (
          <TouchableOpacity key={r} onPress={() => applyDateRange(r)}>
            <Text>{r}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {analytics?.paymentStatus?.length > 0 && (
        <PieChart
          data={toPieData(analytics.paymentStatus)}
          width={screenWidth - 20}
          height={200}
          accessor="population"
          backgroundColor="transparent"
        />
      )}
    </ScrollView>
  );
};

export default Reports;