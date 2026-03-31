import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, StyleSheet, Switch, Alert, ActivityIndicator
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const TicketManagement = ({ event, isOpen, onClose }) => {
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [editingTicket, setEditingTicket] = useState(null);
  const [ticketForm, setTicketForm] = useState({
    name: "", description: "", price: "", quantity_available: "",
    is_early_bird: false, early_bird_deadline: "",
    is_group_discount: false, group_size: "", group_discount_percent: "",
  });

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchTicketTypes = async () => {
    if (!event?.id) return;
    try {
      setTicketLoading(true);
      setTicketError("");
      const headers = await getAuthHeaders();
      const res = await api.get(`/events/${event.id}/ticket-types`, { headers });
      const list = res.data?.ticket_types;
      setTicketTypes(Array.isArray(list) ? list : []);
      if (!Array.isArray(list)) setTicketError("Unexpected response from server.");
    } catch {
      setTicketTypes([]);
      setTicketError("Failed to load tickets.");
    } finally {
      setTicketLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && event) fetchTicketTypes();
  }, [isOpen, event]);

  const setFormField = (name, value) => setTicketForm((prev) => ({ ...prev, [name]: value }));

  const handleTicketSubmit = async () => {
    if (!event) return;
    try {
      const headers = await getAuthHeaders();
      const payload = {
        ...ticketForm,
        price: Number(ticketForm.price),
        quantity_available: Number(ticketForm.quantity_available),
        group_size: ticketForm.is_group_discount ? Number(ticketForm.group_size) : null,
        group_discount_percent: ticketForm.is_group_discount ? Number(ticketForm.group_discount_percent) : null,
        early_bird_deadline: ticketForm.is_early_bird ? ticketForm.early_bird_deadline : null,
      };
      if (editingTicket) {
        await api.put(`/ticket-types/${editingTicket.id}`, payload, { headers });
      } else {
        await api.post(`/events/${event.id}/ticket-types`, payload, { headers });
      }
      await fetchTicketTypes();
      resetForm();
    } catch {
      setTicketError("Failed to save ticket");
    }
  };

  const handleTicketDelete = (ticketId) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this ticket?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            await api.delete(`/ticket-types/${ticketId}`, { headers });
            await fetchTicketTypes();
          } catch {
            setTicketError("Failed to delete ticket");
          }
        }
      }
    ]);
  };

  const resetForm = () => {
    setEditingTicket(null);
    setTicketForm({
      name: "", description: "", price: "", quantity_available: "",
      is_early_bird: false, early_bird_deadline: "",
      is_group_discount: false, group_size: "", group_discount_percent: "",
    });
  };

  const handleEdit = (ticket) => {
    setEditingTicket(ticket);
    setTicketForm({
      name: ticket.name,
      description: ticket.description || "",
      price: String(ticket.price),
      quantity_available: String(ticket.quantity_available),
      is_early_bird: ticket.is_early_bird || false,
      early_bird_deadline: ticket.early_bird_deadline || "",
      is_group_discount: ticket.is_group_discount || false,
      group_size: String(ticket.group_size || ""),
      group_discount_percent: String(ticket.group_discount_percent || ""),
    });
  };

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🎫 Manage Tickets: {event?.title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Ticket List */}
          {ticketLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginVertical: 20 }} />
          ) : ticketError ? (
            <Text style={styles.errorText}>{ticketError}</Text>
          ) : ticketTypes.length === 0 ? (
            <Text style={styles.emptyText}>No ticket types yet. Create one below.</Text>
          ) : (
            <View style={styles.ticketList}>
              {ticketTypes.map((ticket) => (
                <View key={ticket.id} style={styles.ticketCard}>
                  <View style={styles.ticketCardHeader}>
                    <View style={styles.ticketCardLeft}>
                      <Text style={styles.ticketCardName}>{ticket.name}</Text>
                      <View style={styles.ticketBadges}>
                        {ticket.is_early_bird && <View style={styles.earlyBirdBadge}><Text style={styles.badgeText}>Early Bird</Text></View>}
                        {ticket.is_group_discount && <View style={styles.groupBadge}><Text style={styles.badgeText}>Group Discount</Text></View>}
                      </View>
                    </View>
                    <View style={styles.ticketActions}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(ticket)}>
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleTicketDelete(ticket.id)}>
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {ticket.description ? <Text style={styles.ticketDesc}>{ticket.description}</Text> : null}
                  <View style={styles.ticketMeta}>
                    <Text style={styles.ticketMetaText}>KES {Number(ticket.price).toLocaleString()}</Text>
                    <Text style={styles.ticketMetaText}>Available: {ticket.quantity_available}</Text>
                    <Text style={styles.ticketMetaText}>Sold: {ticket.quantity_sold || 0}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {editingTicket ? "✏️ Edit Ticket Type" : "➕ Add New Ticket Type"}
            </Text>

            <Text style={styles.label}>Ticket Name *</Text>
            <TextInput style={styles.input} placeholder="e.g., VIP, General Admission" value={ticketForm.name} onChangeText={(v) => setFormField("name", v)} />

            <Text style={styles.label}>Price (KES) *</Text>
            <TextInput style={styles.input} placeholder="0.00" value={ticketForm.price} onChangeText={(v) => setFormField("price", v)} keyboardType="decimal-pad" />

            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} placeholder="Optional ticket description" value={ticketForm.description} onChangeText={(v) => setFormField("description", v)} />

            <Text style={styles.label}>Quantity Available *</Text>
            <TextInput style={styles.input} placeholder="Number of tickets" value={ticketForm.quantity_available} onChangeText={(v) => setFormField("quantity_available", v)} keyboardType="number-pad" />

            {/* Early Bird */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Early Bird Pricing</Text>
              <Switch value={ticketForm.is_early_bird} onValueChange={(v) => setFormField("is_early_bird", v)} />
            </View>
            {ticketForm.is_early_bird && (
              <>
                <Text style={styles.label}>Early Bird Deadline (YYYY-MM-DD)</Text>
                <TextInput style={styles.input} placeholder="e.g., 2025-12-31" value={ticketForm.early_bird_deadline} onChangeText={(v) => setFormField("early_bird_deadline", v)} />
              </>
            )}

            {/* Group Discount */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Group Discount</Text>
              <Switch value={ticketForm.is_group_discount} onValueChange={(v) => setFormField("is_group_discount", v)} />
            </View>
            {ticketForm.is_group_discount && (
              <>
                <Text style={styles.label}>Min Group Size</Text>
                <TextInput style={styles.input} placeholder="e.g., 5" value={ticketForm.group_size} onChangeText={(v) => setFormField("group_size", v)} keyboardType="number-pad" />
                <Text style={styles.label}>Discount %</Text>
                <TextInput style={styles.input} placeholder="e.g., 10" value={ticketForm.group_discount_percent} onChangeText={(v) => setFormField("group_discount_percent", v)} keyboardType="number-pad" />
              </>
            )}

            {!!ticketError && <Text style={styles.errorText}>{ticketError}</Text>}

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleTicketSubmit}>
                <Text style={styles.primaryBtnText}>{editingTicket ? "Update Ticket" : "Add Ticket"}</Text>
              </TouchableOpacity>
              {editingTicket && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={resetForm}>
                  <Text style={styles.secondaryBtnText}>Cancel Edit</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                <Text style={styles.secondaryBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1f2937", flex: 1 },
  closeBtn: { padding: 6 },
  closeBtnText: { fontSize: 20, color: "#6b7280", fontWeight: "700" },
  content: { padding: 16, paddingBottom: 40 },
  errorText: { color: "#ef4444", fontSize: 13, marginBottom: 8, textAlign: "center" },
  emptyText: { textAlign: "center", color: "#9ca3af", padding: 24, fontStyle: "italic" },
  ticketList: { marginBottom: 20 },
  ticketCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  ticketCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  ticketCardLeft: { flex: 1 },
  ticketCardName: { fontWeight: "700", fontSize: 15, color: "#1f2937" },
  ticketBadges: { flexDirection: "row", gap: 6, marginTop: 4 },
  earlyBirdBadge: { backgroundColor: "#fef3c7", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  groupBadge: { backgroundColor: "#dbeafe", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  ticketActions: { flexDirection: "row", gap: 8 },
  editBtn: { backgroundColor: "#3b82f6", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  deleteBtn: { backgroundColor: "#ef4444", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  ticketDesc: { color: "#6b7280", fontSize: 13, marginBottom: 6 },
  ticketMeta: { flexDirection: "row", gap: 16 },
  ticketMetaText: { color: "#374151", fontSize: 13, fontWeight: "500" },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  formTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 14 },
  label: { color: "#374151", fontWeight: "600", fontSize: 14, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12, color: "#1f2937" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  switchLabel: { fontWeight: "600", color: "#374151", fontSize: 14 },
  formActions: { gap: 10, marginTop: 8 },
  primaryBtn: { backgroundColor: "#3b82f6", borderRadius: 8, padding: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: { backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 14, alignItems: "center" },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },
});

export default TicketManagement;
