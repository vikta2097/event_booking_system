import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, Modal, StyleSheet, KeyboardAvoidingView,
  Platform, Animated, Linking, SafeAreaView
} from "react-native";
import api from "../api";

const ChatbotWidget = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollViewRef = useRef(null);

  const role = user?.role || "guest";
  const userId = user?.id || user?.user_id;
  const userName = user?.fullname || user?.full_name || user?.name || user?.username || "there";

  const formatCurrency = useCallback((amount) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount), []);

  const formatDate = useCallback((dateString) => {
    try { return new Date(dateString).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return dateString; }
  }, []);

  const formatTime = useCallback((dateString) => {
    try { return new Date(dateString).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }, []);

  const addMessage = useCallback((sender, text, data = {}) => {
    const timestamp = new Date();
    setMessages((prev) => [...prev, { sender, text, timestamp, ...data }]);
    if (!isOpen && sender === "bot") setUnreadCount((prev) => prev + 1);
  }, [isOpen]);

  const sendGreeting = useCallback(() => {
    const greetings = {
      guest: "Hello! 👋 Welcome to our Event Booking System. I can help you explore events, learn about registration, or answer questions.",
      user: `Welcome back, ${userName}! 👋 I can help with your bookings, payments, finding events, and more.`,
      admin: `Hello Admin${userName !== "there" ? ", " + userName : ""}! 👨‍💼 I can show stats, manage bookings, track payments, and more.`,
    };
    addMessage("bot", greetings[role]);
    const initialSuggestions = {
      guest: ["Show events", "How to register", "Contact support"],
      user: ["My bookings", "Find events", "How to pay"],
      admin: ["Dashboard stats", "Manage bookings", "View users"],
    };
    setSuggestions(initialSuggestions[role]);
  }, [addMessage, role, userName]);

  useEffect(() => {
    if (isOpen && messages.length === 0) sendGreeting();
  }, [isOpen, messages.length, sendGreeting]);

  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const handleSend = useCallback(async (messageText = input) => {
    if (!messageText.trim()) return;
    const userMessage = messageText.trim();
    addMessage("user", userMessage);
    setInput("");
    setTyping(true);
    setSuggestions([]);
    try {
      const response = await api.post("/chatbot/chat", { message: userMessage, role, userId });
      const data = response.data;
      if (data.response) {
        addMessage("bot", data.response, {
          events: data.events || [],
          bookings: data.bookings || [],
          stats: data.stats,
          categories: data.categories || [],
          reminders: data.reminders || [],
        });
      }
      if (data.suggestions?.length) setSuggestions(data.suggestions);
    } catch {
      addMessage("bot", "Sorry, I encountered an error. Please try again or contact support at victorlabs854@gmail.com");
      const fallback = {
        guest: ["Show events", "How to register", "Contact support"],
        user: ["My bookings", "Find events", "How to pay"],
        admin: ["Dashboard stats", "Manage bookings", "View users"],
      };
      setSuggestions(fallback[role]);
    } finally {
      setTyping(false);
    }
  }, [addMessage, input, role, userId]);

  const handleClearChat = useCallback(async () => {
    setMessages([]);
    setSuggestions([]);
    try {
      if (userId) await api.post("/chatbot/clear", { userId });
      sendGreeting();
    } catch {
      addMessage("bot", "Chat cleared locally.");
      sendGreeting();
    }
  }, [addMessage, sendGreeting, userId]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) setUnreadCount(0);
  }, [isOpen]);

  const renderMessage = (msg, idx) => (
    <View key={idx} style={[styles.messageRow, msg.sender === "user" && styles.messageRowUser]}>
      <View style={[styles.avatar, msg.sender === "user" && styles.avatarUser]}>
        <Text style={styles.avatarText}>{msg.sender === "user" ? "U" : "B"}</Text>
      </View>
      <View style={[styles.messageContent, msg.sender === "user" && styles.messageContentUser]}>
        <View style={[styles.messageBubble, msg.sender === "user" && styles.messageBubbleUser]}>
          <Text style={[styles.messageText, msg.sender === "user" && styles.messageTextUser]}>{msg.text}</Text>
        </View>

        {msg.events?.length > 0 && (
          <View style={styles.cardList}>
            {msg.events.map((event) => (
              <View key={event.id} style={styles.infoCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{event.title}</Text>
                  <View style={styles.priceTag}><Text style={styles.priceTagText}>{formatCurrency(event.price)}</Text></View>
                </View>
                <Text style={styles.cardMeta}>📅 {formatDate(event.event_date)}</Text>
                <Text style={styles.cardMeta}>📍 {event.location}</Text>
                {event.category && <Text style={styles.cardMeta}>🏷️ {event.category}</Text>}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.cardBtn, styles.bookBtn]} disabled={role === "guest"}>
                    <Text style={styles.cardBtnText}>{role === "guest" ? "Login to Book" : "Book Now"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cardBtn, styles.detailsBtn]}>
                    <Text style={styles.detailsBtnText}>Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {msg.bookings?.length > 0 && (
          <View style={styles.cardList}>
            {msg.bookings.map((booking) => (
              <View key={booking.id} style={styles.infoCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{booking.title}</Text>
                  <View style={[styles.statusChip, styles[`status_${booking.status}`] || styles.status_pending]}>
                    <Text style={styles.statusChipText}>{booking.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>📋 Ref: {booking.reference}</Text>
                <Text style={styles.cardMeta}>📅 {formatDate(booking.event_date)}</Text>
                <Text style={styles.cardMeta}>🎟️ Seats: {booking.seats}</Text>
                <Text style={styles.cardMeta}>💰 {formatCurrency(booking.total_amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {msg.categories?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {msg.categories.map((cat) => (
                <TouchableOpacity key={cat.id} style={styles.categoryChip} onPress={() => handleSend(`Show ${cat.name} events`)}>
                  <Text style={styles.categoryChipText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {msg.stats && (
          <View style={styles.statsGrid}>
            {[
              { label: "Total Events", value: msg.stats.totalEvents || 0 },
              { label: "Bookings", value: msg.stats.totalBookings || 0 },
              { label: "Revenue", value: formatCurrency(msg.stats.totalRevenue || 0) },
              { label: "Users", value: msg.stats.totalUsers || 0 },
            ].map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.messageTime}>{formatTime(msg.timestamp)}</Text>
      </View>
    </View>
  );

  return (
    <>
      {/* Floating Button */}
      <TouchableOpacity style={styles.floatingBtn} onPress={handleToggle}>
        <Text style={styles.floatingBtnIcon}>🤖</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>
        )}
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={handleToggle}>
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            style={styles.widget}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerAvatar}>🤖</Text>
                <View>
                  <Text style={styles.headerName}>EventHank</Text>
                  <Text style={styles.headerStatus}>● Online</Text>
                </View>
              </View>
              <View style={styles.headerControls}>
                <TouchableOpacity style={styles.headerBtn} onPress={handleClearChat}>
                  <Text style={styles.headerBtnText}>🗑️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerBtn} onPress={handleToggle}>
                  <Text style={styles.headerBtnText}>✖</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <ScrollView ref={scrollViewRef} style={styles.messages} contentContainerStyle={{ padding: 16 }}>
              {messages.map(renderMessage)}
              {typing && (
                <View style={styles.typingIndicator}>
                  <Text style={styles.typingText}>● ● ●</Text>
                </View>
              )}
            </ScrollView>

            {/* Suggestions */}
            {suggestions.length > 0 && !typing && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsLabel}>Quick Actions:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {suggestions.map((s, i) => (
                      <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => handleSend(s)}>
                        <Text style={styles.suggestionChipText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                value={input}
                onChangeText={setInput}
                editable={!typing}
                onSubmitEditing={() => handleSend()}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || typing) && styles.sendBtnDisabled]}
                onPress={() => handleSend()}
                disabled={!input.trim() || typing}
              >
                <Text style={styles.sendBtnText}>➤</Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>EventHank • Powered by </Text>
              <TouchableOpacity onPress={() => Linking.openURL("https://victorlabs.netlify.app")}>
                <Text style={styles.footerLink}>victorlabs</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const PURPLE = "#667eea";
const DARK_PURPLE = "#764ba2";

const styles = StyleSheet.create({
  floatingBtn: { position: "absolute", bottom: 24, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: PURPLE, alignItems: "center", justifyContent: "center", shadowColor: PURPLE, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8, zIndex: 100 },
  floatingBtnIcon: { fontSize: 30 },
  badge: { position: "absolute", top: -4, right: -4, backgroundColor: "#ff4757", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 18, alignItems: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  modalContainer: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  widget: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "85%", overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: PURPLE },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { fontSize: 32 },
  headerName: { color: "#fff", fontWeight: "700", fontSize: 16 },
  headerStatus: { color: "#4ade80", fontSize: 12 },
  headerControls: { flexDirection: "row", gap: 8 },
  headerBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerBtnText: { fontSize: 16 },
  messages: { flex: 1, backgroundColor: "#f8f9fa" },
  messageRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  messageRowUser: { flexDirection: "row-reverse" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: PURPLE, alignItems: "center", justifyContent: "center", marginHorizontal: 8 },
  avatarUser: { backgroundColor: "#f5576c" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  messageContent: { maxWidth: "75%" },
  messageContentUser: { alignItems: "flex-end" },
  messageBubble: { backgroundColor: "#fff", padding: 12, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  messageBubbleUser: { background: PURPLE, backgroundColor: PURPLE },
  messageText: { fontSize: 14, lineHeight: 20, color: "#1f2937" },
  messageTextUser: { color: "#fff" },
  messageTime: { fontSize: 11, color: "#9ca3af", marginTop: 4, paddingHorizontal: 4 },
  typingIndicator: { backgroundColor: "#fff", borderRadius: 16, padding: 14, alignSelf: "flex-start", marginLeft: 44, marginBottom: 12 },
  typingText: { color: PURPLE, letterSpacing: 4, fontWeight: "700" },
  cardList: { marginTop: 8, gap: 10 },
  infoCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#e5e7eb", marginTop: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardTitle: { fontWeight: "700", color: "#1f2937", flex: 1, fontSize: 14 },
  priceTag: { backgroundColor: PURPLE, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  priceTagText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  cardMeta: { color: "#6b7280", fontSize: 12, marginBottom: 3 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  cardBtn: { flex: 1, padding: 8, borderRadius: 8, alignItems: "center" },
  bookBtn: { backgroundColor: PURPLE },
  cardBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  detailsBtn: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb" },
  detailsBtnText: { color: "#6b7280", fontWeight: "600", fontSize: 12 },
  statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  status_confirmed: { backgroundColor: "#d1fae5" },
  status_pending: { backgroundColor: "#fef3c7" },
  status_cancelled: { backgroundColor: "#fee2e2" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: { backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  categoryChipText: { color: "#374151", fontSize: 13, fontWeight: "500" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  statCard: { backgroundColor: PURPLE, borderRadius: 10, padding: 12, alignItems: "center", minWidth: 80 },
  statValue: { color: "#fff", fontWeight: "700", fontSize: 18 },
  statLabel: { color: "rgba(255,255,255,0.85)", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  suggestionsContainer: { borderTopWidth: 1, borderTopColor: "#e5e7eb", padding: 12 },
  suggestionsLabel: { fontSize: 11, color: "#6b7280", fontWeight: "700", textTransform: "uppercase", marginBottom: 8 },
  suggestionChip: { backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  suggestionChipText: { color: "#374151", fontSize: 13, fontWeight: "500" },
  inputRow: { flexDirection: "row", alignItems: "center", padding: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb", gap: 8 },
  input: { flex: 1, borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: PURPLE, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#fff", fontSize: 18 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10, backgroundColor: "#f9fafb", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  footerText: { color: "#9ca3af", fontSize: 11 },
  footerLink: { color: "#2563eb", fontWeight: "700", fontSize: 11 },
});

export default ChatbotWidget;
