// components/Sidebar.js
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { useRoute } from "@react-navigation/native";

const Icon = ({ name }) => {
  const icons = {
    dashboard: "🏠",
    events: "📅",
    users: "👥",
    bookings: "📋",
    payments: "💳",
    scan: "🔍",
    reports: "📊",
    settings: "⚙️",
    support: "💬",
    logout: "🚪",
  };

  return <Text style={styles.icon}>{icons[name] || "•"}</Text>;
};

const navItems = [
  { name: "Dashboard", iconKey: "dashboard", screen: "AdminHome" },
  { name: "Events", iconKey: "events", screen: "Events" },
  { name: "Users", iconKey: "users", screen: "Users" },
  { name: "Bookings", iconKey: "bookings", screen: "Bookings" },
  { name: "Payments", iconKey: "payments", screen: "Payments" },
  { name: "Scan Tickets", iconKey: "scan", screen: "AdminScan" },
  { name: "Reports", iconKey: "reports", screen: "Reports" },
  { name: "Settings", iconKey: "settings", screen: "AdminSettings" },
  { name: "Support", iconKey: "support", screen: "Support" },
];

const Sidebar = ({ navigation, onLogout, onClose }) => {
  const route = useRoute();

  const handleNav = (screen) => {
    // ✅ IMPORTANT: direct Drawer navigation (NOT Stack)
    navigation.navigate(screen);
    onClose?.();
  };

  return (
    <SafeAreaView style={styles.sidebar}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Admin Panel</Text>
      </View>

      {/* Navigation */}
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {navItems.map((item) => {
          const isActive = route.name === item.screen;

          return (
            <TouchableOpacity
              key={item.screen}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => handleNav(item.screen)}
            >
              {isActive && <View style={styles.activeBar} />}
              <Icon name={item.iconKey} />
              <Text style={[styles.navText, isActive && styles.navTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Icon name="logout" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: "#0d47a1",
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  nav: {
    flex: 1,
    paddingVertical: 16,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 20,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#10b981",
    borderRadius: 2,
  },
  icon: {
    fontSize: 18,
    marginRight: 12,
  },
  navText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
    fontWeight: "500",
  },
  navTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.2)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: 12,
  },
  logoutText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  
});

export default Sidebar;