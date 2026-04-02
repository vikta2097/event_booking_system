import React, { useState, useEffect } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Share, Linking, Alert
} from "react-native";
import { useNavigation } from "@react-navigation/native";

const EventCard = ({ event, user, onSaveToFavorites }) => {
  const navigation = useNavigation();
  const [timeUntilEvent, setTimeUntilEvent] = useState("");
  const [isFavorite, setIsFavorite] = useState(event.is_favorited || false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!event.event_date || !event.start_time) { setTimeUntilEvent(""); return; }
      const eventDateTime = new Date(`${event.event_date}T${event.start_time}`);
      if (isNaN(eventDateTime.getTime())) { setTimeUntilEvent(""); return; }
      const diff = eventDateTime - new Date();
      if (diff <= 0) { setTimeUntilEvent("Started"); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) setTimeUntilEvent(`${days}d ${hours}h`);
      else if (hours > 0) setTimeUntilEvent(`${hours}h ${minutes}m`);
      else setTimeUntilEvent(`${minutes}m`);
    };
    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [event.event_date, event.start_time]);

  const availableSeats = event.capacity - (event.total_seats_booked || 0);
  const capacityPercentage = event.capacity > 0 ? ((event.total_seats_booked || 0) / event.capacity) * 100 : 0;
  const isSoldOut = availableSeats <= 0;
  const isAlmostFull = capacityPercentage >= 80 && !isSoldOut;
  const isLowSeats = availableSeats <= 10 && availableSeats > 0;
  const isEarlyBirdActive = event.is_early_bird && event.early_bird_deadline && new Date(event.early_bird_deadline) >= new Date();
  const earlyBirdSavings = isEarlyBirdActive && event.early_bird_price
    ? Math.round(((event.price - event.early_bird_price) / event.price) * 100) : 0;
  const eventTags = event.tags_display ? event.tags_display.split(", ").filter(Boolean).slice(0, 3) : [];

  const handleBookNow = () => {
    if (isSoldOut) return;
    if (!user) navigation.navigate("Login");
    else navigation.navigate("BookingForm", { id: event.id });
  };

  const handleCardPress = () => navigation.navigate("EventDetails", { id: event.id });

  const handleFavorite = () => {
    setIsFavorite(!isFavorite);
    if (onSaveToFavorites) onSaveToFavorites(event.id, !isFavorite);
  };

  const handleShare = async () => {
    try {
      await Share.share({ title: event.title, message: `Check out this event: ${event.title}` });
    } catch {}
  };

  // ── UPDATED: uses lat/lng first (matches web version) ──
  const handleDirections = () => {
    if (event.latitude && event.longitude) {
      // Precise coordinates from DB — opens Google Maps directions
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
      );
    } else if (event.map_link) {
      let url = event.map_link;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      Linking.openURL(url);
    } else if (event.venue || event.location) {
      const query = encodeURIComponent(event.venue || event.location);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    } else {
      Alert.alert("Location not available", "This event has no location information.");
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-GB", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return "Free";
    return `From KES ${Number(price).toLocaleString()}`;
  };

  const getStatusBadge = () => {
    if (isSoldOut) return { text: "Sold Out", bg: "rgba(239,68,68,0.92)" };
    if (isEarlyBirdActive) return { text: `🎉 Save ${earlyBirdSavings}%`, bg: "rgba(245,158,11,0.92)" };
    if (event.is_trending) return { text: "🔥 Trending", bg: "rgba(239,68,68,0.92)" };
    if (isAlmostFull) return { text: "Almost Full", bg: "rgba(245,158,11,0.92)" };
    return null;
  };

  const statusBadge = getStatusBadge();

  return (
    <TouchableOpacity style={styles.card} onPress={handleCardPress} activeOpacity={0.9}>
      {/* Image */}
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: event.image || "https://via.placeholder.com/400x240" }}
          style={styles.image}
          resizeMode="cover"
        />
        {/* Badges */}
        <View style={styles.badgesTop}>
          {statusBadge && (
            <View style={[styles.badge, { backgroundColor: statusBadge.bg }]}>
              <Text style={styles.badgeText}>{statusBadge.text}</Text>
            </View>
          )}
          {event.category_name && (
            <View style={[styles.badge, styles.badgeCategory]}>
              <Text style={styles.badgeText}>{event.category_name}</Text>
            </View>
          )}
        </View>
        {/* Action Buttons */}
        <View style={styles.actionBtns}>
          <TouchableOpacity style={[styles.actionBtn, isFavorite && styles.actionBtnFav]} onPress={handleFavorite}>
            <Text style={styles.actionBtnIcon}>{isFavorite ? "❤️" : "🤍"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Text style={styles.actionBtnIcon}>📤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleDirections}>
            <Text style={styles.actionBtnIcon}>📍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>

        {eventTags.length > 0 && (
          <View style={styles.tagsRow}>
            {eventTags.map((tag, idx) => (
              <View key={idx} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
            ))}
          </View>
        )}

        {timeUntilEvent && timeUntilEvent !== "Started" && (
          <View style={styles.countdown}>
            <Text style={styles.countdownText}>🕒 Starts in {timeUntilEvent}</Text>
          </View>
        )}

        <Text style={styles.venue} numberOfLines={1}>
          📍 {event.venue || event.location}
          {event.parking_info ? "  🅿️" : ""}
        </Text>
        <Text style={styles.date}>📅 {formatDate(event.event_date)}</Text>

        {!isSoldOut && (
          <>
            {isLowSeats && <Text style={styles.warningText}>⚠️ Only {availableSeats} seats left!</Text>}
            {isAlmostFull && !isLowSeats && <Text style={styles.infoText}>{availableSeats} seats available</Text>}
          </>
        )}

        {/* Pricing */}
        <View style={styles.pricingRow}>
          {isEarlyBirdActive && event.early_bird_price ? (
            <View>
              <Text style={styles.priceOriginal}>KES {Number(event.price).toLocaleString()}</Text>
              <Text style={styles.price}>KES {Number(event.early_bird_price).toLocaleString()}</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>Save {earlyBirdSavings}%</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.price}>{formatPrice(event.price)}</Text>
          )}
          {event.original_price && event.original_price > event.price && !isEarlyBirdActive && (
            <Text style={styles.originalPrice}>
              KES {Number(event.original_price).toLocaleString()}
              {"  "}
              <Text style={styles.discountPercent}>
                {Math.round(((event.original_price - event.price) / event.original_price) * 100)}% OFF
              </Text>
            </Text>
          )}
        </View>

        {/* Organizer */}
        {event.organizer_name && (
          <View style={styles.organizer}>
            <Text style={styles.organizerName}>
              👤 {event.organizer_name}
              {event.is_verified_organizer ? <Text style={styles.verifiedBadge}> ✓</Text> : null}
            </Text>
            {event.organizer_rating && (
              <Text style={styles.rating}>
                ⭐ {event.organizer_rating.toFixed(1)}
                {event.organizer_event_count ? ` · ${event.organizer_event_count} events` : ""}
              </Text>
            )}
          </View>
        )}

        {/* Book Button */}
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 4, marginBottom: 16 },
  imageWrapper: { width: "100%", height: 220, position: "relative", backgroundColor: "#667eea" },
  image: { width: "100%", height: "100%" },
  badgesTop: { position: "absolute", top: 12, left: 12, right: 60, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginRight: 6, marginBottom: 4 },
  badgeCategory: { backgroundColor: "rgba(59,130,246,0.95)" },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  actionBtns: { position: "absolute", top: 10, right: 10, gap: 8 },
  actionBtn: { width: 38, height: 38, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 19, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, elevation: 3, marginBottom: 6 },
  actionBtnFav: { backgroundColor: "#fef2f2", borderWidth: 2, borderColor: "#ef4444" },
  actionBtnIcon: { fontSize: 16 },
  details: { padding: 16, gap: 8 },
  title: { fontSize: 17, fontWeight: "700", color: "#1f2937", lineHeight: 24 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#d1d5db" },
  tagText: { color: "#374151", fontSize: 11, fontWeight: "600" },
  countdown: { backgroundColor: "#fef3c7", borderRadius: 8, padding: 8, borderWidth: 1, borderColor: "#f59e0b" },
  countdownText: { color: "#92400e", fontWeight: "700", fontSize: 13, textAlign: "center" },
  venue: { color: "#6b7280", fontSize: 14 },
  date: { color: "#6b7280", fontSize: 14 },
  warningText: { color: "#dc2626", fontSize: 13, fontWeight: "600" },
  infoText: { color: "#0369a1", fontSize: 13 },
  pricingRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 },
  price: { color: "#10b981", fontSize: 20, fontWeight: "800" },
  priceOriginal: { color: "#9ca3af", fontSize: 14, textDecorationLine: "line-through" },
  originalPrice: { color: "#9ca3af", fontSize: 13, textDecorationLine: "line-through", marginTop: 2 },
  discountPercent: { color: "#ef4444", fontWeight: "700", textDecorationLine: "none" },
  discountBadge: { backgroundColor: "#10b981", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start", marginTop: 4 },
  discountBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  organizer: { backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  organizerName: { color: "#374151", fontWeight: "600", fontSize: 14 },
  verifiedBadge: { color: "#10b981", fontWeight: "700" },
  rating: { color: "#6b7280", fontSize: 13, marginTop: 2 },
  bookBtn: { backgroundColor: "#667eea", borderRadius: 12, padding: 14, alignItems: "center", marginTop: 4 },
  bookBtnSoldOut: { backgroundColor: "#9ca3af" },
  bookBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, textTransform: "uppercase", letterSpacing: 0.5 },
});

export default EventCard;