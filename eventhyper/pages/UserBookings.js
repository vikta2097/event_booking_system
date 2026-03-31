import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  FlatList,
} from "react-native";
import QRCode from "react-native-qrcode-svg"; // npm install react-native-qrcode-svg
import { useNavigation } from "@react-navigation/native";
import api from "../api";

const UserBookings = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const navigation = useNavigation();

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get("/bookings");
        const bookingsData = res.data;

        const bookingsWithPayment = await Promise.all(
          bookingsData.map(async (b) => {
            try {
              const paymentRes = await api.get(`/payments/by-booking/${b.id}`);
              return { ...b, paymentStatus: paymentRes.data?.status || null };
            } catch {
              return { ...b, paymentStatus: null };
            }
          })
        );

        setBookings(bookingsWithPayment);
        setFilteredBookings(bookingsWithPayment);
      } catch (err) {
        console.error("Error fetching bookings:", err);
        setError("Failed to load bookings. Try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  useEffect(() => {
    let filtered = bookings;
    const now = new Date();

    switch (activeTab) {
      case "upcoming":
        filtered = bookings.filter((b) => {
          const eventDate = new Date(b.event_date);
          return eventDate >= now && b.booking_status !== "cancelled";
        });
        break;
      case "past":
        filtered = bookings.filter((b) => {
          const eventDate = new Date(b.event_date);
          return eventDate < now && b.booking_status !== "cancelled";
        });
        break;
      case "pending":
        filtered = bookings.filter(
          (b) => b.booking_status === "pending" && b.paymentStatus !== "success"
        );
        break;
      case "cancelled":
        filtered = bookings.filter((b) => b.booking_status === "cancelled");
        break;
      default:
        filtered = bookings;
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (b) =>
          b.event_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
          b.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
  }, [activeTab, bookings, searchQuery]);

  const handleAddToCalendar = (booking) => {
    const startDate = new Date(`${booking.event_date}T${booking.start_time}`);
    const endDate = new Date(
      `${booking.event_date}T${booking.end_time || booking.start_time}`
    );

    const formatDate = (date) =>
      date.toISOString().replace(/-|:|\.\d+/g, "");

    const title = encodeURIComponent(booking.event_title);
    const location = encodeURIComponent(booking.venue || booking.location || "");
    const details = encodeURIComponent(
      `Booking Reference: ${booking.reference}\nSeats: ${booking.seats}`
    );

    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${details}&location=${location}`;
    Linking.openURL(url);
  };

  const handleGetDirections = (booking) => {
    if (booking.venue || booking.location) {
      const query = encodeURIComponent(booking.venue || booking.location);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    } else {
      Alert.alert("Directions", "Location information not available");
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusStyle = (booking) => {
    if (booking.booking_status === "cancelled") return styles.statusCancelled;
    if (booking.booking_status === "confirmed" || booking.paymentStatus === "success")
      return styles.statusConfirmed;
    if (booking.booking_status === "pending") return styles.statusPending;
    return {};
  };

  const getStatusText = (booking) => {
    if (booking.booking_status === "cancelled") return "Cancelled";
    if (booking.booking_status === "confirmed" || booking.paymentStatus === "success")
      return "Confirmed";
    if (booking.booking_status === "pending") return "Payment Pending";
    return booking.booking_status;
  };

  const tabCounts = {
    upcoming: bookings.filter(
      (b) => new Date(b.event_date) >= new Date() && b.booking_status !== "cancelled"
    ).length,
    past: bookings.filter(
      (b) => new Date(b.event_date) < new Date() && b.booking_status !== "cancelled"
    ).length,
    pending: bookings.filter(
      (b) => b.booking_status === "pending" && b.paymentStatus !== "success"
    ).length,
    cancelled: bookings.filter((b) => b.booking_status === "cancelled").length,
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading your bookings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.btnRetry}
          onPress={() => {
            setLoading(true);
            setError("");
          }}
        >
          <Text style={styles.btnRetryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>My Bookings</Text>
        <View style={styles.centerContainer}>
          <Text style={styles.noBookingsIcon}>🎫</Text>
          <Text style={styles.noBookingsTitle}>No Bookings Yet</Text>
          <Text style={styles.noBookingsSubtitle}>
            You haven't booked any events yet. Start exploring!
          </Text>
          <TouchableOpacity
            style={styles.btnExplore}
            onPress={() => navigation.navigate("Dashboard")}
          >
            <Text style={styles.btnExploreText}>Explore Events</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const renderBookingCard = ({ item: booking }) => (
    <View
      style={[
        styles.bookingCard,
        booking.booking_status === "confirmed" || booking.paymentStatus === "success"
          ? styles.cardConfirmed
          : booking.booking_status === "pending"
          ? styles.cardPending
          : booking.booking_status === "cancelled"
          ? styles.cardCancelled
          : {},
      ]}
    >
      {/* Image / Placeholder */}
      <View style={styles.bookingImageContainer}>
        {booking.event_image ? (
          <Image
            source={{ uri: booking.event_image }}
            style={styles.bookingImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.bookingImagePlaceholder}>
            <Text style={styles.placeholderEmoji}>🎭</Text>
          </View>
        )}
        <View style={[styles.statusBadge, getStatusStyle(booking)]}>
          <Text style={styles.statusBadgeText}>{getStatusText(booking)}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.bookingContent}>
        <View style={styles.bookingHeaderInfo}>
          <Text style={styles.bookingTitle}>{booking.event_title}</Text>
          <Text style={styles.bookingReference}>Ref: {booking.reference}</Text>
        </View>

        {/* Details Grid */}
        <View style={styles.detailsGrid}>
          {[
            { icon: "📅", label: "Date", value: formatDate(booking.event_date) },
            {
              icon: "⏰",
              label: "Time",
              value: `${formatTime(booking.start_time)}${booking.end_time ? ` - ${formatTime(booking.end_time)}` : ""}`,
            },
            {
              icon: "📍",
              label: "Venue",
              value: booking.venue || booking.location || "TBA",
            },
            {
              icon: "🎫",
              label: "Tickets",
              value: `${booking.seats} ticket${booking.seats > 1 ? "s" : ""}`,
            },
            {
              icon: "💰",
              label: "Total Paid",
              value: `KES ${parseFloat(booking.total_amount).toLocaleString()}`,
              isAmount: true,
            },
            {
              icon: "📆",
              label: "Booked On",
              value: new Date(booking.booking_date).toLocaleDateString(),
            },
          ].map(({ icon, label, value, isAmount }) => (
            <View key={label} style={styles.detailItem}>
              <Text style={styles.detailIcon}>{icon}</Text>
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={[styles.detailValue, isAmount && styles.detailAmount]}>
                  {value}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.bookingActions}>
          {booking.booking_status === "pending" &&
            booking.paymentStatus !== "success" && (
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => navigation.navigate("Payment", { bookingId: booking.id })}
              >
                <Text style={styles.btnPrimaryText}>💳 Complete Payment</Text>
              </TouchableOpacity>
            )}

          {(booking.booking_status === "confirmed" ||
            booking.paymentStatus === "success") && (
            <>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() =>
                  navigation.navigate("BookingSuccess", { bookingId: booking.id })
                }
              >
                <Text style={styles.btnPrimaryText}>🎟️ View Tickets</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => handleAddToCalendar(booking)}
              >
                <Text style={styles.btnSecondaryText}>📅 Add to Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => handleGetDirections(booking)}
              >
                <Text style={styles.btnSecondaryText}>📍 Get Directions</Text>
              </TouchableOpacity>
            </>
          )}

          {booking.booking_status !== "cancelled" && (
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() =>
                navigation.navigate("EventDetails", { eventId: booking.event_id })
              }
            >
              <Text style={styles.btnSecondaryText}>👁️ Event Details</Text>
            </TouchableOpacity>
          )}

          {booking.booking_status === "cancelled" && (
            <View style={styles.cancelledNote}>
              <Text style={styles.cancelledNoteText}>
                This booking has been cancelled
              </Text>
            </View>
          )}
        </View>

        {/* QR Preview */}
        {(booking.booking_status === "confirmed" ||
          booking.paymentStatus === "success") &&
          booking.tickets &&
          booking.tickets.length > 0 && (
            <View style={styles.ticketsPreview}>
              <Text style={styles.previewLabel}>Quick Preview:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {booking.tickets.slice(0, 3).map((ticket) => (
                  <View key={ticket.id} style={styles.ticketPreviewItem}>
                    <QRCode value={ticket.qr_code} size={60} />
                    <Text style={styles.ticketPreviewName}>{ticket.ticket_name}</Text>
                  </View>
                ))}
                {booking.tickets.length > 3 && (
                  <View style={styles.moreTickets}>
                    <Text style={styles.moreTicketsText}>
                      +{booking.tickets.length - 3} more
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>My Bookings</Text>
          <Text style={styles.subtitle}>Manage your event tickets</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by event, reference, location..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearch}
            onPress={() => setSearchQuery("")}
          >
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {[
          { key: "upcoming", label: `Upcoming (${tabCounts.upcoming})` },
          { key: "past", label: `Past (${tabCounts.past})` },
          { key: "pending", label: `Pending (${tabCounts.pending})` },
          { key: "cancelled", label: `Cancelled (${tabCounts.cancelled})` },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.noResultsText}>
            No bookings found{searchQuery ? ` for "${searchQuery}"` : " in this category"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const PURPLE = "#764ba2";
const BLUE = "#667eea";
const GREEN = "#10b981";
const YELLOW = "#f59e0b";
const RED = "#ef4444";
const GRAY = "#6b7280";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  listContent: { padding: 16, paddingBottom: 32 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  pageTitle: { fontSize: 24, fontWeight: "700", color: "#1f2937" },
  subtitle: { fontSize: 14, color: GRAY, marginTop: 2 },

  // Search
  searchContainer: {
    margin: 16,
    marginBottom: 8,
    position: "relative",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
    paddingRight: 48,
    fontSize: 15,
    color: "#1f2937",
  },
  clearSearch: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -14,
    backgroundColor: RED,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  clearSearchText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Tabs
  tabsContainer: { paddingHorizontal: 16, marginBottom: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  tabActive: { backgroundColor: "#eff6ff" },
  tabText: { color: GRAY, fontWeight: "500", fontSize: 14 },
  tabTextActive: { color: "#3b82f6" },

  // Booking Card
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 2,
    borderColor: "transparent",
  },
  cardConfirmed: { borderColor: GREEN },
  cardPending: { borderColor: YELLOW },
  cardCancelled: { borderColor: RED, opacity: 0.8 },

  // Image
  bookingImageContainer: { width: "100%", height: 180, position: "relative" },
  bookingImage: { width: "100%", height: "100%" },
  bookingImagePlaceholder: {
    flex: 1,
    backgroundColor: "#667eea",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderEmoji: { fontSize: 52 },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
  },
  statusConfirmed: { backgroundColor: "rgba(16,185,129,0.9)" },
  statusPending: { backgroundColor: "rgba(245,158,11,0.9)" },
  statusCancelled: { backgroundColor: "rgba(239,68,68,0.9)" },

  // Content
  bookingContent: { padding: 16 },
  bookingHeaderInfo: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 6,
  },
  bookingReference: {
    fontSize: 13,
    color: GRAY,
    fontFamily: "monospace",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },

  // Details
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "47%",
    gap: 8,
  },
  detailIcon: { fontSize: 18 },
  detailText: { flex: 1 },
  detailLabel: {
    fontSize: 11,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "500",
    marginBottom: 2,
  },
  detailValue: { fontSize: 14, color: "#1f2937", fontWeight: "500" },
  detailAmount: { color: GREEN, fontWeight: "700", fontSize: 16 },

  // Actions
  bookingActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  btnPrimary: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: BLUE,
    shadowColor: BLUE,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnSecondary: {
    flex: 1,
    minWidth: 140,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  btnSecondaryText: { color: "#374151", fontWeight: "600", fontSize: 13 },

  // Cancelled Note
  cancelledNote: {
    flex: 1,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
  },
  cancelledNoteText: { color: "#991b1b", fontWeight: "500" },

  // QR Preview
  ticketsPreview: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  previewLabel: { fontSize: 13, color: GRAY, fontWeight: "500", marginBottom: 10 },
  ticketPreviewItem: {
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 10,
    gap: 6,
  },
  ticketPreviewName: { fontSize: 11, color: GRAY, textAlign: "center" },
  moreTickets: {
    padding: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  moreTicketsText: { color: "#3b82f6", fontWeight: "700", fontSize: 13 },

  // Loading / Error / Empty states
  loadingText: { color: GRAY, marginTop: 12, fontSize: 15 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { color: RED, fontSize: 15, textAlign: "center", marginBottom: 16 },
  btnRetry: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },
  btnRetryText: { color: "#fff", fontWeight: "700" },
  noBookingsIcon: { fontSize: 64, marginBottom: 16 },
  noBookingsTitle: { fontSize: 22, fontWeight: "700", color: "#1f2937", marginBottom: 8 },
  noBookingsSubtitle: { fontSize: 15, color: GRAY, textAlign: "center", marginBottom: 24 },
  btnExplore: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: BLUE,
    borderRadius: 12,
  },
  btnExploreText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  noResultsText: { color: GRAY, fontSize: 15, textAlign: "center" },
});

export default UserBookings;