import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import api from "../api";

const Support = ({ currentUser }) => {
  const [tickets, setTickets] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTicket, setNewTicket] = useState({ subject: "", message: "", priority: "low" });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [activeTab, setActiveTab] = useState("tickets");
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    fetchTickets();
    if (currentUser.role === "admin") fetchContacts();
  }, [currentUser]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get("/support/ticket");
      setTickets(res.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get("/support/contact");
      setContacts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (name, value) => {
    setNewTicket((prev) => ({ ...prev, [name]: value }));
  };

  const submitTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      Alert.alert("Error", "Subject and message are required");
      return;
    }
    try {
      await api.post("/support/ticket", newTicket);
      Alert.alert("Success", "Ticket submitted successfully");
      setNewTicket({ subject: "", message: "", priority: "low" });
      fetchTickets();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Failed to create ticket");
    }
  };

  const viewTicket = async (ticketId) => {
    try {
      const res = await api.get(`/support/ticket/${ticketId}`);
      setSelectedTicket(res.data);
      setShowTicketModal(true);
    } catch (err) {
      Alert.alert("Error", "Failed to load ticket details");
    }
  };

  const submitReply = async () => {
    if (!replyMessage.trim()) {
      Alert.alert("Error", "Reply message cannot be empty");
      return;
    }
    try {
      await api.post(`/support/ticket/${selectedTicket.id}/reply`, { message: replyMessage });
      Alert.alert("Success", "Reply sent successfully");
      setReplyMessage("");
      viewTicket(selectedTicket.id);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Failed to send reply");
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      await api.put(`/support/ticket/${ticketId}/status`, { status: newStatus });
      Alert.alert("Success", "Status updated successfully");
      fetchTickets();
      if (selectedTicket?.id === ticketId) viewTicket(ticketId);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Failed to update status");
    }
  };

  const deleteTicket = async (ticketId) => {
    Alert.alert("Confirm", "Are you sure you want to delete this ticket?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/support/ticket/${ticketId}`);
            Alert.alert("Success", "Ticket deleted successfully");
            fetchTickets();
            if (selectedTicket?.id === ticketId) {
              setSelectedTicket(null);
              setShowTicketModal(false);
            }
          } catch (err) {
            Alert.alert("Error", err.response?.data?.error || "Failed to delete ticket");
          }
        },
      },
    ]);
  };

  const viewContact = (contact) => {
    setSelectedContact(contact);
    setShowContactModal(true);
  };

  const updateContactStatus = async (contactId, newStatus) => {
    try {
      await api.put(`/support/contact/${contactId}/status`, { status: newStatus });
      Alert.alert("Success", "Status updated successfully");
      fetchContacts();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Failed to update status");
    }
  };

  const deleteContact = async (contactId) => {
    Alert.alert("Confirm", "Are you sure you want to delete this message?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/support/contact/${contactId}`);
            Alert.alert("Success", "Message deleted successfully");
            fetchContacts();
            setShowContactModal(false);
          } catch (err) {
            Alert.alert("Error", err.response?.data?.error || "Failed to delete message");
          }
        },
      },
    ]);
  };

  const STATUS_COLORS = {
    open: "#3498db",
    in_progress: "#f39c12",
    resolved: "#2ecc71",
    closed: "#95a5a6",
    new: "#8e44ad",
  };

  const PRIORITY_COLORS = {
    low: "#2ecc71",
    medium: "#f39c12",
    high: "#e74c3c",
  };

  const StatusBadge = ({ status }) => (
    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] || "#95a5a6" }]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  );

  const PriorityBadge = ({ priority }) => (
    <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[priority] || "#95a5a6" }]}>
      <Text style={styles.badgeText}>{priority}</Text>
    </View>
  );

  const PriorityPicker = ({ value, onChange }) => (
    <View style={styles.pickerRow}>
      {["low", "medium", "high"].map((p) => (
        <TouchableOpacity
          key={p}
          style={[styles.pickerOption, value === p && { backgroundColor: PRIORITY_COLORS[p] }]}
          onPress={() => onChange(p)}
        >
          <Text style={[styles.pickerOptionText, value === p && { color: "#fff" }]}>{p}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const StatusPicker = ({ value, onChange, options }) => (
    <View style={styles.pickerRow}>
      {options.map((s) => (
        <TouchableOpacity
          key={s}
          style={[styles.pickerOption, value === s && { backgroundColor: STATUS_COLORS[s] }]}
          onPress={() => onChange(s)}
        >
          <Text style={[styles.pickerOptionText, value === s && { color: "#fff" }]}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!currentUser) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading user...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Support Dashboard</Text>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "tickets" && styles.tabActive]}
          onPress={() => setActiveTab("tickets")}
        >
          <Text style={[styles.tabText, activeTab === "tickets" && styles.tabTextActive]}>
            Support Tickets
          </Text>
        </TouchableOpacity>
        {currentUser.role === "admin" && (
          <TouchableOpacity
            style={[styles.tab, activeTab === "contacts" && styles.tabActive]}
            onPress={() => setActiveTab("contacts")}
          >
            <Text style={[styles.tabText, activeTab === "contacts" && styles.tabTextActive]}>
              Contact Messages
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* ── TICKETS TAB ── */}
        {activeTab === "tickets" && (
          <>
            {/* New Ticket Form */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Submit a Support Ticket</Text>
              <TextInput
                style={styles.input}
                placeholder="Subject"
                value={newTicket.subject}
                onChangeText={(v) => handleChange("subject", v)}
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your issue..."
                value={newTicket.message}
                onChangeText={(v) => handleChange("message", v)}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.fieldLabel}>Priority</Text>
              <PriorityPicker
                value={newTicket.priority}
                onChange={(v) => handleChange("priority", v)}
              />
              <TouchableOpacity style={styles.btnSubmit} onPress={submitTicket}>
                <Text style={styles.btnSubmitText}>Submit Ticket</Text>
              </TouchableOpacity>
            </View>

            {/* Tickets List */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>My Tickets</Text>
              {loading ? (
                <ActivityIndicator size="small" color="#3498db" />
              ) : error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : tickets.length === 0 ? (
                <Text style={styles.noDataText}>No tickets found</Text>
              ) : (
                tickets.map((ticket) => (
                  <View key={ticket.id} style={styles.ticketRow}>
                    <View style={styles.ticketInfo}>
                      <Text style={styles.ticketSubject} numberOfLines={1}>
                        {ticket.subject}
                      </Text>
                      <Text style={styles.ticketMeta}>
                        {ticket.user_name || "N/A"} •{" "}
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </Text>
                      <View style={styles.badgeRow}>
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                      </View>
                    </View>
                    <View style={styles.ticketActions}>
                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => viewTicket(ticket.id)}
                      >
                        <Text style={styles.viewBtnText}>View</Text>
                      </TouchableOpacity>
                      {currentUser.role === "admin" && (
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => deleteTicket(ticket.id)}
                        >
                          <Text style={styles.deleteBtnText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* ── CONTACTS TAB ── */}
        {activeTab === "contacts" && currentUser.role === "admin" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contact Messages</Text>
            {contacts.length === 0 ? (
              <Text style={styles.noDataText}>No messages found</Text>
            ) : (
              contacts.map((c) => (
                <View key={c.id} style={styles.ticketRow}>
                  <View style={styles.ticketInfo}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>
                      {c.subject}
                    </Text>
                    <Text style={styles.ticketMeta}>
                      {c.name} • {c.email}
                    </Text>
                    <View style={styles.badgeRow}>
                      <StatusBadge status={c.status} />
                      <PriorityBadge priority={c.priority} />
                    </View>
                    {/* Status Picker for contacts */}
                    <StatusPicker
                      value={c.status}
                      onChange={(v) => updateContactStatus(c.id, v)}
                      options={["new", "in_progress", "resolved", "closed"]}
                    />
                  </View>
                  <View style={styles.ticketActions}>
                    <TouchableOpacity style={styles.viewBtn} onPress={() => viewContact(c)}>
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => deleteContact(c.id)}
                    >
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* ── TICKET MODAL ── */}
      <Modal visible={showTicketModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Ticket #{selectedTicket?.id}: {selectedTicket?.subject}
              </Text>
              <TouchableOpacity onPress={() => setShowTicketModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedTicket && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Status: </Text>
                    <StatusBadge status={selectedTicket.status} />
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Priority: </Text>
                    <PriorityBadge priority={selectedTicket.priority} />
                  </View>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailKey}>Created by: </Text>
                    {selectedTicket.user_name}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailKey}>Created at: </Text>
                    {new Date(selectedTicket.created_at).toLocaleString()}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailKey}>Message: </Text>
                    {selectedTicket.message}
                  </Text>

                  {currentUser.role === "admin" && (
                    <>
                      <Text style={styles.fieldLabel}>Update Status</Text>
                      <StatusPicker
                        value={selectedTicket.status}
                        onChange={(v) => updateTicketStatus(selectedTicket.id, v)}
                        options={["open", "in_progress", "resolved", "closed"]}
                      />
                    </>
                  )}

                  {/* Replies */}
                  <Text style={styles.sectionTitle}>
                    Reply History ({selectedTicket.replies?.length || 0})
                  </Text>
                  {selectedTicket.replies?.map((reply) => (
                    <View
                      key={reply.id}
                      style={[
                        styles.reply,
                        reply.sender_role === "admin" ? styles.replyAdmin : styles.replyUser,
                      ]}
                    >
                      <Text style={styles.replyHeader}>
                        <Text style={{ fontWeight: "700" }}>{reply.sender_name}</Text>
                        {" "}({reply.sender_role}) •{" "}
                        {new Date(reply.created_at).toLocaleString()}
                      </Text>
                      <Text style={styles.replyMessage}>{reply.message}</Text>
                    </View>
                  ))}

                  {/* Reply Form (admin only) */}
                  {currentUser.role === "admin" && (
                    <>
                      <Text style={styles.sectionTitle}>Add Reply</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Type your reply..."
                        value={replyMessage}
                        onChangeText={setReplyMessage}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        placeholderTextColor="#9ca3af"
                      />
                      <TouchableOpacity style={styles.btnSubmit} onPress={submitReply}>
                        <Text style={styles.btnSubmitText}>Send Reply</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── CONTACT MODAL ── */}
      <Modal visible={showContactModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Contact #{selectedContact?.id}: {selectedContact?.subject}
              </Text>
              <TouchableOpacity onPress={() => setShowContactModal(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedContact && (
              <ScrollView>
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>Name: </Text>
                  {selectedContact.name}
                </Text>
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>Email: </Text>
                  {selectedContact.email}
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Priority: </Text>
                  <PriorityBadge priority={selectedContact.priority} />
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailKey}>Status: </Text>
                  <StatusBadge status={selectedContact.status} />
                </View>
                <Text style={styles.detailText}>
                  <Text style={styles.detailKey}>Message: </Text>
                  {selectedContact.message}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f6fa" },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  body: { flex: 1, padding: 16 },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2c3e50",
    padding: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  // Tabs
  tabsContainer: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "#ecf0f1",
  },
  tabActive: { backgroundColor: "#3498db" },
  tabText: { fontWeight: "600", color: "#555" },
  tabTextActive: { color: "#fff" },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#2c3e50", marginBottom: 12, marginTop: 8 },

  // Form
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: "#1f2937",
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  textArea: { minHeight: 100 },
  fieldLabel: { fontSize: 13, color: "#555", marginBottom: 6, fontWeight: "500" },
  btnSubmit: {
    backgroundColor: "#3498db",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  btnSubmitText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Picker
  pickerRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ecf0f1",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  pickerOptionText: { fontSize: 13, color: "#555", fontWeight: "500", textTransform: "capitalize" },

  // Ticket Row
  ticketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 8,
  },
  ticketInfo: { flex: 1 },
  ticketSubject: { fontSize: 14, fontWeight: "600", color: "#1f2937", marginBottom: 4 },
  ticketMeta: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  ticketActions: { justifyContent: "center", gap: 8 },

  // Buttons
  viewBtn: {
    backgroundColor: "#2ecc71",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  viewBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  deleteBtn: {
    backgroundColor: "#e74c3c",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  deleteBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600", textTransform: "capitalize" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937", flex: 1, marginRight: 8 },
  closeBtn: { fontSize: 22, color: "#6b7280" },

  // Detail text
  detailRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 6 },
  detailText: { fontSize: 14, color: "#374151", marginBottom: 10, lineHeight: 20 },
  detailKey: { fontWeight: "700", color: "#1f2937" },

  // Replies
  reply: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  replyAdmin: {
    borderLeftColor: "#e67e22",
    backgroundColor: "#fff3e0",
  },
  replyUser: {
    borderLeftColor: "#3498db",
    backgroundColor: "#e8f6ff",
  },
  replyHeader: { fontSize: 12, color: "#555", marginBottom: 4 },
  replyMessage: { fontSize: 14, color: "#1f2937" },

  // States
  loadingText: { color: "#6b7280", marginTop: 12 },
  errorText: { color: "#e74c3c", fontWeight: "600", textAlign: "center", padding: 12 },
  noDataText: { color: "#6b7280", fontStyle: "italic", textAlign: "center", padding: 12 },
});

export default Support;