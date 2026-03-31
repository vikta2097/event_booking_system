// TicketScanner.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  View, Text, Button, TextInput, ScrollView, StyleSheet, TouchableOpacity 
} from "react-native";
import { Audio } from "expo-av";
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
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
  const [hasPermission, setHasPermission] = useState(null);

  const isProcessing = useRef(false);
  const audioSuccess = useRef(null);
  const audioError = useRef(null);

  // Load audio
  useEffect(() => {
    const loadSounds = async () => {
      audioSuccess.current = new Audio.Sound();
      audioError.current = new Audio.Sound();
      await audioSuccess.current.loadAsync(require('../assets/success.mp3'));
      await audioError.current.loadAsync(require('../assets/error.mp3'));
    };
    loadSounds();
  }, []);

  // Request camera permission
  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get("/events/organizer/my-events", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        setEvents(res.data || []);
      } catch (err) {
        console.log(err);
      }
    };
    fetchEvents();
  }, []);

  // Fetch event stats
  const fetchEventStats = useCallback(async (eventId) => {
    try {
      const res = await api.get(`/tickets/event/${eventId}/stats`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
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

  const validateTicket = useCallback(async (code, isManual = false) => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    setLoading(true);
    setScanResult(null);

    try {
      const payload = (isManual || (code.includes('-') && code.length < 20))
        ? { manual_code: code }
        : { qr_code: code };

      const response = await api.post("/tickets/validate", payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });

      const result = {
        success: response.data.valid,
        message: response.data.message,
        ticket: response.data.ticket,
        timestamp: new Date().toLocaleTimeString()
      };

      setScanResult(result);
      setScanHistory(prev => [result, ...prev.slice(0, 9)]);
      if (bulkScanMode && result.success) {
        setScannedTickets(prev => [...prev, result.ticket]);
      }

      playSound(result.success ? "success" : "error");

      if (selectedEvent) fetchEventStats(selectedEvent);

    } catch (err) {
      const errorData = err.response?.data;
      const result = {
        success: false,
        message: errorData?.message || "Validation failed",
        ticket: errorData?.ticket || null,
        timestamp: new Date().toLocaleTimeString()
      };
      setScanResult(result);
      setScanHistory(prev => [result, ...prev.slice(0, 9)]);
      playSound("error");
    } finally {
      setLoading(false);
      isProcessing.current = false;

      // Auto-clear result in bulk mode
      if (bulkScanMode) {
        setTimeout(() => setScanResult(null), 1500);
      }
    }
  }, [bulkScanMode, selectedEvent, fetchEventStats, playSound]);

  const handleManualSubmit = () => {
    if (manualCode.trim() && !loading) {
      const cleanedCode = manualCode.trim().replace(/[\s-]/g, '').toUpperCase();
      validateTicket(cleanedCode, true);
    }
  };

  const exportScannedTickets = async () => {
    if (scannedTickets.length === 0) return;
    const csv = [
      ["Ticket ID", "Attendee", "Ticket Type", "Event", "Scanned At"],
      ...scannedTickets.map(t => [
        t.id, t.attendee_name, t.ticket_type, t.event_title, t.validated_at
      ])
    ].map(r => r.join(",")).join("\n");

    const fileUri = FileSystem.cacheDirectory + `scanned-tickets-${Date.now()}.csv`;
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri);
  };

  if (hasPermission === null) return <Text>Requesting camera permission...</Text>;
  if (hasPermission === false) return <Text>No access to camera</Text>;

  // Handle scanning event
  const handleBarCodeScanned = ({ data }) => {
    if (!bulkScanMode || !scanResult) {
      validateTicket(data);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🎫 Ticket Validation</Text>

      {/* Mode Buttons */}
      <View style={styles.buttonRow}>
        <Button title={bulkScanMode ? "⚡ Bulk Mode ON" : "⚡ Bulk Mode OFF"} onPress={() => {
          setBulkScanMode(!bulkScanMode);
          setScannedTickets([]);
          setScanResult(null);
        }} />
        <Button title={scannerActive ? "📝 Manual Entry" : "📷 Camera Scanner"} onPress={() => {
          setScannerActive(!scannerActive);
          setScanResult(null);
        }} />
        <Button title={showStats ? "📊 Hide Stats" : "📊 Show Stats"} onPress={() => setShowStats(!showStats)} />
      </View>

      {/* Stats */}
      {showStats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Event Stats</Text>
          <ScrollView horizontal>
            {events.map(ev => (
              <TouchableOpacity key={ev.id} onPress={() => setSelectedEvent(ev.id)} style={styles.eventButton}>
                <Text>{ev.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {stats && (
            <View>
              <Text>Total Tickets: {stats.total_tickets}</Text>
              <Text>Checked In: {stats.checked_in}</Text>
              <Text>Pending: {stats.pending}</Text>
              <Text>Cancelled: {stats.cancelled}</Text>
              <Text>Check-in Rate: {stats.check_in_rate}</Text>
            </View>
          )}
        </View>
      )}

      {/* QR Scanner */}
      {scannerActive && !scanResult && (
        <View style={{ height: 300 }}>
          <BarCodeScanner
            onBarCodeScanned={handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      )}

      {/* Manual Entry */}
      {!scannerActive && !scanResult && (
        <View style={styles.manualEntry}>
          <Text>Enter Ticket Code</Text>
          <TextInput
            style={styles.input}
            value={manualCode}
            onChangeText={t => setManualCode(t.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX or TKT-..."
            editable={!loading}
          />
          <Button title="✓ Validate Ticket" onPress={handleManualSubmit} disabled={!manualCode.trim() || loading} />
        </View>
      )}

      {/* Scan Result */}
      {scanResult && (
        <View style={[styles.resultContainer, scanResult.success ? styles.success : styles.error]}>
          <Text style={styles.resultIcon}>{scanResult.success ? "✅" : "❌"}</Text>
          <Text>{scanResult.message}</Text>
          {scanResult.ticket && (
            <View style={styles.ticketDetails}>
              {scanResult.ticket.attendee_name && <Text>👤 {scanResult.ticket.attendee_name}</Text>}
              {scanResult.ticket.ticket_type && <Text>🎟️ {scanResult.ticket.ticket_type}</Text>}
              {scanResult.ticket.event_title && <Text>🎉 {scanResult.ticket.event_title}</Text>}
              {scanResult.ticket.manual_code && <Text>🔑 {scanResult.ticket.manual_code}</Text>}
            </View>
          )}
        </View>
      )}

      {/* Bulk Export */}
      {bulkScanMode && scannedTickets.length > 0 && (
        <Button title="📥 Export CSV" onPress={exportScannedTickets} />
      )}

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <View>
          <Text>Recent Scans</Text>
          {scanHistory.map((scan, idx) => (
            <View key={idx}>
              <Text>{scan.success ? '✅' : '❌'} {scan.ticket?.attendee_name || 'Unknown'} - {scan.timestamp}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 15, paddingBottom: 50 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap" },
  manualEntry: { backgroundColor: "#f0f0f0", padding: 15, borderRadius: 10, marginVertical: 10 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10, marginVertical: 10, fontFamily: 'Courier', textTransform: 'uppercase' },
  resultContainer: { padding: 15, borderRadius: 10, marginVertical: 10 },
  success: { backgroundColor: "#d4edda", borderColor: "#28a745", borderWidth: 1 },
  error: { backgroundColor: "#f8d7da", borderColor: "#dc3545", borderWidth: 1 },
  resultIcon: { fontSize: 50, textAlign: "center" },
  ticketDetails: { padding: 10, marginTop: 10, backgroundColor: "#fff", borderRadius: 8 },
  statsContainer: { padding: 10, backgroundColor: "#eee", borderRadius: 8, marginVertical: 10 },
  statsTitle: { fontWeight: "bold", marginBottom: 5 },
  eventButton: { padding: 8, marginHorizontal: 5, backgroundColor: "#ddd", borderRadius: 6 }
});

export default TicketScanner;