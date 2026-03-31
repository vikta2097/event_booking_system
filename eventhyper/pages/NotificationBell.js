import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { Bell, X, Check, CheckCheck, Trash2, Volume2, VolumeX } from "lucide-react-native";
import io from "socket.io-client";
import api from "../api";

const NotificationBell = ({ user }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [soundEnabled, setSoundEnabled] = useState(true);

  const socketRef = useRef(null);
  const dropdownAnim = useRef(new Animated.Value(0)).current;

  // =========================
  // FETCH DATA
  // =========================
  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      fetchUnreadCount();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.error(err);
    }
  };

  // =========================
  // SOCKET.IO
  // =========================
  useEffect(() => {
    if (!user?.id) return;

    const socket = io("http://localhost:3300", {
      transports: ["websocket"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_user_room", user.id);
    });

    const handleNewNotification = (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("notification", handleNewNotification);
    socket.on("broadcast_notification", handleNewNotification);

    socket.on("notification_read", ({ id }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });

    socket.on("notifications_read_all", () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    });

    socket.on("notification_deleted", ({ id }) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    });

    socket.on("notifications_cleared", () => {
      setNotifications([]);
      setUnreadCount(0);
    });

    return () => socket.disconnect();
  }, [user]);

  // =========================
  // DROPDOWN ANIMATION
  // =========================
  const toggleDropdown = () => {
    setIsOpen(!isOpen);

    Animated.timing(dropdownAnim, {
      toValue: isOpen ? 0 : 1,
      duration: 200,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  };

  const dropdownStyle = {
    opacity: dropdownAnim,
    transform: [
      {
        translateY: dropdownAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, 0],
        }),
      },
    ],
  };

  // =========================
  // ACTIONS
  // =========================
  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const clearAll = () => {
    Alert.alert("Confirm", "Delete all notifications?", [
      { text: "Cancel" },
      {
        text: "Yes",
        onPress: async () => {
          try {
            await api.delete("/notifications");
            setNotifications([]);
            setUnreadCount(0);
          } catch (err) {
            console.error(err);
          }
        },
      },
    ]);
  };

  // =========================
  // HELPERS
  // =========================
  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const diff = (new Date() - date) / 60000;

    if (diff < 1) return "Just now";
    if (diff < 60) return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "read") return n.is_read;
    return true;
  });

  // =========================
  // UI
  // =========================
  return (
    <View style={styles.container}>
      {/* Bell */}
      <TouchableOpacity style={styles.bell} onPress={toggleDropdown}>
        <Bell size={22} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown */}
      {isOpen && (
        <Animated.View style={[styles.dropdown, dropdownStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>

            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setSoundEnabled(!soundEnabled)}>
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </TouchableOpacity>

              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllAsRead}>
                  <CheckCheck size={16} />
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={clearAll}>
                <Trash2 size={16} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filters */}
          <View style={styles.filters}>
            {["all", "unread", "read"].map((f) => (
              <TouchableOpacity key={f} onPress={() => setFilter(f)}>
                <Text style={filter === f ? styles.activeFilter : styles.filter}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* List */}
          <ScrollView style={styles.list}>
            {filteredNotifications.length === 0 ? (
              <Text style={styles.empty}>No notifications</Text>
            ) : (
              filteredNotifications.map((n) => (
                <View
                  key={n.id}
                  style={[styles.item, !n.is_read && styles.unread]}
                >
                  <Text style={styles.icon}>🔔</Text>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{n.title}</Text>
                    <Text style={styles.message}>{n.message}</Text>
                    <Text style={styles.time}>
                      {getTimeAgo(n.created_at)}
                    </Text>
                  </View>

                  <View style={styles.itemActions}>
                    {!n.is_read && (
                      <TouchableOpacity onPress={() => markAsRead(n.id)}>
                        <Check size={14} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={() => deleteNotification(n.id)}>
                      <X size={14} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => setIsOpen(false)}>
              <Text style={{ color: "white" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default NotificationBell;

// =========================
// STYLES
// =========================
const styles = StyleSheet.create({
  container: { position: "relative" },

  bell: {
    width: 44,
    height: 44,
    backgroundColor: "#fff",
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },

  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#ef4444",
    borderRadius: 999,
    paddingHorizontal: 6,
  },

  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  dropdown: {
    position: "absolute",
    top: 50,
    right: 0,
    width: 320,
    maxHeight: 400,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 6,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#fafafa",
  },

  headerTitle: { fontWeight: "600" },

  actions: { flexDirection: "row", gap: 10 },

  filters: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 5,
  },

  filter: { color: "#555" },
  activeFilter: { fontWeight: "bold" },

  list: { maxHeight: 280 },

  item: {
    flexDirection: "row",
    padding: 8,
    gap: 8,
    alignItems: "flex-start",
  },

  unread: { backgroundColor: "#f0fdf4" },

  icon: { fontSize: 18 },

  title: { fontWeight: "600", fontSize: 13 },
  message: { fontSize: 12, color: "#555" },
  time: { fontSize: 10, color: "#999" },

  itemActions: { gap: 6 },

  footer: {
    padding: 8,
    backgroundColor: "#10b981",
    alignItems: "center",
  },

  empty: { textAlign: "center", padding: 20, color: "#999" },
});