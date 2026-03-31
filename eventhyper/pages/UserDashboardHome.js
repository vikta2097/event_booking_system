// pages/UserDashboardHome.js (React Native)
// Matches web version: uses EventCard and EventFilters as imports
import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import api from "../api";
import ChatbotWidget from "./ChatbotWidget";
import EventCard from "./EventCard";       // ✅ Restored — matches web import
import EventFilters from "./EventFilters"; // ✅ Restored — matches web import

const UserDashboardHome = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigation = useNavigation();

  // ── Fetch events — same as web ────────────────────────────────────────────
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/events");
        setEvents(res.data);
        setFilteredEvents(res.data);
      } catch (err) {
        console.error(err);
        setError("Unable to load events. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // ── Filter handler — same logic as web handleFilter ───────────────────────
  const handleFilter = (filters) => {
    let filtered = [...events];

    if (filters.category) {
      filtered = filtered.filter((e) =>
        (e.category_name || "").toLowerCase().includes(filters.category.toLowerCase())
      );
    }
    if (filters.venue) {
      filtered = filtered.filter((e) =>
        (e.location || "").toLowerCase().includes(filters.venue.toLowerCase())
      );
    }
    if (filters.minPrice !== undefined) {
      filtered = filtered.filter((e) => e.price >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter((e) => e.price <= parseFloat(filters.maxPrice));
    }
    if (filters.startDate) {
      filtered = filtered.filter(
        (e) => new Date(e.event_date) >= new Date(filters.startDate)
      );
    }
    if (filters.endDate) {
      filtered = filtered.filter(
        (e) => new Date(e.event_date) <= new Date(filters.endDate)
      );
    }

    setFilteredEvents(filtered);
  };

  // ── Render each event using the EventCard component — same as web ─────────
  const renderEvent = ({ item: event }) => (
    <EventCard
      event={event}
      user={user}
      onBook={() => {
        if (user) {
          navigation.navigate("BookEvent", { eventId: event.id });
        } else {
          navigation.navigate("Login");
        }
      }}
    />
  );

  return (
    <View style={styles.container}>
      {/* EventFilters — same as web filters wrapper */}
      <View style={styles.filtersWrapper}>
        <EventFilters onFilter={handleFilter} />
      </View>

      {/* Loading state */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0077ff" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      )}

      {/* Error state */}
      {!loading && error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Empty state */}
      {!loading && !error && filteredEvents.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.noEvents}>No events found matching your criteria.</Text>
        </View>
      )}

      {/* Events list using EventCard component */}
      {!loading && !error && filteredEvents.length > 0 && (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEvent}
          contentContainerStyle={styles.eventList}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => (
            <View style={styles.footer}>
              <View style={styles.footerLinks}>
                <Text
                  style={styles.footerLink}
                  onPress={() => navigation.navigate("UserHome")}
                >
                  Home
                </Text>
                <Text
                  style={styles.footerLink}
                  onPress={() => navigation.navigate("Contact")}
                >
                  Contact Us
                </Text>
              </View>
              <Text style={styles.footerCopy}>
                © {new Date().getFullYear()} EventHyper
              </Text>
            </View>
          )}
        />
      )}

      {/* Chatbot — same as web */}
      <ChatbotWidget user={user} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  filtersWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    elevation: 1,
  },
  centered: {
    flex: 1, justifyContent: "center", alignItems: "center",
    padding: 20, marginTop: 40,
  },
  loadingText: { marginTop: 12, color: "#555", fontSize: 16 },
  errorText: { color: "#e74c3c", fontSize: 16, textAlign: "center" },
  noEvents: { color: "#555", fontSize: 16, textAlign: "center" },
  eventList: { padding: 16, paddingBottom: 80 },
  footer: {
    marginTop: 24, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: "#ddd", alignItems: "center",
  },
  footerLinks: { flexDirection: "row", gap: 24, marginBottom: 10 },
  footerLink: { color: "#0066cc", fontWeight: "500", fontSize: 14 },
  footerCopy: { color: "#888", fontSize: 13 },
});

export default UserDashboardHome;