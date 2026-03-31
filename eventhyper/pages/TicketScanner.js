// TicketScanner.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, Button, TextInput, ScrollView,
  StyleSheet, TouchableOpacity, Alert
} from "react-native";
import { Audio } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const TicketScanner = () => {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannerActive, setScannerActive] = useState(true);
  const [bulkScanMode, setBulkScanMode] = useState(false);
  const [scannedTickets, setScannedTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [events, setEvents] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);

  // expo-camera permission hook
  const [permission, requestPermission] = useCameraPermissions();

  const isProcessing = useRef(false);
  const audioSuccess = useRef(null);
  const audioError = useRef(null);

  // ── Load audio ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadSounds = async () => {
      try {
        audioSuccess.current = new Audio.Sound();
        audioError.current = new Audio.Sound();
        await audioSuccess.current.loadAsync(require("../assets/success.mp3"));
        await audioError.current.loadAsync(require("../assets/error.mp3"));
      } catch (err) {
        console.log("Audio load error:", err);
      }
    };
    loadSounds();
    return () => {
      audioSuccess.current?.unloadAsync();
      audioError.current?.unloadAsync();
    };
  }, []);

  // ── Request camera permission ─────────────────────────────────────────────
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  // ── Fetch events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await api.get("/events/organizer/my-events", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEvents(res.data || []);
      } catch (err) {
        console.log(err);
      }
    };
    fetchEvents();
  }, []);

  // ── Fetch event stats ─────────────────────────────────────────────────────
  const fetchEventStats = useCallback(async (eventId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await api.get(`/tickets/event/${eventId}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    fetchEventStats(selectedEvent);
    const interval = setInterval(() => fetchEventStats(selectedEvent), 30000);
    return () => clearInterval(interval);
  }, [selectedEvent]);

  // ── Play sound ────────────────────────────────────────────────────────────
  const playSound = useCallback(async (type) => {
    try {
      if (type === "success" && audioSuccess.current) {
        await audioSuccess.current.replayAsync();
      } else if (type === "error" && audioError.current) {
        await audioError.current.replayAsync();
      }
    } catch (err) {
      console.log("Audio error", err);
    }
  }, []);

  // ── Validate ticket ───────────────────────────────────────────────────────
  const validateTicket = useCallback(
    async (code, isManual = false) => {
      if (isProcessing.current) return;
      isProcessing.current = true;
      setLoading(true);
      setScanResult(null);

      try {
        const token = await AsyncStorage.getItem("token");
        const payload =
          isManual || (code.includes("-") && code.length < 20)
            ? { manual_code: code }
            : { qr_code: code };

        const response = await api.post("/tickets/validate", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const result = {
          success: response.data.valid,
          message: response.data.message,
          ticket: response.data.ticket,
          timestamp: new Date().toLocaleTimeString(),
        };

        setScanResult(result);
        setScanHistory((prev) => [result, ...prev.slice(0, 9)]);
        if (bulkScanMode && result.success) {
          setScannedTickets((prev) => [...prev, result.ticket]);
        }

        playSound(result.success ? "success" : "error");
        if (selectedEvent) fetchEventStats(selectedEvent);
      } catch (err) {
        const errorData = err.response?.data;
        const result = {
          success: false,
          message: errorData?.message || "Validation failed",
          ticket: errorData?.ticket || null,
          timestamp: new Date().toLocaleTimeString(),
        };
        setScanResult(result);
        setScanHistory((prev) => [result, ...prev.slice(0, 9)]);
        playSound("error");
      } finally {
        setLoading(false);
        isProcessing.current = false;
        if (bulkScanMode) {
          setTimeout(() => setScanResult(null), 1500);
        }
      }
    },
    [bulkScanMode, selectedEvent, fetchEventStats, playSound]
  );

  // ── Manual submit ─────────────────────────────────────────────────────────
  const handleManualSubmit = () => {
    if (manualCode.trim() && !loading) {
      const cleanedCode = manualCode.trim().replace(/[\s-]/g, "").toUpperCase();
      validateTicket(cleanedCode, true);
    }
  };

  // ── QR scanned callback ───────────────────────────────────────────────────
  const handleBarcodeScanned = ({ data }) => {
    if (!bulkScanMode || !scanResult) {
      validateTicket(data);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportScannedTickets = async () => {
    if (scannedTickets.length === 0) return;
    const csv = [
      ["Ticket ID", "Attendee", "Ticket Type", "Event", "Scanned At"],
      ...scannedTickets.map((t) => [
        t.id, t.attendee_name, t.ticket_type, t.event_title, t.validated_at,
      ]),
    ]
      .map((r) => r.join(","))
      .join("\n");

    const fileUri = FileSystem.cacheDirectory + `scanned-tickets-${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(fileUri);
  };

  // ── Permission states ─────────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>Camera access is required to scan tickets.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🎫 Ticket Validation</Text>

      {/* Mode Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.modeBtn, bulkScanMode && styles.modeBtnActive]}
          onPress={() => {
            setBulkScanMode(!bulkScanMode);
            setScannedTickets([]);
            setScanResult(null);
          }}
        >
          <Text style={styles.modeBtnText}>
            {bulkScanMode ? "⚡ Bulk ON" : "⚡ Bulk OFF"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modeBtn}
          onPress={() => {
            setScannerActive(!scannerActive);
            setScanResult(null);
          }}
        >
          <Text style={styles.modeBtnText}>
            {scannerActive ? "📝 Manual" : "📷 Camera"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modeBtn}
          onPress={() => setShowStats(!showStats)}
        >
          <Text style={styles.modeBtnText}>
            {showStats ? "📊 Hide Stats" : "📊 Stats"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {showStats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Event Stats</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {events.map((ev) => (
              <TouchableOpacity
                key={ev.id}
                onPress={() => setSelectedEvent(ev.id)}
                style={[
                  styles.eventButton,
                  selectedEvent === ev.id && styles.eventButtonActive,
                ]}
              >
                <Text style={styles.eventButtonText}>{ev.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {stats && (
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.total_tickets}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#10b981" }]}>{stats.checked_in}</Text>
                <Text style={styles.statLabel}>Checked In</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#f59e0b" }]}>{stats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#ef4444" }]}>{stats.cancelled}</Text>
                <Text style={styles.statLabel}>Cancelled</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#3b82f6" }]}>{stats.check_in_rate}</Text>
                <Text style={styles.statLabel}>Rate</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* QR Scanner — uses CameraView from expo-camera */}
      {scannerActive && !scanResult && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "code128", "code39"],
            }}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanHint}>Align QR code within the frame</Text>
          </View>
        </View>
      )}

      {/* Manual Entry */}
      {!scannerActive && !scanResult && (
        <View style={styles.manualEntry}>
          <Text style={styles.manualTitle}>Enter Ticket Code</Text>
          <TextInput
            style={styles.input}
            value={manualCode}
            onChangeText={(t) => setManualCode(t.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX or TKT-..."
            editable={!loading}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.validateBtn, (!manualCode.trim() || loading) && styles.disabledBtn]}
            onPress={handleManualSubmit}
            disabled={!manualCode.trim() || loading}
          >
            <Text style={styles.validateBtnText}>
              {loading ? "Validating..." : "✓ Validate Ticket"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scan Result */}
      {scanResult && (
        <View style={[styles.resultContainer, scanResult.success ? styles.success : styles.error]}>
          <Text style={styles.resultIcon}>{scanResult.success ? "✅" : "❌"}</Text>
          <Text style={styles.resultMessage}>{scanResult.message}</Text>
          {scanResult.ticket && (
            <View style={styles.ticketDetails}>
              {scanResult.ticket.attendee_name && (
                <Text style={styles.ticketDetailText}>👤 {scanResult.ticket.attendee_name}</Text>
              )}
              {scanResult.ticket.ticket_type && (
                <Text style={styles.ticketDetailText}>🎟️ {scanResult.ticket.ticket_type}</Text>
              )}
              {scanResult.ticket.event_title && (
                <Text style={styles.ticketDetailText}>🎉 {scanResult.ticket.event_title}</Text>
              )}
              {scanResult.ticket.manual_code && (
                <Text style={styles.ticketDetailText}>🔑 {scanResult.ticket.manual_code}</Text>
              )}
            </View>
          )}
          <TouchableOpacity
            style={styles.scanAgainBtn}
            onPress={() => {
              setScanResult(null);
              setManualCode("");
            }}
          >
            <Text style={styles.scanAgainText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bulk Export */}
      {bulkScanMode && scannedTickets.length > 0 && (
        <TouchableOpacity style={styles.exportBtn} onPress={exportScannedTickets}>
          <Text style={styles.exportBtnText}>
            📥 Export {scannedTickets.length} Tickets CSV
          </Text>
        </TouchableOpacity>
      )}

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Recent Scans</Text>
          {scanHistory.map((scan, idx) => (
            <View key={idx} style={styles.historyItem}>
              <Text style={styles.historyIcon}>{scan.success ? "✅" : "❌"}</Text>
              <Text style={styles.historyName}>
                {scan.ticket?.attendee_name || "Unknown"}
              </Text>
              <Text style={styles.historyTime}>{scan.timestamp}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 15, paddingBottom: 50 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15, color: "#1f2937" },

  // Permission
  permissionText: { fontSize: 15, color: "#374151", textAlign: "center", marginBottom: 16 },
  permissionBtn: { backgroundColor: "#3b82f6", padding: 12, borderRadius: 8 },
  permissionBtnText: { color: "#fff", fontWeight: "700" },

  // Mode buttons
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, gap: 8 },
  modeBtn: { flex: 1, backgroundColor: "#e5e7eb", borderRadius: 8, padding: 10, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#3b82f6" },
  modeBtnText: { fontWeight: "700", fontSize: 12, color: "#374151" },

  // Camera
  cameraContainer: { height: 320, borderRadius: 12, overflow: "hidden", marginVertical: 12, position: "relative" },
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  scanFrame: {
    width: 200, height: 200, borderWidth: 3, borderColor: "#3b82f6",
    borderRadius: 12, backgroundColor: "transparent",
  },
  scanHint: { color: "#fff", marginTop: 16, fontWeight: "600", textShadowColor: "#000", textShadowRadius: 4 },

  // Manual entry
  manualEntry: { backgroundColor: "#f3f4f6", padding: 15, borderRadius: 10, marginVertical: 10 },
  manualTitle: { fontWeight: "700", fontSize: 15, marginBottom: 8, color: "#1f2937" },
  input: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 6,
    padding: 10, marginVertical: 10, fontFamily: "monospace",
    textTransform: "uppercase", backgroundColor: "#fff", fontSize: 14,
  },
  validateBtn: { backgroundColor: "#3b82f6", borderRadius: 8, padding: 12, alignItems: "center" },
  validateBtnText: { color: "#fff", fontWeight: "700" },
  disabledBtn: { opacity: 0.5 },

  // Result
  resultContainer: { padding: 15, borderRadius: 10, marginVertical: 10 },
  success: { backgroundColor: "#d1fae5", borderColor: "#10b981", borderWidth: 1 },
  error: { backgroundColor: "#fee2e2", borderColor: "#ef4444", borderWidth: 1 },
  resultIcon: { fontSize: 50, textAlign: "center", marginBottom: 8 },
  resultMessage: { fontSize: 15, fontWeight: "600", textAlign: "center", color: "#1f2937" },
  ticketDetails: { padding: 10, marginTop: 10, backgroundColor: "#fff", borderRadius: 8 },
  ticketDetailText: { fontSize: 14, color: "#374151", marginBottom: 4 },
  scanAgainBtn: { marginTop: 12, backgroundColor: "#3b82f6", borderRadius: 8, padding: 10, alignItems: "center" },
  scanAgainText: { color: "#fff", fontWeight: "700" },

  // Stats
  statsContainer: { padding: 12, backgroundColor: "#f3f4f6", borderRadius: 10, marginVertical: 10 },
  statsTitle: { fontWeight: "700", fontSize: 15, marginBottom: 8, color: "#1f2937" },
  eventButton: { padding: 8, marginHorizontal: 5, backgroundColor: "#e5e7eb", borderRadius: 8 },
  eventButtonActive: { backgroundColor: "#3b82f6" },
  eventButtonText: { fontSize: 13, color: "#374151" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  statItem: { backgroundColor: "#fff", borderRadius: 8, padding: 10, alignItems: "center", minWidth: 60 },
  statValue: { fontSize: 18, fontWeight: "700", color: "#1f2937" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },

  // Export
  exportBtn: { backgroundColor: "#10b981", borderRadius: 8, padding: 12, alignItems: "center", marginVertical: 8 },
  exportBtnText: { color: "#fff", fontWeight: "700" },

  // History
  historyContainer: { marginTop: 16 },
  historyTitle: { fontWeight: "700", fontSize: 15, marginBottom: 8, color: "#1f2937" },
  historyItem: {
    flexDirection: "row", alignItems: "center", paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  historyIcon: { fontSize: 16, marginRight: 8 },
  historyName: { flex: 1, fontSize: 13, color: "#374151" },
  historyTime: { fontSize: 11, color: "#9ca3af" },
});

export default TicketScanner;