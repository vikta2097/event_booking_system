// TicketScanner.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, ScrollView,
  StyleSheet, TouchableOpacity
} from "react-native";
import { useAudioPlayer } from 'expo-audio';
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
  const [scanHistory, setScanHistory] = useState([]);

  const [permission, requestPermission] = useCameraPermissions();

  const isProcessing = useRef(false);
  const lastScanned = useRef(null);

  const audioSuccess = useRef(null);
  const audioError = useRef(null);

  // 🔊 Load sounds
  useEffect(() => {
    const loadSounds = async () => {
      audioSuccess.current = new Audio.Sound();
      audioError.current = new Audio.Sound();
      await audioSuccess.current.loadAsync(require("../assets/success.mp3"));
      await audioError.current.loadAsync(require("../assets/error.mp3"));
    };

    loadSounds();
    return () => {
      audioSuccess.current?.unloadAsync();
      audioError.current?.unloadAsync();
    };
  }, []);

  // 📷 Request permission
  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  // 🔊 Play sound
  const playSound = async (type) => {
    try {
      if (type === "success") await audioSuccess.current?.replayAsync();
      else await audioError.current?.replayAsync();
    } catch {}
  };

  // 🎫 Validate ticket
  const validateTicket = useCallback(async (code, isManual = false) => {
    if (isProcessing.current) return;

    isProcessing.current = true;
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem("token");

      const payload =
        isManual || (code.includes("-") && code.length < 20)
          ? { manual_code: code }
          : { qr_code: code };

      const res = await api.post("/tickets/validate", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = {
        success: res.data.valid,
        message: res.data.message,
        ticket: res.data.ticket,
        timestamp: new Date().toLocaleTimeString(),
      };

      setScanResult(result);
      setScanHistory((prev) => [result, ...prev.slice(0, 9)]);

      if (bulkScanMode && result.success) {
        setScannedTickets((prev) => [...prev, result.ticket]);
      }

      await playSound(result.success ? "success" : "error");

    } catch (err) {
      const result = {
        success: false,
        message: "Validation failed",
        timestamp: new Date().toLocaleTimeString(),
      };

      setScanResult(result);
      setScanHistory((prev) => [result, ...prev.slice(0, 9)]);
      await playSound("error");
    } finally {
      setLoading(false);
      isProcessing.current = false;
    }
  }, [bulkScanMode]);

  // 📷 Scan handler (FIXED)
  const handleBarcodeScanned = ({ data }) => {
    if (!data) return;

    // prevent duplicate scans
    if (lastScanned.current === data) return;

    lastScanned.current = data;

    validateTicket(data);

    // cooldown
    setTimeout(() => {
      lastScanned.current = null;
    }, 1500);
  };

  // 📝 Manual submit
  const handleManualSubmit = () => {
    if (!manualCode.trim()) return;

    const cleaned = manualCode.replace(/[\s-]/g, "").toUpperCase();
    validateTicket(cleaned, true);
  };

  // 📁 Export CSV
  const exportScannedTickets = async () => {
    if (!scannedTickets.length) return;

    const csv = [
      ["Ticket ID", "Attendee", "Type"],
      ...scannedTickets.map((t) => [
        t.id,
        t.attendee_name,
        t.ticket_type,
      ]),
    ].map(r => r.join(",")).join("\n");

    const fileUri = FileSystem.cacheDirectory + "tickets.csv";
    await FileSystem.writeAsStringAsync(fileUri, csv);
    await Sharing.shareAsync(fileUri);
  };

  // ❌ Permission states
  if (!permission) {
    return <Text>Requesting permission...</Text>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text>Camera permission required</Text>
        <TouchableOpacity onPress={requestPermission}>
          <Text>Grant</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 🎯 UI
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🎫 Ticket Scanner</Text>

      {/* Camera */}
      {scannerActive && (
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "code128"],
            }}
          />
        </View>
      )}

      {/* Manual */}
      {!scannerActive && (
        <>
          <TextInput
            style={styles.input}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Enter code"
          />
          <TouchableOpacity style={styles.btn} onPress={handleManualSubmit}>
            <Text style={styles.btnText}>Validate</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Result */}
      {scanResult && (
        <View style={styles.result}>
          <Text>{scanResult.success ? "✅" : "❌"}</Text>
          <Text>{scanResult.message}</Text>
        </View>
      )}

      {/* Export */}
      {bulkScanMode && (
        <TouchableOpacity style={styles.exportBtn} onPress={exportScannedTickets}>
          <Text style={styles.btnText}>Export CSV</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: "bold" },
  cameraContainer: { height: 300, marginVertical: 10 },
  input: { borderWidth: 1, padding: 10, marginVertical: 10 },
  btn: { backgroundColor: "#3b82f6", padding: 10 },
  btnText: { color: "#fff", textAlign: "center" },
  result: { marginTop: 10 },
  exportBtn: { backgroundColor: "green", padding: 10 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
});

export default TicketScanner;