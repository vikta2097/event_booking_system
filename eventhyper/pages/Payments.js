import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import api from "../api";

const PAGE_SIZE = 10;

const PaymentsScreen = () => {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [processingRefunds, setProcessingRefunds] = useState({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  /* ================= FETCH ================= */

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/payments");
      let data = res.data || [];

      if (filter !== "all") {
        data = data.filter((p) => p.status === filter);
      }

      setPayments(data);
    } catch (err) {
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/payments/stats/summary");
      setStats(res.data);
    } catch {}
  };

  useEffect(() => {
    const fetchAll = async () => {
      await fetchStats();
      await fetchPayments();
    };
    fetchAll();
  }, [filter]);

  /* ================= SEARCH ================= */

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const text = `${p.user_name} ${p.event_title} ${p.method} ${p.status}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });
  }, [payments, search]);

  /* ================= PAGINATION ================= */

  const paginatedData = filteredPayments.slice(0, page * PAGE_SIZE);

  /* ================= REFUND ================= */

  const handleRefund = (id) => {
    Alert.alert("Confirm Refund", "Proceed with refund?", [
      { text: "Cancel" },
      {
        text: "Yes",
        onPress: async () => {
          setProcessingRefunds((prev) => ({ ...prev, [id]: true }));

          try {
            const paymentRes = await api.get(`/payments/${id}`);

            if (paymentRes.data.status !== "success") {
              Alert.alert("Only successful payments can be refunded");
              return;
            }

            await api.put(`/payments/refund/${id}`);
            fetchPayments();
            fetchStats();
          } catch {
            Alert.alert("Refund failed");
          } finally {
            setProcessingRefunds((prev) => ({ ...prev, [id]: false }));
          }
        },
      },
    ]);
  };

  /* ================= CSV EXPORT ================= */

  const exportCSV = async () => {
    if (!filteredPayments.length) return;

    const headers = ["ID","User","Event","Amount","Method","Status","Date"];

    const rows = filteredPayments.map((p) => [
      p.id,
      p.user_name || "N/A",
      p.event_title || "N/A",
      p.amount,
      p.method,
      p.status,
      new Date(p.created_at).toLocaleString(),
    ]);

    const csv =
      headers.join(",") +
      "\n" +
      rows.map((r) => r.map((i) => `"${i}"`).join(",")).join("\n");

    const fileUri = FileSystem.documentDirectory + "payments.csv";

    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Sharing.shareAsync(fileUri);
  };

  /* ================= UI ================= */

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payments Dashboard</Text>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.card}>
          <Text>Total Revenue</Text>
          <Text>KES {stats.total || 0}</Text>
        </View>
        <View style={styles.card}>
          <Text>Pending</Text>
          <Text>{stats.pending || 0}</Text>
        </View>
        <View style={styles.card}>
          <Text>Failed / Refunded</Text>
          <Text>{stats.failed || 0}</Text>
        </View>
      </View>

      {/* Search + Filter */}
      <TextInput
        placeholder="Search payments..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      <View style={styles.filterRow}>
        <Picker
          selectedValue={filter}
          style={{ flex: 1 }}
          onValueChange={(v) => {
            setPage(1);
            setFilter(v);
          }}
        >
          <Picker.Item label="All" value="all" />
          <Picker.Item label="Success" value="success" />
          <Picker.Item label="Pending" value="pending" />
          <Picker.Item label="Failed" value="failed" />
          <Picker.Item label="Refunded" value="refunded" />
        </Picker>

        <TouchableOpacity style={styles.exportBtn} onPress={exportCSV}>
          <Text style={{ color: "#fff" }}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Table */}
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ScrollView horizontal>
          <View>
            {/* Sticky Header */}
            <View style={[styles.row, styles.headerRow]}>
              {["ID","User","Event","Amount","Method","Status","Date","Action"].map((h, i) => (
                <Text key={i} style={[styles.headerCell, { width: 120 }]}>
                  {h}
                </Text>
              ))}
            </View>

            {/* Rows */}
            <ScrollView style={{ maxHeight: 400 }}>
              {paginatedData.map((p) => (
                <View key={p.id} style={styles.row}>
                  <Text style={[styles.cell, { width: 120 }]}>{p.id}</Text>
                  <Text style={[styles.cell, { width: 120 }]}>{p.user_name}</Text>
                  <Text style={[styles.cell, { width: 120 }]}>{p.event_title}</Text>
                  <Text style={[styles.cell, { width: 120 }]}>KES {p.amount}</Text>
                  <Text style={[styles.cell, { width: 120 }]}>{p.method}</Text>

                  <Text style={[styles.cell, styles[p.status], { width: 120 }]}>
                    {p.status}
                  </Text>

                  <Text style={[styles.cell, { width: 160 }]}>
                    {new Date(p.created_at).toLocaleString()}
                  </Text>

                  <View style={{ width: 120 }}>
                    {p.status === "success" && (
                      <TouchableOpacity
                        style={styles.refundBtn}
                        onPress={() => handleRefund(p.id)}
                      >
                        <Text style={styles.btnText}>Refund</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {/* Pagination */}
      {paginatedData.length < filteredPayments.length && (
        <TouchableOpacity
          style={styles.loadMore}
          onPress={() => setPage((p) => p + 1)}
        >
          <Text>Load More</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default PaymentsScreen;

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },

  statsContainer: { flexDirection: "row", marginBottom: 10 },
  card: {
    flex: 1,
    backgroundColor: "#f3f7ff",
    margin: 5,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  search: {
    borderWidth: 1,
    padding: 8,
    borderRadius: 5,
    marginBottom: 10,
  },

  filterRow: { flexDirection: "row", alignItems: "center" },

  exportBtn: {
    backgroundColor: "#003366",
    padding: 10,
    marginLeft: 10,
    borderRadius: 5,
  },

  headerRow: { backgroundColor: "#003366" },

  headerCell: {
    color: "#fff",
    padding: 10,
    fontWeight: "bold",
  },

  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#eee" },

  cell: { padding: 10, fontSize: 12 },

  success: { color: "green" },
  pending: { color: "orange" },
  failed: { color: "red" },
  refunded: { color: "red" },

  refundBtn: {
    backgroundColor: "#ff5252",
    padding: 6,
    borderRadius: 5,
    alignItems: "center",
  },

  btnText: { color: "#fff" },

  loadMore: {
    padding: 12,
    alignItems: "center",
    backgroundColor: "#eee",
    marginTop: 10,
  },

  error: { color: "red", textAlign: "center" },
});