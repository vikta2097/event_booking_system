// Organizer/OrganizerDashboard.js (React Native)
// Matches web version: has NotificationBell in header, same routes
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import OrganizerSidebar from "./OrganizerSidebar";
import DashboardHome from "./DashboardHome";
import Events from "../pages/Events";
import OrganizerBookings from "./OrganizerBookings";
import OrganizerReports from "./OrganizerReports";
import TicketScanner from "../pages/TicketScanner";
import ChatbotWidget from "./ChatbotWidget";
import NotificationBell from "../pages/NotificationBell";

const Drawer = createDrawerNavigator();

// ─── Header with NotificationBell (matches web OrganizerDashboard header) ─────
const DashboardHeader = ({ currentUser }) => (
  <View style={styles.dashboardHeader}>
    <Text style={styles.dashboardTitle}>Organizer Dashboard</Text>
    <View style={styles.headerRight}>
      {/* ✅ Matches web: NotificationBell rendered with userId */}
      {currentUser && <NotificationBell user={currentUser} />}
    </View>
  </View>
);

const ScreenWithHeader = ({ currentUser, children }) => (
  <View style={{ flex: 1 }}>
    <DashboardHeader currentUser={currentUser} />
    {children}
  </View>
);

const OrganizerDashboard = ({ onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      // ✅ AsyncStorage instead of localStorage
      const role = await AsyncStorage.getItem("role");
      const id = await AsyncStorage.getItem("userId");
      setCurrentUser({ id, role });
    };
    loadUser();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Drawer.Navigator
        drawerContent={(props) => (
          <OrganizerSidebar
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
        <Drawer.Screen name="OrganizerHome" options={{ title: "Dashboard" }}>
          {() => (
            <ScreenWithHeader currentUser={currentUser}>
              <DashboardHome />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* My Events */}
        <Drawer.Screen name="OrganizerEvents" options={{ title: "My Events" }}>
          {() => (
            <ScreenWithHeader currentUser={currentUser}>
              <Events currentUser={currentUser} />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Bookings */}
        <Drawer.Screen name="OrganizerBookings" options={{ title: "Bookings" }}>
          {() => (
            <ScreenWithHeader currentUser={currentUser}>
              <OrganizerBookings currentUser={currentUser} />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Reports */}
        <Drawer.Screen name="OrganizerReports" options={{ title: "Reports" }}>
          {() => (
            <ScreenWithHeader currentUser={currentUser}>
              <OrganizerReports currentUser={currentUser} />
            </ScreenWithHeader>
          )}
        </Drawer.Screen>

        {/* Scan Tickets */}
        <Drawer.Screen name="OrganizerScan" options={{ title: "Scan Tickets" }}>
          {() => (
            <ScreenWithHeader currentUser={currentUser}>
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

export default OrganizerDashboard;