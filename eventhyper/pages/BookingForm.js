/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, StyleSheet, Alert
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import api from "../api";

const BookingForm = ({ user }) => {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params;

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState({});
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const fetchEventAndTickets = useCallback(async () => {
    try {
      setStatusMessage("Loading event details...");
      const [eventRes, ticketsRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/ticket-types`),
      ]);
      setEvent(eventRes.data);
      const ticketArray = ticketsRes.data.ticket_types || ticketsRes.data || [];
      const normalizedTickets = ticketArray.map((ticket) => {
        const quantity_available = parseInt(ticket.quantity_available || 0);
        const quantity_sold = parseInt(ticket.quantity_sold || 0);
        const tickets_remaining = Math.max(0, quantity_available - quantity_sold);
        return {
          id: ticket.id,
          name: ticket.name,
          price: parseFloat(ticket.price || 0),
          quantity_available,
          quantity_sold,
          tickets_remaining,
          description: ticket.description || "",
        };
      });
      setTickets(normalizedTickets);
      const initialSelection = {};
      normalizedTickets.forEach((t) => { initialSelection[t.id] = 0; });
      setSelectedTickets(initialSelection);
      setStatusMessage("");
      setError("");
    } catch (err) {
      if (err.code === "ERR_NETWORK") {
        setError("Cannot connect to server. Please wait and try again.");
      } else {
        setError(err.response?.data?.error || "Failed to load event or tickets");
      }
    }
  }, [id]);

  useEffect(() => { fetchEventAndTickets(); }, [fetchEventAndTickets]);
  useEffect(() => { if (user?.phone) setPhoneNumber(user.phone); }, [user]);

  const handleQuantityChange = (ticketId, qty) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    const quantity = Math.max(0, Math.min(qty, ticket.tickets_remaining));
    setSelectedTickets((prev) => ({ ...prev, [ticketId]: quantity }));
  };

  const totalAmount = tickets.reduce(
    (sum, t) => sum + t.price * (selectedTickets[t.id] || 0), 0
  );
  const totalTickets = Object.values(selectedTickets).reduce((sum, q) => sum + q, 0);

  const handleBooking = async () => {
    if (!user) {
      setError("Please log in to complete booking");
      navigation.navigate("Login");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Phone number is required for M-Pesa payment");
      return;
    }
    const phoneRegex = /^(?:\+254|254|0)7\d{8}$/;
    const cleanPhone = phoneNumber.replace(/[\s\-()]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Kenyan mobile number (e.g., 0712345678)");
      return;
    }
    if (totalTickets === 0) {
      setError("Please select at least one ticket");
      return;
    }
    setLoading(true);
    setError("");
    setStatusMessage("Connecting to server...");
    try {
      try {
        await api.get("/events", { timeout: 5000 });
        setStatusMessage("Creating your booking...");
      } catch {
        setStatusMessage("Server is waking up...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        setStatusMessage("Creating your booking...");
      }
      const payload = tickets
        .filter((t) => selectedTickets[t.id] > 0)
        .map((t) => ({ ticket_type_id: t.id, quantity: selectedTickets[t.id] }));
      const res = await api.post("/bookings", { event_id: id, tickets: payload });
      if (!res.data.booking_id) throw new Error("Invalid response: No booking_id received");
      navigation.navigate("Payment", { bookingId: res.data.booking_id });
    } catch (err) {
      if (err.code === "ERR_NETWORK" || err.message === "Network Error") {
        setError("Cannot connect to server. Please wait 30 seconds and try again.");
      } else if (err.response?.status === 400) {
        setError(err.response.data.error || "Invalid booking data.");
      } else if (err.response?.status === 404) {
        setError("Event not found. It may have been deleted.");
      } else if (err.response?.status === 401) {
        setError("Session expired. Please log in again.");
        setTimeout(() => navigation.navigate("Login"), 2000);
      } else {
        setError(err.response?.data?.error || err.message || "Booking failed. Please try again.");
      }
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  if (!event && !error) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>{statusMessage || "Loading booking details..."}</Text>
      </View>
    );
  }

  if (error && !event) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchEventAndTickets}>
          <Text style={styles.retryBtnText}>🔄 Retry Loading</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.heading}>Book Tickets for {event?.title}</Text>
      {event?.event_date && (
        <Text style={styles.eventDate}>
          {new Date(event.event_date).toLocaleDateString("en-GB", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </Text>
      )}
      <Text style={styles.eventLocation}>📍 {event?.location || "Location not specified"}</Text>

      <View style={styles.ticketSection}>
        <Text style={styles.sectionTitle}>Select Tickets</Text>
        {tickets.length > 0 ? (
          tickets.map((ticket) => {
            const available = ticket.tickets_remaining;
            const isAvailable = available > 0;
            return (
              <View key={ticket.id} style={[styles.ticketItem, !isAvailable && styles.soldOutTicket]}>
                <View style={styles.ticketInfoRow}>
                  <Text style={styles.ticketName}>{ticket.name}</Text>
                  <Text style={styles.ticketPrice}>KES {ticket.price.toLocaleString()}</Text>
                </View>
                {ticket.description ? <Text style={styles.ticketDescription}>{ticket.description}</Text> : null}
                <Text style={isAvailable ? styles.availableText : styles.soldOutText}>
                  {isAvailable ? `✓ ${available} available` : "✗ Sold Out"}
                </Text>
                {isAvailable && (
                  <>
                    <View style={styles.ticketControls}>
                      <TouchableOpacity
                        style={styles.controlBtn}
                        onPress={() => handleQuantityChange(ticket.id, selectedTickets[ticket.id] - 1)}
                        disabled={selectedTickets[ticket.id] === 0}
                      >
                        <Text style={styles.controlBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.quantityText}>{selectedTickets[ticket.id] || 0}</Text>
                      <TouchableOpacity
                        style={styles.controlBtn}
                        onPress={() => handleQuantityChange(ticket.id, selectedTickets[ticket.id] + 1)}
                        disabled={selectedTickets[ticket.id] >= available}
                      >
                        <Text style={styles.controlBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {selectedTickets[ticket.id] > 0 && (
                      <Text style={styles.subtotal}>
                        Subtotal: <Text style={styles.subtotalAmount}>KES {(ticket.price * selectedTickets[ticket.id]).toLocaleString()}</Text>
                      </Text>
                    )}
                  </>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.noTickets}>No tickets available for this event.</Text>
        )}
      </View>

      <View style={styles.checkoutSection}>
        <Text style={styles.label}>M-Pesa Phone Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="0712345678 or 254712345678"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          editable={!loading}
        />
        <Text style={styles.hint}>Enter the phone number to receive M-Pesa payment prompt</Text>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Total Tickets:</Text>
            <Text style={styles.summaryValue}>{totalTickets}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Amount:</Text>
            <Text style={styles.totalValue}>KES {totalAmount.toLocaleString()}</Text>
          </View>
        </View>

        {!!statusMessage && <Text style={styles.statusMessage}>ℹ️ {statusMessage}</Text>}
        {!!error && <Text style={styles.errorMessage}>⚠️ {error}</Text>}

        <TouchableOpacity
          style={[styles.proceedBtn, (loading || totalTickets === 0) && styles.disabledBtn]}
          onPress={handleBooking}
          disabled={loading || totalTickets === 0}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.proceedBtnText}>Proceed to Payment →</Text>
          )}
        </TouchableOpacity>
        {totalTickets === 0 && (
          <Text style={styles.hintText}>Please select at least one ticket to continue</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f9fc" },
  contentContainer: { maxWidth: 500, alignSelf: "center", width: "100%", padding: 20 },
  heading: { fontSize: 20, fontWeight: "700", color: "#0077ff", marginBottom: 12, textAlign: "center" },
  eventDate: { color: "#555", textAlign: "center", marginBottom: 4 },
  eventLocation: { color: "#555", textAlign: "center", marginBottom: 16 },
  loadingText: { padding: 20, fontStyle: "italic", color: "#777", textAlign: "center" },
  error: { color: "red", textAlign: "center", marginBottom: 12 },
  retryBtn: { backgroundColor: "#0077ff", padding: 12, borderRadius: 8, marginBottom: 8, alignItems: "center" },
  retryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: { backgroundColor: "#ddd", padding: 12, borderRadius: 8, alignItems: "center" },
  secondaryBtnText: { color: "#333" },
  ticketSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  ticketItem: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  soldOutTicket: { opacity: 0.6 },
  ticketInfoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  ticketName: { fontWeight: "700", fontSize: 15, color: "#222" },
  ticketPrice: { fontWeight: "700", color: "#0077ff" },
  ticketDescription: { color: "#666", fontSize: 13, marginBottom: 6 },
  availableText: { color: "#27ae60", fontSize: 13, marginBottom: 8 },
  soldOutText: { color: "#e74c3c", fontSize: 13 },
  ticketControls: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  controlBtn: { width: 36, height: 36, backgroundColor: "#0077ff", borderRadius: 18, alignItems: "center", justifyContent: "center" },
  controlBtnText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 22 },
  quantityText: { fontSize: 16, fontWeight: "700", minWidth: 32, textAlign: "center" },
  subtotal: { color: "#555", fontSize: 13 },
  subtotalAmount: { fontWeight: "700" },
  noTickets: { color: "#999", fontStyle: "italic" },
  checkoutSection: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginBottom: 20 },
  label: { fontWeight: "700", marginBottom: 6, fontSize: 15 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, fontSize: 15, marginBottom: 4 },
  hint: { color: "#888", fontSize: 12, marginBottom: 12 },
  summary: { borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 12, marginTop: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  summaryValue: { fontWeight: "700" },
  totalLabel: { fontWeight: "700", fontSize: 16 },
  totalValue: { fontWeight: "700", fontSize: 16, color: "#0077ff" },
  statusMessage: { color: "#555", fontSize: 13, marginVertical: 8 },
  errorMessage: { color: "#c33", fontSize: 13, marginVertical: 8 },
  proceedBtn: { backgroundColor: "#0077ff", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 12 },
  disabledBtn: { backgroundColor: "#999" },
  proceedBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hintText: { color: "#888", fontSize: 13, textAlign: "center", marginTop: 8 },
});

export default BookingForm;
