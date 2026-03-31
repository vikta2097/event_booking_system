// pages/AdminDashboard.js (React Native)
// Uses React Navigation Drawer for sidebar
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

const AdminDashboard = ({ onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
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
          <Sidebar {...props} onLogout={onLogout} onClose={() => props.navigation.closeDrawer()} />
        )}
        screenOptions={{
          headerStyle: { backgroundColor: "#0d47a1" },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          drawerType: "slide",
        }}
      >
        <Drawer.Screen name="AdminHome" options={{ title: "Dashboard" }}>
          {() => <DashboardHome />}
        </Drawer.Screen>
        <Drawer.Screen name="AdminEvents" options={{ title: "Events" }}>
          {() => <Events currentUser={currentUser} />}
        </Drawer.Screen>
        <Drawer.Screen name="AdminBookings" options={{ title: "Bookings" }}>
          {() => <Bookings />}
        </Drawer.Screen>
        <Drawer.Screen name="AdminUsers" options={{ title: "Users" }}>
          {() => <Users />}
        </Drawer.Screen>
        <Drawer.Screen name="AdminPayments" options={{ title: "Payments" }}>
          {() => <Payments />}
        </Drawer.Screen>
        <Drawer.Screen name="AdminReports" options={{ title: "Reports" }}>
          {() => <Reports />}
        </Drawer.Screen>
        <Drawer.Screen name="AdminSettings" options={{ title: "Settings" }}>
          {() => <Settings currentUser={currentUser} />}
        </Drawer.Screen>
        <Drawer.Screen name="AdminSupport" options={{ title: "Support" }}>
          {() => <Support currentUser={currentUser} />}
        </Drawer.Screen>
        <Drawer.Screen name="AdminScan" options={{ title: "Scan Tickets" }}>
          {() => <TicketScanner />}
        </Drawer.Screen>
      </Drawer.Navigator>

      {/* Floating Chatbot */}
      {currentUser && <ChatbotWidget user={currentUser} />}
    </View>
  );
};

export default AdminDashboard;