// Organizer/OrganizerDashboard.js (React Native)
import React, { useEffect, useState } from "react";
import { View } from "react-native";
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

const OrganizerDashboard = ({ onLogout }) => {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
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
        <Drawer.Screen name="OrganizerHome" options={{ title: "Dashboard" }}>
          {() => <DashboardHome />}
        </Drawer.Screen>
        <Drawer.Screen name="OrganizerEvents" options={{ title: "My Events" }}>
          {() => <Events currentUser={currentUser} />}
        </Drawer.Screen>
        <Drawer.Screen name="OrganizerBookings" options={{ title: "Bookings" }}>
          {() => <OrganizerBookings currentUser={currentUser} />}
        </Drawer.Screen>
        <Drawer.Screen name="OrganizerReports" options={{ title: "Reports" }}>
          {() => <OrganizerReports currentUser={currentUser} />}
        </Drawer.Screen>
        <Drawer.Screen name="OrganizerScan" options={{ title: "Scan Tickets" }}>
          {() => <TicketScanner />}
        </Drawer.Screen>
      </Drawer.Navigator>

      {currentUser && <ChatbotWidget user={currentUser} />}
    </View>
  );
};

export default OrganizerDashboard;