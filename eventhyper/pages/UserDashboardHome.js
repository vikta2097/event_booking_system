// pages/UserDashboardHome.js (React Native)
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import api from "../shared/api";
import ChatbotWidget from "../components/ChatbotWidget";
// import EventCard from "./EventCard";
// import EventFilters from "./EventFilters";

const UserDashboardHome = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const navigation = useNavigation();

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true); setError("");
      try {
        const res = await api.get("/events");
        setEvents(res.data);
        setFilteredEvents(res.data);
      } catch (err) {
        setError("Unable to load events. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Simple search filter (replace with full EventFilters component when converted)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredEvents(events);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredEvents(
        events.filter(
          (e) =>
            e.title?.toLowerCase().includes(q) ||
            e.location?.toLowerCase().includes(q) ||
            e.category_name?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, events]);

  const renderEvent = ({ item: event }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => navigation.navigate("EventDetails", { eventId: event.id })}
    >
      <View style={styles.eventCardHeader}>
        <Text style={styles.eventCategory}>{event.category_name || "Event"}</Text>
        <Text style={styles.eventPrice}>
          {event.price ? `KES ${parseFloat(event.price).toLocaleString()}` : "Free"}
        </Text>
      </View>
      <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
      <Text style={styles.eventLocation} numberOfLines={1}>📍 {event.location || "TBD"}</Text>
      <Text style={styles.eventDate}>
        📅 {event.event_date ? new Date(event.event_date).toLocaleDateString() : "TBD"}
      </Text>
      <TouchableOpacity
        style={[styles.bookBtn, !user && styles.bookBtnGuest]}
        onPress={() => {
          if (user) {
            navigation.navigate("BookEvent", { eventId: event.id });
          } else {
            navigation.navigate("Login");
          }
        }}
      >
        <Text style={styles.bookBtnText}>{user ? "Book Now" : "Login to Book"}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍  Search events, venues, categories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* States */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0077ff" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      )}

      {!loading && error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error && filteredEvents.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.noEvents}>No events found matching your criteria.</Text>
        </View>
      )}

      {/* Event grid */}
      {!loading && !error && filteredEvents.length > 0 && (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEvent}
          numColumns={1}
          contentContainerStyle={styles.eventList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => (
            <View style={styles.footer}>
              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => navigation.navigate("UserHome")}>
                  <Text style={styles.footerLink}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate("Contact")}>
                  <Text style={styles.footerLink}>Contact Us</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footerCopy}>© {new Date().getFullYear()} EventHyper</Text>
            </View>
          )}
        />
      )}

      {/* Chatbot */}
      <ChatbotWidget user={user} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  searchContainer: {
    backgroundColor: "#fff",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    backgroundColor: "#f5f7fa",
    borderWidth: 1,
    borderColor: "#e0e6ed",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#333",
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, marginTop: 40 },
  loadingText: { marginTop: 12, color: "#555", fontSize: 16 },
  errorText: { color: "#e74c3c", fontSize: 16, textAlign: "center" },
  noEvents: { color: "#555", fontSize: 16, textAlign: "center" },

  eventList: { padding: 16, paddingBottom: 80 },
  eventCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  eventCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  eventCategory: {
    fontSize: 12,
    color: "#0077ff",
    fontWeight: "600",
    backgroundColor: "#e8f0fe",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: "hidden",
  },
  eventPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10b981",
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    lineHeight: 24,
  },
  eventLocation: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: "#666",
    marginBottom: 14,
  },
  bookBtn: {
    backgroundColor: "#0077ff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  bookBtnGuest: {
    backgroundColor: "#667eea",
  },
  bookBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  footer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    alignItems: "center",
  },
  footerLinks: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 10,
  },
  footerLink: {
    color: "#0066cc",
    fontWeight: "500",
    fontSize: 14,
  },
  footerCopy: {
    color: "#888",
    fontSize: 13,
  },
});

export default UserDashboardHome;