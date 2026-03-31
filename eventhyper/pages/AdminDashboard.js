// pages/AdminDashboard.js (React Native)
// Matches web version: has NotificationBell in header, all same routes
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import Sidebar from "./Sidebar";
import DashboardHome from "./DashboardHome";
import Events from "./Events";
import Bookings from "./Bookings";
import Users from "./Users";
import Payments from "./Payments";
import Reports from "./Reports";
import Settings from "./Settings";
import Support from "./Support";
import TicketScanner from "./TicketScanner";
import ChatbotWidget from "./ChatbotWidget";
import NotificationBell from "./NotificationBell";

const Drawer = createDrawerNavigator();

// ─── Header with NotificationBell (matches web AdminDashboard header) ─────────
const DashboardHeader = ({ title, currentUser }) => (
  <View style={styles.dashboardHeader}>
    <Text style={styles.dashboardTitle}>{title}</Text>
    <View style={styles.headerRight}>
      {currentUser && <NotificationBell user={currentUser} />}
    </View>
  </View>
);

// ─── Screen wrapper that injects the header ───────────────────────────────────
const ScreenWithHeader = ({ title, currentUser, children }) => (
  <View style={{ flex: 1 }}>
    <DashboardHeader title={title} currentUser={currentUser} />
    {children}
  </View>
);

const AdminDashboard = ({ onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      // ✅ AsyncStorage instead of localStorage
      const role = await AsyncStorage.getItem("role");
      const id = await AsyncStorage.getItem("userId");
      setCurrentUser({ id: Number(id), role });
    };
    loadUser();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Drawer.Navigator
        drawerContent={(props) => (
          <Sidebar
            {...props}
            onLogout={onLogout}
            onClose={() => props.navigation.closeDrawer()}
          />
        )}
        screenOptions={{
          headerStyle: { backgroundColor: "#0d47a1" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          drawerType: "slide",
        }}
      >
        {/* Dashboard Home */}
        <Drawer.Screen name="AdminHome" options={{ title: "Dashboard" }}>
          {() => (
            <ScreenWithHeader title="Admin Dashboard" currentUser={currentUser}>
              <DashboardHome />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Events */}
        <Drawer.Screen name="AdminEvents" options={{ title: "Events" }}>
          {() => (
            <ScreenWithHeader title="Events" currentUser={currentUser}>
              <Events currentUser={currentUser} />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Bookings */}
        <Drawer.Screen name="AdminBookings" options={{ title: "Bookings" }}>
          {() => (
            <ScreenWithHeader title="Bookings" currentUser={currentUser}>
              <Bookings />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Users */}
        <Drawer.Screen name="AdminUsers" options={{ title: "Users" }}>
          {() => (
            <ScreenWithHeader title="Users" currentUser={currentUser}>
              <Users />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Payments */}
        <Drawer.Screen name="AdminPayments" options={{ title: "Payments" }}>
          {() => (
            <ScreenWithHeader title="Payments" currentUser={currentUser}>
              <Payments />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Reports */}
        <Drawer.Screen name="AdminReports" options={{ title: "Reports" }}>
          {() => (
            <ScreenWithHeader title="Reports" currentUser={currentUser}>
              <Reports />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Settings */}
        <Drawer.Screen name="AdminSettings" options={{ title: "Settings" }}>
          {() => (
            <ScreenWithHeader title="Settings" currentUser={currentUser}>
              <Settings currentUser={currentUser} />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Support */}
        <Drawer.Screen name="AdminSupport" options={{ title: "Support" }}>
          {() => (
            <ScreenWithHeader title="Support" currentUser={currentUser}>
              <Support currentUser={currentUser} />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Scan Tickets */}
        <Drawer.Screen name="AdminScan" options={{ title: "Scan Tickets" }}>
          {() => (
            <ScreenWithHeader title="Scan Tickets" currentUser={currentUser}>
              <TicketScanner />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>
      </Drawer.Navigator>

      {/* Floating Chatbot — same as web version */}
      {currentUser && <ChatbotWidget user={currentUser} />}
    </View>
  );
};

const styles = StyleSheet.create({
  dashboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    elevation: 2,
  },
  dashboardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default AdminDashboard;