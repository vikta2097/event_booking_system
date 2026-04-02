import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator, Alert,
  Share, Linking, Dimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapboxGL from "@rnmapbox/maps";
import api from "../api";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "");

const { width } = Dimensions.get("window");

const EventDetails = ({ user }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { id } = route.params;

  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [similarEvents, setSimilarEvents] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const eventRes = await api.get(`/events/${id}`);
        setEvent(eventRes.data);

        const ticketsRes = await api.get(`/events/${id}/ticket-types`);
        const types = ticketsRes.data.ticket_types || [];
        setTicketTypes(types);
        if (types.length > 0) setSelectedTicket(types[0]);

        if (eventRes.data.category_id) {
          const similarRes = await api.get(
            `/events?category=${eventRes.data.category_id}&limit=4&exclude=${id}`
          );
          setSimilarEvents(similarRes.data.events || similarRes.data || []);
        }

        if (user) {
          try {
            const favRes = await api.get(`/events/${id}/is-favorite`, { headers });
            setIsFavorite(favRes.data.is_favorite);
          } catch {}
          api.post(`/events/${id}/track-view`, {}, { headers }).catch(() => {});
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load event details.");
      } finally {
        setLoading(false);
      }
    };
    fetchEventDetails();
  }, [id, user]);

  // ── Directions: lat/lng first (matches web) ──
  const handleGetDirections = () => {
    if (event?.latitude && event?.longitude) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
      );
    } else if (event?.map_link) {
      let url = event.map_link;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      Linking.openURL(url);
    } else if (event?.venue || event?.location) {
      const query = encodeURIComponent(event.venue || event.location);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    } else {
      Alert.alert("Location not available", "This event has no location information.");
    }
  };

  const handleFavoriteToggle = async () => {
    if (!user) { Alert.alert("Login required", "Please login to save favorites."); return; }
    try {
      const token = await AsyncStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      if (isFavorite) {
        await api.delete(`/events/${id}/favorite`, { headers });
      } else {
        await api.post(`/events/${id}/favorite`, {}, { headers });
      }
      setIsFavorite(!isFavorite);
    } catch {
      Alert.alert("Error", "Failed to update favorite.");
    }
  };

  const handleShare = async (platform) => {
    const eventUrl = `https://eventhyper.app/events/${id}`;
    const text = `Check out ${event.title}!`;
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + " " + eventUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(eventUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`,
    };
    if (platform === "native") {
      try { await Share.share({ title: event.title, message: `${text} ${eventUrl}` }); } catch {}
    } else {
      Linking.openURL(shareUrls[platform]);
    }
    setShowShareModal(false);
  };

  const handleAddToCalendar = () => {
    if (!event) return;
    const startDate = new Date(`${event.event_date}T${event.start_time}`);
    const endDate = new Date(`${event.event_date}T${event.end_time || event.start_time}`);
    const fmt = (d) => d.toISOString().replace(/-|:|\.\d+/g, "");
    const title = encodeURIComponent(event.title);
    const location = encodeURIComponent(event.venue || event.location || "");
    const details = encodeURIComponent(event.description || "");
    Linking.openURL(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(startDate)}/${fmt(endDate)}&details=${details}&location=${location}`
    );
  };

  const handleContactOrganizer = () => {
    if (event?.organizer_email) {
      Linking.openURL(`mailto:${event.organizer_email}?subject=Inquiry about ${event.title}`);
    } else {
      Alert.alert("Not available", "Organizer contact information is not available.");
    }
  };

  const handleBookNow = () => {
    if (!user) navigation.navigate("Login");
    else navigation.navigate("BookingForm", { id: event.id });
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return "Free";
    return `KES ${Number(price).toLocaleString()}`;
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#667eea" />
      <Text style={styles.loadingText}>Loading event details...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.retryBtnText}>← Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  if (!event) return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>Event not found.</Text>
    </View>
  );

  const availableSeats = event.capacity - (event.total_seats_booked || 0);
  const isSoldOut = availableSeats <= 0;
  const isEarlyBirdActive = event.is_early_bird && event.early_bird_deadline &&
    new Date(event.early_bird_deadline) >= new Date();

  const lng = event.longitude ? parseFloat(event.longitude) : 36.8219;
  const lat = event.latitude ? parseFloat(event.latitude) : -1.2921;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        {/* Hero Image */}
        <View style={styles.heroWrapper}>
          <Image
            source={{ uri: event.images?.[activeImageIndex] || event.image || "https://via.placeholder.com/800x400" }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {/* Hero overlay actions */}
          <View style={styles.heroActions}>
            <TouchableOpacity style={[styles.heroBtn, isFavorite && styles.heroBtnActive]} onPress={handleFavoriteToggle}>
              <Text style={styles.heroBtnIcon}>{isFavorite ? "❤️" : "🤍"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroBtn} onPress={() => setShowShareModal(true)}>
              <Text style={styles.heroBtnIcon}>📤</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroBtn} onPress={handleAddToCalendar}>
              <Text style={styles.heroBtnIcon}>📅</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Image thumbnails */}
        {event.images?.length > 1 && (
          <FlatList
            data={event.images}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            style={styles.thumbnailList}
            renderItem={({ item, index }) => (
              <TouchableOpacity onPress={() => setActiveImageIndex(index)}>
                <Image
                  source={{ uri: item }}
                  style={[styles.thumbnail, activeImageIndex === index && styles.thumbnailActive]}
                />
              </TouchableOpacity>
            )}
          />
        )}

        <View style={styles.content}>
          {/* Badges */}
          <View style={styles.badgeRow}>
            {event.category_name && (
              <View style={[styles.badge, styles.badgeCategory]}>
                <Text style={styles.badgeText}>{event.category_name}</Text>
              </View>
            )}
            {event.is_trending && (
              <View style={[styles.badge, styles.badgeTrending]}>
                <Text style={styles.badgeText}>🔥 Trending</Text>
              </View>
            )}
            {isEarlyBirdActive && (
              <View style={[styles.badge, styles.badgeEarlyBird]}>
                <Text style={styles.badgeText}>⚡ Early Bird</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{event.title}</Text>

          {/* Tags */}
          {event.tags_display && (
            <View style={styles.tagsRow}>
              {event.tags_display.split(", ").filter(Boolean).map((tag, i) => (
                <View key={i} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
              ))}
            </View>
          )}

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>📅</Text>
                <View>
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>{formatDate(event.event_date)}</Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>🕒</Text>
                <View>
                  <Text style={styles.infoLabel}>Time</Text>
                  <Text style={styles.infoValue}>
                    {event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Description */}
          {event.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About This Event</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          )}

          {/* Venue */}
          {(event.venue || event.location) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Venue</Text>
              <View style={styles.venueCard}>
                <Text style={styles.venueName}>📍 {event.venue || event.location}</Text>
                {event.parking_info && (
                  <View style={styles.parkingInfo}>
                    <Text style={styles.parkingHeader}>🅿️  Parking Information</Text>
                    <Text style={styles.parkingText}>{event.parking_info}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.directionsBtn} onPress={handleGetDirections}>
                  <Text style={styles.directionsBtnText}>🗺️ Get Directions</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Mapbox Map ── */}
          {(event.venue || event.location) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location Map</Text>
              <View style={styles.mapWrapper}>
                <MapboxGL.MapView style={styles.map} styleURL="mapbox://styles/mapbox/streets-v12">
                  <MapboxGL.Camera
                    zoomLevel={event.longitude ? 14 : 10}
                    centerCoordinate={[lng, lat]}
                  />
                  <MapboxGL.PointAnnotation id="venue" coordinate={[lng, lat]}>
                    <View style={styles.markerContainer}>
                      <View style={styles.markerPin} />
                    </View>
                    <MapboxGL.Callout title={event.venue || event.location || "Event Venue"} />
                  </MapboxGL.PointAnnotation>
                </MapboxGL.MapView>
              </View>
              <TouchableOpacity style={styles.mapLinkBtn} onPress={handleGetDirections}>
                <Text style={styles.mapLinkBtnText}>🗺️ Get Directions</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ticket Types */}
          {ticketTypes.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Tickets</Text>
              {ticketTypes.map((ticket) => {
                const available = ticket.quantity_available - ticket.quantity_sold;
                const isTktSoldOut = available <= 0;
                const isEarlyBird = ticket.early_bird_active;
                const isSelected = selectedTicket?.id === ticket.id;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    style={[
                      styles.ticketCard,
                      isTktSoldOut && styles.ticketCardSoldOut,
                      isEarlyBird && styles.ticketCardEarlyBird,
                      isSelected && styles.ticketCardSelected,
                    ]}
                    onPress={() => !isTktSoldOut && setSelectedTicket(ticket)}
                    disabled={isTktSoldOut}
                  >
                    <View style={styles.ticketHeader}>
                      <Text style={styles.ticketName}>{ticket.name}</Text>
                      {isEarlyBird && (
                        <View style={styles.earlyBirdLabel}>
                          <Text style={styles.earlyBirdLabelText}>⚡ Early Bird</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.ticketPrice}>{formatPrice(ticket.price)}</Text>
                    {ticket.description && <Text style={styles.ticketDescription}>{ticket.description}</Text>}
                    <View style={styles.ticketFooter}>
                      {isTktSoldOut ? (
                        <Text style={styles.ticketSoldOut}>Sold Out</Text>
                      ) : (
                        <>
                          <Text style={styles.ticketAvailable}>{available} available</Text>
                          {ticket.is_low_stock && <Text style={styles.lowStock}>⚠️ Low Stock!</Text>}
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Organizer */}
          {event.organizer_name && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Organized By</Text>
              <View style={styles.organizerCard}>
                {event.organizer_profile && (
                  <Image source={{ uri: event.organizer_profile }} style={styles.organizerAvatar} />
                )}
                <View style={styles.organizerInfo}>
                  <Text style={styles.organizerName}>
                    {event.organizer_name}
                    {event.is_verified_organizer && <Text style={styles.verifiedBadge}> ✓</Text>}
                  </Text>
                  {event.organizer_rating && (
                    <Text style={styles.organizerRating}>
                      ⭐ {event.organizer_rating.toFixed(1)}
                      {event.organizer_event_count ? ` · ${event.organizer_event_count} events hosted` : ""}
                    </Text>
                  )}
                  {event.organizer_email && (
                    <TouchableOpacity style={styles.contactBtn} onPress={handleContactOrganizer}>
                      <Text style={styles.contactBtnText}>📧 Contact Organizer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Similar Events */}
          {similarEvents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Similar Events</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {similarEvents.map(simEvent => (
                  <TouchableOpacity
                    key={simEvent.id}
                    style={styles.similarCard}
                    onPress={() => navigation.push("EventDetails", { id: simEvent.id })}
                  >
                    <Image
                      source={{ uri: simEvent.image || "https://via.placeholder.com/160x100" }}
                      style={styles.similarImage}
                    />
                    <Text style={styles.similarTitle} numberOfLines={2}>{simEvent.title}</Text>
                    <Text style={styles.similarDate}>{formatDate(simEvent.event_date)}</Text>
                    <Text style={styles.similarPrice}>{formatPrice(simEvent.price)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky Booking Bar ── */}
      <View style={styles.stickyBar}>
        <View>
          <Text style={styles.stickyPriceLabel}>
            {selectedTicket ? selectedTicket.name : "Starting from"}
          </Text>
          {isEarlyBirdActive && event.early_bird_price ? (
            <View style={styles.stickyPriceRow}>
              <Text style={styles.stickyPriceOld}>KES {event.price.toLocaleString()}</Text>
              <Text style={styles.stickyPrice}>KES {event.early_bird_price.toLocaleString()}</Text>
            </View>
          ) : (
            <Text style={styles.stickyPrice}>{formatPrice(selectedTicket?.price || event.price)}</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, isSoldOut && styles.bookBtnSoldOut]}
          onPress={handleBookNow}
          disabled={isSoldOut}
        >
          <Text style={styles.bookBtnText}>
            {isSoldOut ? "Sold Out" : user ? "Book Now" : "Login to Book"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Share Modal ── */}
      {showShareModal && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowShareModal(false)}>
          <View style={styles.shareModal}>
            <Text style={styles.shareModalTitle}>Share this event</Text>
            <View style={styles.shareBtnsGrid}>
              {[
                { platform: "native", label: "Share", emoji: "📤" },
                { platform: "whatsapp", label: "WhatsApp", emoji: "💬" },
                { platform: "twitter", label: "Twitter", emoji: "🐦" },
                { platform: "facebook", label: "Facebook", emoji: "📘" },
              ].map(({ platform, label, emoji }) => (
                <TouchableOpacity key={platform} style={styles.shareBtn} onPress={() => handleShare(platform)}>
                  <Text style={styles.shareBtnEmoji}>{emoji}</Text>
                  <Text style={styles.shareBtnLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowShareModal(false)}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 12, color: "#6b7280", fontSize: 15 },
  errorText: { color: "#dc2626", fontSize: 16, textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: "#667eea", borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: "#fff", fontWeight: "700" },

  backBtn: { position: "absolute", top: 12, left: 12, zIndex: 10, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  backBtnText: { fontWeight: "700", color: "#1f2937" },

  heroWrapper: { width: "100%", height: 280, position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroActions: { position: "absolute", top: 52, right: 12, gap: 8 },
  heroBtn: { width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8, elevation: 3 },
  heroBtnActive: { backgroundColor: "#fef2f2", borderWidth: 2, borderColor: "#ef4444" },
  heroBtnIcon: { fontSize: 18 },

  thumbnailList: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#f9fafb" },
  thumbnail: { width: 70, height: 70, borderRadius: 8, marginRight: 8, borderWidth: 2, borderColor: "transparent" },
  thumbnailActive: { borderColor: "#667eea" },

  content: { padding: 16 },

  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginRight: 4 },
  badgeCategory: { backgroundColor: "#3b82f6" },
  badgeTrending: { backgroundColor: "#ef4444" },
  badgeEarlyBird: { backgroundColor: "#f59e0b" },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  title: { fontSize: 22, fontWeight: "700", color: "#1f2937", lineHeight: 30, marginBottom: 10 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tag: { backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#d1d5db" },
  tagText: { color: "#374151", fontSize: 11, fontWeight: "600" },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 12 },

  infoGrid: { gap: 12 },
  infoItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  infoIcon: { fontSize: 20 },
  infoLabel: { color: "#6b7280", fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  infoValue: { color: "#1f2937", fontSize: 15, fontWeight: "600" },

  description: { color: "#374151", fontSize: 15, lineHeight: 24 },

  venueCard: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, gap: 10 },
  venueName: { color: "#374151", fontSize: 15, fontWeight: "600" },
  parkingInfo: { gap: 4 },
  parkingHeader: { color: "#374151", fontWeight: "700", fontSize: 14 },
  parkingText: { color: "#6b7280", fontSize: 13 },
  directionsBtn: { backgroundColor: "#667eea", borderRadius: 10, padding: 12, alignItems: "center", marginTop: 4 },
  directionsBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  mapWrapper: { borderRadius: 12, overflow: "hidden", height: 280, borderWidth: 1, borderColor: "#e5e7eb" },
  map: { flex: 1 },
  markerContainer: { alignItems: "center" },
  markerPin: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E63946", borderWidth: 3, borderColor: "#fff" },
  mapLinkBtn: { marginTop: 10, backgroundColor: "#f3f4f6", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  mapLinkBtnText: { color: "#374151", fontWeight: "600", fontSize: 14 },

  ticketCard: { backgroundColor: "#f3f4f6", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: "transparent" },
  ticketCardSoldOut: { opacity: 0.5 },
  ticketCardEarlyBird: { borderColor: "#22c55e" },
  ticketCardSelected: { borderColor: "#667eea", backgroundColor: "#eff6ff" },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  ticketName: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  earlyBirdLabel: { backgroundColor: "#22c55e", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  earlyBirdLabelText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  ticketPrice: { fontSize: 18, fontWeight: "800", color: "#10b981", marginBottom: 4 },
  ticketDescription: { color: "#6b7280", fontSize: 13, marginBottom: 8 },
  ticketFooter: { flexDirection: "row", gap: 8 },
  ticketSoldOut: { color: "#991b1b", fontWeight: "700" },
  ticketAvailable: { color: "#059669", fontWeight: "600", fontSize: 13 },
  lowStock: { color: "#d97706", fontWeight: "600", fontSize: 13 },

  organizerCard: { flexDirection: "row", backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, gap: 12 },
  organizerAvatar: { width: 60, height: 60, borderRadius: 30 },
  organizerInfo: { flex: 1, gap: 4 },
  organizerName: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  verifiedBadge: { color: "#10b981", fontWeight: "700" },
  organizerRating: { color: "#6b7280", fontSize: 13 },
  contactBtn: { backgroundColor: "#667eea", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", marginTop: 4 },
  contactBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  similarCard: { width: 160, marginRight: 12, backgroundColor: "#f9fafb", borderRadius: 10, overflow: "hidden" },
  similarImage: { width: "100%", height: 100 },
  similarTitle: { fontSize: 13, fontWeight: "600", color: "#1f2937", padding: 8, paddingBottom: 2 },
  similarDate: { fontSize: 11, color: "#6b7280", paddingHorizontal: 8 },
  similarPrice: { fontSize: 12, fontWeight: "700", color: "#10b981", padding: 8, paddingTop: 2 },

  stickyBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#e5e7eb", padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", elevation: 10 },
  stickyPriceLabel: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  stickyPriceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stickyPriceOld: { color: "#9ca3af", fontSize: 14, textDecorationLine: "line-through" },
  stickyPrice: { color: "#1f2937", fontSize: 20, fontWeight: "800" },
  bookBtn: { backgroundColor: "#667eea", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  bookBtnSoldOut: { backgroundColor: "#9ca3af" },
  bookBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  shareModal: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  shareModalTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 16, textAlign: "center" },
  shareBtnsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 16 },
  shareBtn: { alignItems: "center", width: 70 },
  shareBtnEmoji: { fontSize: 32, marginBottom: 4 },
  shareBtnLabel: { color: "#374151", fontSize: 12, fontWeight: "600" },
  closeModalBtn: { backgroundColor: "#f3f4f6", borderRadius: 10, padding: 14, alignItems: "center" },
  closeModalBtnText: { color: "#374151", fontWeight: "700", fontSize: 15 },
});

export default EventDetails;