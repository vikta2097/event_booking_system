import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";

import api from "../api";
import ChatbotWidget from "./ChatbotWidget";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";

// ── Haversine distance in km ──
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const FALLBACK_COORDS = { lat: -1.2921, lng: 36.8219 }; // Nairobi

const UserDashboardHome = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── GPS state ──
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [nearMeActive, setNearMeActive] = useState(false);

  const navigation = useNavigation();

  // ── Attach distances & optionally sort ──
  const processEvents = useCallback(
    (raw, loc, sortByDist) => {
      const withDist = raw.map((e) => {
        if (loc && e.latitude && e.longitude) {
          return {
            ...e,
            _distanceKm: haversineDistance(
              loc.lat, loc.lng,
              parseFloat(e.latitude), parseFloat(e.longitude)
            ),
          };
        }
        return { ...e, _distanceKm: null };
      });
      if (sortByDist) {
        return [...withDist].sort((a, b) => {
          if (a._distanceKm == null && b._distanceKm == null) return 0;
          if (a._distanceKm == null) return 1;
          if (b._distanceKm == null) return -1;
          return a._distanceKm - b._distanceKm;
        });
      }
      return withDist;
    },
    []
  );

  // ── Fetch ──
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/events");
        const raw = res.data || [];
        setEvents(raw);
        setFilteredEvents(processEvents(raw, userLocation, nearMeActive));
      } catch (err) {
        console.error(err);
        setError("Unable to load events. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Re-process on location / nearMe change
  useEffect(() => {
    setFilteredEvents(processEvents(events, userLocation, nearMeActive));
  }, [userLocation, nearMeActive, events, processEvents]);

  // ── Filter handler ──
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
    if (filters.minPrice !== "" && filters.minPrice != null) {
      const min = Number(filters.minPrice);
      if (!isNaN(min)) filtered = filtered.filter((e) => Number(e.price) >= min);
    }
    if (filters.maxPrice !== "" && filters.maxPrice != null) {
      const max = Number(filters.maxPrice);
      if (!isNaN(max)) filtered = filtered.filter((e) => Number(e.price) <= max);
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      filtered = filtered.filter((e) => new Date(e.event_date) >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      filtered = filtered.filter((e) => new Date(e.event_date) <= end);
    }
    setFilteredEvents(processEvents(filtered, userLocation, nearMeActive));
  };

  // ── GPS request via expo-location ──
  const requestGPS = useCallback(async () => {
    setLocationStatus("acquiring");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationStatus("fallback");
        setUserLocation(FALLBACK_COORDS);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      setLocationStatus("granted");
    } catch {
      setLocationStatus("fallback");
      setUserLocation(FALLBACK_COORDS);
    }
  }, []);

  const handleNearMe = () => {
    if (!nearMeActive) {
      setNearMeActive(true);
      if (!userLocation) requestGPS();
    } else {
      setNearMeActive(false);
    }
  };

  // ── Render event card ──
  const renderEvent = ({ item }) => (
    <EventCard
      event={item}
      user={user}
      onBook={() => {
        if (user) {
          navigation.navigate("BookEvent", { eventId: item.id });
        } else {
          navigation.navigate("Login");
        }
      }}
    />
  );

  // ── Location banner ──
  const renderLocationBanner = () => {
    if (!nearMeActive || locationStatus === "idle") return null;
    if (locationStatus === "acquiring") {
      return (
        <View style={[styles.locationBanner, styles.bannerAcquiring]}>
          <ActivityIndicator size="small" color="#92400e" style={{ marginRight: 6 }} />
          <Text style={styles.bannerAcquiringText}>Acquiring your location…</Text>
        </View>
      );
    }
    if (locationStatus === "granted") {
      return (
        <View style={[styles.locationBanner, styles.bannerGranted]}>
          <Text style={styles.bannerGrantedText}>✅ Showing events nearest to you</Text>
        </View>
      );
    }
    if (locationStatus === "fallback") {
      return (
        <View style={[styles.locationBanner, styles.bannerFallback]}>
          <Text style={styles.bannerFallbackText}>⚠️ GPS unavailable — showing events near Nairobi</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filtersWrapper}>
        <EventFilters
          onFilter={handleFilter}
          nearMeActive={nearMeActive}
          onNearMe={handleNearMe}
        />
      </View>

      {renderLocationBanner()}

      {/* Loading */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0077ff" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      )}

      {/* Error */}
      {!loading && error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Empty */}
      {!loading && !error && filteredEvents.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.noEvents}>No events found matching your filters.</Text>
        </View>
      )}

      {/* Events List */}
      {!loading && !error && filteredEvents.length > 0 && (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEvent}
          contentContainerStyle={styles.eventList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() =>
            nearMeActive ? (
              <View style={styles.resultsHeaderRow}>
                <Text style={styles.resultsHeader}>
                  📍 Nearest Events ({filteredEvents.length})
                </Text>
                {locationStatus === "granted" && (
                  <View style={styles.gpsBadge}>
                    <Text style={styles.gpsBadgeText}>🛰️ GPS Active</Text>
                  </View>
                )}
              </View>
            ) : null
          }
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

      {/* Chatbot */}
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

  // Location banners
  locationBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  bannerAcquiring: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#f59e0b" },
  bannerAcquiringText: { color: "#92400e", fontWeight: "600", fontSize: 13 },
  bannerGranted: { backgroundColor: "#d1fae5", borderWidth: 1, borderColor: "#10b981" },
  bannerGrantedText: { color: "#065f46", fontWeight: "600", fontSize: 13 },
  bannerFallback: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#f59e0b" },
  bannerFallbackText: { color: "#92400e", fontWeight: "600", fontSize: 13 },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginTop: 40,
  },
  loadingText: { marginTop: 12, color: "#555", fontSize: 16 },
  errorText: { color: "#e74c3c", fontSize: 16, textAlign: "center" },
  noEvents: { color: "#555", fontSize: 16, textAlign: "center" },

  eventList: { padding: 16, paddingBottom: 80 },

  resultsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  resultsHeader: { fontSize: 15, fontWeight: "700", color: "#1f2937" },
  gpsBadge: {
    backgroundColor: "#667eea",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  gpsBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  footer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    alignItems: "center",
  },
  footerLinks: { flexDirection: "row", gap: 24, marginBottom: 10 },
  footerLink: { color: "#0066cc", fontWeight: "500", fontSize: 14 },
  footerCopy: { color: "#888", fontSize: 13 },
});

export default UserDashboardHome;