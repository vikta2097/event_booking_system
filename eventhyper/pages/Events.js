import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ScrollView, Image, StyleSheet, Alert, ActivityIndicator, Modal
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";
import EventForm from "../events/EventForm";
import TicketManagement from "../events/TicketManagement";
import AdminPanels from "../events/AdminPanels";

const Events = ({ currentUser }) => {
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedEventForTickets, setSelectedEventForTickets] = useState(null);

  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const formatEventStatus = (event) => {
    if (event.status === "cancelled") return "cancelled";
    const now = new Date();
    const start = new Date(`${event.event_date}T${event.start_time}`);
    const end = new Date(`${event.event_date}T${event.end_time}`);
    if (now > end) return "expired";
    if (now >= start && now <= end) return "ongoing";
    return "upcoming";
  };

  const fetchCategories = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await api.get("/categories", { headers });
      return res.data || [];
    } catch { return []; }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await api.get("/tags", { headers });
      return res.data || [];
    } catch { return []; }
  }, []);

  const fetchEvents = useCallback(async (categoryMap, tagMap) => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setError("");
      let url = "/events";
      if (currentUser.role === "admin") url = "/events/admin/all";
      else if (currentUser.role === "organizer") url = "/events/organizer/my-events";
      const headers = await getAuthHeaders();
      const eventsRes = await api.get(url, { headers });
      const enhanced = (eventsRes.data || []).map((ev) => ({
        ...ev,
        status: formatEventStatus(ev),
        category_name: categoryMap[ev.category_id] || ev.category_name || "-",
        organizer_name: ev.organizer_name || "-",
        organizer_image: ev.organizer_image || ev.image || "",
        tags_display: ev.tag_ids ? ev.tag_ids.split(",").map((id) => tagMap[id]).filter(Boolean).join(", ") : "",
      }));
      setEvents(enhanced);
    } catch {
      setError("Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const refreshData = useCallback(async () => {
    const [categoriesData, tagsData] = await Promise.all([fetchCategories(), fetchTags()]);
    setCategories(categoriesData);
    setTags(tagsData);
    const categoryMap = categoriesData.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {});
    const tagMap = tagsData.reduce((acc, t) => ({ ...acc, [t.id]: t.name }), {});
    await fetchEvents(categoryMap, tagMap);
  }, [fetchCategories, fetchTags, fetchEvents]);

  useEffect(() => { if (currentUser) refreshData(); }, [currentUser, refreshData]);

  const openModal = (event = null) => { setEditingEvent(event); setShowModal(true); };

  const handleDelete = (id) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            const headers = await getAuthHeaders();
            await api.delete(`/events/${id}`, { headers });
            await refreshData();
          } catch { setError("Failed to delete event"); }
        }
      }
    ]);
  };

  const handleDuplicate = (event) => {
    const dup = { ...event, title: `${event.title} (Copy)`, status: "upcoming" };
    delete dup.id; delete dup.created_at;
    openModal(dup);
  };

  const filteredEvents = events
    .filter((e) => {
      if (filterStatus === "active") return e.status === "upcoming" || e.status === "ongoing";
      if (filterStatus === "expired") return e.status === "expired";
      return true;
    })
    .filter((e) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return e.title?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q) ||
        e.organizer_name?.toLowerCase().includes(q) || e.category_name?.toLowerCase().includes(q);
    });

  const statusColor = (status) => ({
    upcoming: { bg: "#d1fae5", color: "#065f46" },
    ongoing: { bg: "#dbeafe", color: "#1e40af" },
    expired: { bg: "#f3f4f6", color: "#6b7280" },
    cancelled: { bg: "#fee2e2", color: "#991b1b" },
  }[status] || { bg: "#f3f4f6", color: "#6b7280" });

  const renderEvent = ({ item: event }) => {
    const sc = statusColor(event.status);
    return (
      <View style={styles.eventCard}>
        <View style={styles.eventCardHeader}>
          {event.organizer_image ? (
            <Image source={{ uri: event.organizer_image }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.noPoster]}><Text>📷</Text></View>
          )}
          <View style={styles.eventCardInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            {event.venue ? <Text style={styles.eventVenue}>{event.venue}</Text> : null}
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusBadgeText, { color: sc.color }]}>{event.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.eventMeta}>
          <Text style={styles.metaText}>📂 {event.category_name}</Text>
          <Text style={styles.metaText}>📅 {new Date(event.event_date).toLocaleDateString()}</Text>
          <Text style={styles.metaText}>🕒 {event.start_time} – {event.end_time}</Text>
          <Text style={styles.metaText}>📍 {event.location}</Text>
          <Text style={styles.metaText}>👥 {event.capacity}{event.total_seats_booked ? ` (${event.total_seats_booked} booked)` : ""}</Text>
          <Text style={styles.metaText}>💰 KES {event.price.toLocaleString()}</Text>
          {event.tags_display ? <Text style={styles.metaText}>🏷️ {event.tags_display}</Text> : null}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.viewBtn]} onPress={() => openModal(event)}>
            <Text style={styles.actionBtnText}>👁️ Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.dupBtn]} onPress={() => handleDuplicate(event)}>
            <Text style={styles.actionBtnText}>📋 Dup</Text>
          </TouchableOpacity>
          {event.status !== "expired" && (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.ticketBtn]} onPress={() => { setSelectedEventForTickets(event); setShowTicketModal(true); }}>
                <Text style={styles.actionBtnText}>🎫</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.delBtn]} onPress={() => handleDelete(event.id)}>
                <Text style={styles.actionBtnText}>🗑️</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  if (!currentUser) return <View style={styles.centered}><Text>Loading user...</Text></View>;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Manage Events</Text>
          <Text style={styles.subtitle}>Create and manage your events</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
          <Text style={styles.addBtnText}>➕ Add Event</Text>
        </TouchableOpacity>
      </View>

      {currentUser?.role === "admin" && (
        <AdminPanels categories={categories} tags={tags} onRefresh={refreshData} />
      )}

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="🔍 Search events..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[
          { key: "all", label: `All (${events.length})` },
          { key: "active", label: `Active (${events.filter((e) => e.status === "upcoming" || e.status === "ongoing").length})` },
          { key: "expired", label: `Expired (${events.filter((e) => e.status === "expired").length})` },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filterStatus === f.key && styles.filterBtnActive]}
            onPress={() => setFilterStatus(f.key)}
          >
            <Text style={[styles.filterBtnText, filterStatus === f.key && styles.filterBtnTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎭</Text>
          <Text style={styles.emptyTitle}>No Events Found</Text>
          <Text style={styles.emptySubtitle}>{searchQuery ? "Try different search terms" : "Create your first event to get started"}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
            <Text style={styles.addBtnText}>Create Event</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEvent}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Event Form Modal */}
      {showModal && (
        <EventForm
          event={editingEvent}
          categories={categories}
          tags={tags}
          currentUser={currentUser}
          onClose={() => { setShowModal(false); setEditingEvent(null); }}
          onSave={refreshData}
        />
      )}

      {/* Ticket Management Modal */}
      {showTicketModal && selectedEventForTickets && (
        <TicketManagement
          event={selectedEventForTickets}
          isOpen={showTicketModal}
          onClose={() => { setShowTicketModal(false); setSelectedEventForTickets(null); }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa", padding: 12 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  heading: { fontSize: 22, fontWeight: "700", color: "#1f2937" },
  subtitle: { color: "#6b7280", fontSize: 14 },
  addBtn: { backgroundColor: "#667eea", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  searchInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10 },
  filterScroll: { marginBottom: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 8, marginRight: 8, backgroundColor: "#fff" },
  filterBtnActive: { backgroundColor: "#667eea", borderColor: "#667eea" },
  filterBtnText: { color: "#374151", fontWeight: "600", fontSize: 13 },
  filterBtnTextActive: { color: "#fff" },
  errorText: { color: "#ef4444", textAlign: "center", marginTop: 40, fontSize: 16 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1f2937", marginBottom: 8 },
  emptySubtitle: { color: "#6b7280", marginBottom: 16 },
  eventCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  eventCardHeader: { flexDirection: "row", gap: 12, marginBottom: 10 },
  poster: { width: 60, height: 60, borderRadius: 8, backgroundColor: "#f3f4f6" },
  noPoster: { alignItems: "center", justifyContent: "center" },
  eventCardInfo: { flex: 1 },
  eventTitle: { fontWeight: "700", fontSize: 15, color: "#1f2937", marginBottom: 2 },
  eventVenue: { color: "#6b7280", fontSize: 13, marginBottom: 4 },
  statusBadge: { alignSelf: "flex-start", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  eventMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  metaText: { color: "#6b7280", fontSize: 12, backgroundColor: "#f9fafb", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, borderRadius: 8, padding: 8, alignItems: "center" },
  viewBtn: { backgroundColor: "#eff6ff" },
  dupBtn: { backgroundColor: "#fef3c7" },
  ticketBtn: { backgroundColor: "#f0fdf4" },
  delBtn: { backgroundColor: "#fee2e2" },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
});

export default Events;
