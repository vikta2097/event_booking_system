import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, ScrollView, Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import MapboxGL from "@rnmapbox/maps";
import api from "../api";
import EventCard from "./EventCard";
import EventFilters from "./EventFilters";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "");

const ITEMS_PER_PAGE = 12;
const { height } = Dimensions.get("window");

// ── Nairobi fallback ──
const FALLBACK_COORDS = { lat: -1.2921, lng: 36.8219 };

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

const EventList = ({ user }) => {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [currentFilters, setCurrentFilters] = useState({});
  const [viewMode, setViewMode] = useState("list");

  // ── GPS state ──
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [locationStatus, setLocationStatus] = useState("idle");
  const [nearMeActive, setNearMeActive] = useState(false);

  // ── Attach distances ──
  const attachDistances = useCallback((evts, loc) => {
    if (!loc) return evts.map((e) => ({ ...e, _distanceKm: null }));
    return evts.map((e) => {
      if (e.latitude && e.longitude) {
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
  }, []);

  // ── Sort nearest-first ──
  const sortByDistance = useCallback((evts) =>
    [...evts].sort((a, b) => {
      if (a._distanceKm == null && b._distanceKm == null) return 0;
      if (a._distanceKm == null) return 1;
      if (b._distanceKm == null) return -1;
      return a._distanceKm - b._distanceKm;
    }), []);

  // ── Request GPS via expo-location ──
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
        timeInterval: 8000,
      });
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(loc);
      setLocationStatus("granted");
    } catch {
      setLocationStatus("fallback");
      setUserLocation(FALLBACK_COORDS);
    }
  }, []);

  // ── Toggle Near Me ──
  const handleNearMe = () => {
    if (!nearMeActive) {
      setNearMeActive(true);
      if (!userLocation) requestGPS();
    } else {
      setNearMeActive(false);
    }
  };

  // Re-sort when nearMe or location changes
  useEffect(() => {
    setFilteredEvents((prev) => {
      const withDist = attachDistances(prev, userLocation);
      return nearMeActive ? sortByDistance(withDist) : withDist;
    });
  }, [nearMeActive, userLocation, attachDistances, sortByDistance]);

  const fetchEvents = useCallback(async (filters = {}, pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== "") params.append(key, val);
      });
      params.append("page", pageNum);
      params.append("limit", ITEMS_PER_PAGE);
      const res = await api.get(`/events?${params.toString()}`);
      const newEvents = res.data.events || res.data;

      const withDist = attachDistances(newEvents, userLocation);
      const sorted = nearMeActive ? sortByDistance(withDist) : withDist;

      if (append) {
        setEvents((prev) => [...prev, ...newEvents]);
        setFilteredEvents((prev) => {
          const combined = [...prev, ...sorted];
          return nearMeActive ? sortByDistance(combined) : combined;
        });
      } else {
        setEvents(newEvents);
        setFilteredEvents(sorted);
      }
      setHasMore(newEvents.length === ITEMS_PER_PAGE);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [attachDistances, sortByDistance, userLocation, nearMeActive]);

  const fetchRecommendations = useCallback(async () => {
    if (!user) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await api.get("/events/recommendations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecommendations(res.data.recommendations || []);
    } catch {}
  }, [user]);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await api.get("/events/favorites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFavorites(res.data.favorites || []);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchEvents();
    if (user) { fetchRecommendations(); fetchFavorites(); }
  }, [user]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      const withDist = attachDistances(events, userLocation);
      setFilteredEvents(nearMeActive ? sortByDistance(withDist) : withDist);
    } else {
      const lower = query.toLowerCase();
      const filtered = events.filter((e) =>
        e.title?.toLowerCase().includes(lower) ||
        e.location?.toLowerCase().includes(lower) ||
        e.organizer_name?.toLowerCase().includes(lower) ||
        e.category_name?.toLowerCase().includes(lower)
      );
      const withDist = attachDistances(filtered, userLocation);
      setFilteredEvents(nearMeActive ? sortByDistance(withDist) : withDist);
    }
  };

  const handleFilter = (filters) => {
    setPage(1);
    setHasMore(true);
    setCurrentFilters(filters);
    fetchEvents(filters, 1, false);
  };

  const handleSaveToFavorites = async (eventId, isFavorite) => {
    if (!user) { alert("Please login to save favorites"); return; }
    try {
      const token = await AsyncStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      if (isFavorite) {
        await api.post(`/events/${eventId}/favorite`, {}, { headers });
        setFavorites((prev) => [...prev, eventId]);
      } else {
        await api.delete(`/events/${eventId}/favorite`, { headers });
        setFavorites((prev) => prev.filter((id) => id !== eventId));
      }
    } catch { alert("Failed to update favorites"); }
  };

  const handleEndReached = () => {
    if (hasMore && !loadingMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchEvents(currentFilters, nextPage, true);
    }
  };

  const eventsWithFavorites = filteredEvents.map((e) => ({
    ...e,
    is_favorited: favorites.includes(e.id),
  }));

  const eventsWithCoords = eventsWithFavorites.filter((e) => e.latitude && e.longitude);

  const renderEvent = ({ item }) => (
    <EventCard event={item} user={user} onSaveToFavorites={handleSaveToFavorites} />
  );

  const renderFooter = () => {
    if (loadingMore) return <ActivityIndicator color="#667eea" style={{ marginVertical: 20 }} />;
    if (!hasMore && eventsWithFavorites.length > 0)
      return <Text style={styles.endText}>🎉 You've seen all available events</Text>;
    return null;
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🎭</Text>
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `No events match "${searchQuery}". Try different keywords.`
          : "No events available at the moment. Check back soon!"}
      </Text>
    </View>
  );

  // ── Location status banner ──
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
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search events by title, venue, organizer..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor="#9ca3af"
        />
        {!!searchQuery && (
          <TouchableOpacity onPress={() => handleSearch("")} style={styles.clearSearch}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters — pass Near Me props */}
      <EventFilters
        onFilter={handleFilter}
        nearMeActive={nearMeActive}
        onNearMe={handleNearMe}
      />

      {/* Location banner */}
      {renderLocationBanner()}

      {/* View Mode Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.viewToggleBtn, viewMode === "list" && styles.viewToggleBtnActive]}
          onPress={() => setViewMode("list")}
        >
          <Text style={[styles.viewToggleBtnText, viewMode === "list" && styles.viewToggleBtnTextActive]}>
            ☰ List View
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewToggleBtn, viewMode === "map" && styles.viewToggleBtnActive]}
          onPress={() => setViewMode("map")}
        >
          <Text style={[styles.viewToggleBtnText, viewMode === "map" && styles.viewToggleBtnTextActive]}>
            🗺️ Map View
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recommendations */}
      {user && recommendations.length > 0 && (
        <View style={styles.recommendSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✨ Recommended For You</Text>
            <TouchableOpacity onPress={() => setShowRecommendations(!showRecommendations)}>
              <Text style={styles.toggleBtn}>{showRecommendations ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
          {showRecommendations && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recommendations.slice(0, 4).map((event) => (
                <View key={`rec-${event.id}`} style={styles.recCard}>
                  <EventCard event={event} user={user} onSaveToFavorites={handleSaveToFavorites} />
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Results Header */}
      <View style={styles.resultsHeaderRow}>
        <Text style={styles.resultsHeader}>
          {nearMeActive ? "📍 Nearest Events" : ""}
          {searchQuery
            ? `Search Results (${eventsWithFavorites.length})`
            : nearMeActive
            ? ` (${eventsWithFavorites.length})`
            : `All Events (${eventsWithFavorites.length})`}
        </Text>
        {nearMeActive && locationStatus === "granted" && (
          <View style={styles.gpsBadge}>
            <Text style={styles.gpsBadgeText}>🛰️ GPS Active</Text>
          </View>
        )}
      </View>

      {/* Map View */}
      {viewMode === "map" && (
        <View style={styles.mapContainer}>
          <MapboxGL.MapView style={styles.map} styleURL="mapbox://styles/mapbox/streets-v12">
            <MapboxGL.Camera
              zoomLevel={eventsWithCoords.length > 0 ? 10 : 8}
              centerCoordinate={
                userLocation
                  ? [userLocation.lng, userLocation.lat]
                  : eventsWithCoords.length > 0
                  ? [parseFloat(eventsWithCoords[0].longitude), parseFloat(eventsWithCoords[0].latitude)]
                  : [FALLBACK_COORDS.lng, FALLBACK_COORDS.lat]
              }
            />
            <MapboxGL.UserLocation visible />

            {/* Event markers */}
            {eventsWithCoords.map((event) => (
              <MapboxGL.PointAnnotation
                key={`marker-${event.id}`}
                id={`marker-${event.id}`}
                coordinate={[parseFloat(event.longitude), parseFloat(event.latitude)]}
              >
                <View style={styles.markerWrapper}>
                  <View style={styles.markerPin} />
                </View>
                <MapboxGL.Callout
                  title={event.title}
                  textStyle={{ fontWeight: "700" }}
                />
              </MapboxGL.PointAnnotation>
            ))}
          </MapboxGL.MapView>

          {eventsWithCoords.length === 0 && (
            <View style={styles.noMapEvents}>
              <Text style={styles.noMapEventsText}>
                ⚠️ No events with location data. Try a different filter.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* List View */}
      {viewMode === "list" &&
        (loading ? (
          <ActivityIndicator size="large" color="#667eea" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={eventsWithFavorites}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderEvent}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.3}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa", padding: 12 },

  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 12, color: "#1f2937" },
  clearSearch: { padding: 6 },
  clearSearchText: { color: "#9ca3af", fontSize: 16, fontWeight: "700" },

  // Location banners
  locationBanner: { borderRadius: 8, padding: 10, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  bannerAcquiring: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#f59e0b" },
  bannerAcquiringText: { color: "#92400e", fontWeight: "600", fontSize: 13 },
  bannerGranted: { backgroundColor: "#d1fae5", borderWidth: 1, borderColor: "#10b981" },
  bannerGrantedText: { color: "#065f46", fontWeight: "600", fontSize: 13 },
  bannerFallback: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#f59e0b" },
  bannerFallbackText: { color: "#92400e", fontWeight: "600", fontSize: 13 },

  viewToggle: { flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  viewToggleBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  viewToggleBtnActive: { backgroundColor: "#667eea" },
  viewToggleBtnText: { fontWeight: "600", color: "#6b7280", fontSize: 14 },
  viewToggleBtnTextActive: { color: "#fff" },

  recommendSection: { marginBottom: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  toggleBtn: { color: "#667eea", fontWeight: "600", fontSize: 14 },
  recCard: { width: 280, marginRight: 12 },

  resultsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  resultsHeader: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  gpsBadge: { backgroundColor: "#667eea", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  gpsBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  // Map
  mapContainer: { flex: 1, borderRadius: 12, overflow: "hidden", minHeight: height * 0.55, borderWidth: 1, borderColor: "#e5e7eb" },
  map: { flex: 1 },
  markerWrapper: { alignItems: "center" },
  markerPin: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#667eea", borderWidth: 3, borderColor: "#fff", elevation: 4 },
  noMapEvents: { padding: 16, backgroundColor: "#fffbeb", borderRadius: 8, margin: 12 },
  noMapEventsText: { color: "#92400e", textAlign: "center", fontWeight: "600" },

  emptyContainer: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#1f2937", marginBottom: 8 },
  emptySubtitle: { color: "#6b7280", textAlign: "center", fontSize: 15 },
  endText: { textAlign: "center", color: "#6b7280", padding: 20, fontSize: 14 },
});

export default EventList;