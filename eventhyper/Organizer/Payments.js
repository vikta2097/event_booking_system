import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
  Picker,
  ScrollView,
  Platform,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import api from "../api"; // Axios instance with Authorization header

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [processingRefunds, setProcessingRefunds] = useState({});

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/payments");
      let data = res.data || [];
      if (filter !== "all") data = data.filter((p) => p.status === filter);
      setPayments(data);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/payments/stats/summary");
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      await fetchStats();
      await fetchPayments();
    };
    fetchAll();
  }, [filter]);

  const handleRefund = async (id) => {
    Alert.alert(
      "Confirm Refund",
      "Are you sure you want to mark this as refunded?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            setProcessingRefunds((prev) => ({ ...prev, [id]: true }));
            try {
              const paymentRes = await api.get(`/payments/${id}`);
              if (!paymentRes.data) {
                Alert.alert("Payment no longer exists");
                fetchPayments();
                return;
              }
              if (paymentRes.data.status !== "success") {
                Alert.alert("Only successful payments can be refunded");
                fetchPayments();
                return;
              }
              await api.put(`/payments/refund/${id}`);
              fetchPayments();
              fetchStats();
            } catch (err) {
              console.error("Error refunding payment:", err);
              Alert.alert(err.response?.data?.error || "Failed to process refund");
            } finally {
              setProcessingRefunds((prev) => ({ ...prev, [id]: false }));
            }
          },
        },
      ]
    );
  };

  const downloadCSV = async () => {
    if (!payments.length) return;

    const headers = ["ID", "User", "Event", "Amount", "Method", "Status", "Date"];
    const rows = payments.map((p) => [
      p.id,
      p.user_name || "N/A",
      p.event_title || "N/A",
      p.amount,
      p.method,
      p.status,
      new Date(p.created_at).toLocaleString(),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((i) => `"${i}"`).join(","))].join("\n");

    const fileUri = FileSystem.cacheDirectory + `payments_report_${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
  };

  const renderPayment = ({ item }) => (
    <View style={styles.row}>
      <Text style={styles.cell}>{item.id}</Text>
      <Text style={styles.cell}>{item.user_name || "N/A"}</Text>
      <Text style={styles.cell}>{item.event_title || "N/A"}</Text>
      <Text style={styles.cell}>{item.amount}</Text>
      <Text style={styles.cell}>{item.method}</Text>
      <Text style={[styles.cell, styles[`status_${item.status}`]]}>{item.status}</Text>
      <Text style={styles.cell}>{new Date(item.created_at).toLocaleString()}</Text>
      <View style={styles.cell}>
        {item.status === "success" ? (
          <TouchableOpacity
            style={styles.refundBtn}
            disabled={processingRefunds[item.id]}
            onPress={() => handleRefund(item.id)}
          >
            <Text style={styles.refundBtnText}>
              {processingRefunds[item.id] ? "Processing..." : "Refund"}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text>-</Text>
        )}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Payments Dashboard</Text>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statTitle}>Total Revenue</Text>
          <Text style={styles.statValue}>KES {stats.total?.toLocaleString() || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statTitle}>Pending</Text>
          <Text style={styles.statValue}>{stats.pending || 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statTitle}>Failed / Refunded</Text>
          <Text style={styles.statValue}>{stats.failed || 0}</Text>
        </View>
      </View>

      {/* Filters & Download */}
      <View style={styles.filters}>
        <Text>Filter by Status:</Text>
        {Platform.OS === "ios" ? (
          <Picker
            selectedValue={filter}
            style={{ height: 50, width: 150 }}
            onValueChange={(itemValue) => setFilter(itemValue)}
          >
            <Picker.Item label="All" value="all" />
            <Picker.Item label="Success" value="success" />
            <Picker.Item label="Pending" value="pending" />
            <Picker.Item label="Failed" value="failed" />
            <Picker.Item label="Refunded" value="refunded" />
          </Picker>
        ) : (
          <Picker
            selectedValue={filter}
            style={{ height: 50, width: 150 }}
            onValueChange={(itemValue) => setFilter(itemValue)}
          >
            <Picker.Item label="All" value="all" />
            <Picker.Item label="Success" value="success" />
            <Picker.Item label="Pending" value="pending" />
            <Picker.Item label="Failed" value="failed" />
            <Picker.Item label="Refunded" value="refunded" />
          </Picker>
        )}
        <TouchableOpacity style={styles.downloadBtn} onPress={downloadCSV}>
          <Text style={styles.downloadBtnText}>Download CSV</Text>
        </TouchableOpacity>
      </View>

      {/* Payments List */}
      {loading ? (
        <ActivityIndicator size="large" color="#003366" />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : payments.length === 0 ? (
        <Text style={styles.noData}>No payments found.</Text>
      ) : (
        <View style={styles.tableHeader}>
          <Text style={styles.headerCell}>ID</Text>
          <Text style={styles.headerCell}>User</Text>
          <Text style={styles.headerCell}>Event</Text>
          <Text style={styles.headerCell}>Amount</Text>
          <Text style={styles.headerCell}>Method</Text>
          <Text style={styles.headerCell}>Status</Text>
          <Text style={styles.headerCell}>Date</Text>
          <Text style={styles.headerCell}>Action</Text>
        </View>
      )}

      <FlatList
        data={payments}
        renderItem={renderPayment}
        keyExtractor={(item) => item.id.toString()}
        horizontal={false}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: "#003366" },

  statsContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20, justifyContent: "space-between" },
  statCard: {
    flexBasis: "30%",
    backgroundColor: "#f3f7ff",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  statTitle: { fontWeight: "600", color: "#0056b3", marginBottom: 8 },
  statValue: { fontSize: 18, color: "#111" },

  filters: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  downloadBtn: { backgroundColor: "#3b82f6", padding: 8, borderRadius: 5 },
  downloadBtnText: { color: "#fff" },

  tableHeader: { flexDirection: "row", flexWrap: "wrap", marginBottom: 5 },
  headerCell: { flex: 1, fontWeight: "bold", color: "#003366" },

  row: { flexDirection: "row", flexWrap: "wrap", borderBottomWidth: 1, borderBottomColor: "#e2e2e2", paddingVertical: 8 },
  cell: { flex: 1, paddingHorizontal: 2, fontSize: 12 },

  refundBtn: { backgroundColor: "#ff5252", padding: 6, borderRadius: 5, alignItems: "center" },
  refundBtnText: { color: "#fff" },

  status_success: { color: "green", fontWeight: "600" },
  status_pending: { color: "orange", fontWeight: "600" },
  status_failed: { color: "red", fontWeight: "600" },
  status_refunded: { color: "red", fontWeight: "600" },

  loading: { textAlign: "center", padding: 15 },
  error: { color: "red", textAlign: "center", padding: 15 },
  noData: { color: "#555", textAlign: "center", padding: 15 },
});

export default Payments;