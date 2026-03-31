// pages/UserDashboard.js (React Native)
import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
} from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import UserDashboardHome from "./UserDashboardHome";
import EventDetails from "./EventDetails";
import BookingForm from "./BookingForm";
import PaymentPage from "./PaymentPage";
import BookingSuccess from "./BookingSuccess";
import UserBookings from "./UserBookings";
import ContactUs from "./ContactUs";
import NotificationBell from "./NotificationBell"; // ✅ Uncommented — matches web version

const Stack = createNativeStackNavigator();

// ─── Top Bar — matches web UserDashboard top bar exactly ─────────────────────
const TopBar = ({ user, onLogout }) => {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.topBarSafe}>
      <View style={styles.topBar}>
        {/* Brand title — navigates home like web */}
        <TouchableOpacity onPress={() => navigation.navigate("UserHome")}>
          <Text style={styles.brandTitle}>EventHyper</Text>
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          {user ? (
            <>
              {/* My Bookings button */}
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => navigation.navigate("UserBookings")}
              >
                <Text style={styles.topBarBtnText}>My Bookings</Text>
              </TouchableOpacity>

              {/* ✅ NotificationBell — now active, matches web */}
              <NotificationBell user={user} />

              {/* Logout */}
              <TouchableOpacity
                style={[styles.topBarBtn, styles.logoutBtn]}
                onPress={onLogout}
              >
                <Text style={styles.topBarBtnText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Login button (guest) */}
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.topBarBtnText}>Login</Text>
              </TouchableOpacity>

              {/* Sign Up button (guest) — matches web */}
              <TouchableOpacity
                style={[styles.topBarBtn, styles.signupBtn]}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.topBarBtnText}>Sign Up</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

// ─── UserDashboard Navigator ──────────────────────────────────────────────────
const UserDashboard = ({ user, token, onLogout, navigation: rootNav }) => {
  const handleLogout = () => {
    onLogout();
    rootNav?.navigate("Login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Top bar shown on all screens — same as web fixed top bar */}
      <TopBar user={user} onLogout={handleLogout} />

      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="UserHome"
      >
        <Stack.Screen name="UserHome">
          {(props) => <UserDashboardHome {...props} user={user} />}
        </Stack.Screen>

        <Stack.Screen name="EventDetails">
          {(props) => <EventDetails {...props} user={user} />}
        </Stack.Screen>

        <Stack.Screen name="BookEvent">
          {(props) =>
            user ? (
              <BookingForm {...props} user={user} />
            ) : (
              props.navigation.replace("Login")
            )
          }
        </Stack.Screen>

        <Stack.Screen name="Payment">
          {(props) =>
            user ? (
              <PaymentPage {...props} user={user} />
            ) : (
              props.navigation.replace("Login")
            )
          }
        </Stack.Screen>

        <Stack.Screen name="BookingSuccess">
          {(props) =>
            user ? (
              <BookingSuccess {...props} user={user} />
            ) : (
              props.navigation.replace("Login")
            )
          }
        </Stack.Screen>

        <Stack.Screen name="UserBookings">
          {(props) =>
            user ? (
              <UserBookings {...props} user={user} />
            ) : (
              props.navigation.replace("Login")
            )
          }
        </Stack.Screen>

        <Stack.Screen name="Contact" component={ContactUs} />
      </Stack.Navigator>
    </View>
  );
};

const styles = StyleSheet.create({
  topBarSafe: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brandTitle: { fontSize: 22, fontWeight: "700", color: "#0077ff" },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  topBarBtn: {
    backgroundColor: "#0077ff",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  logoutBtn: { backgroundColor: "#d9534f" },
  signupBtn: { backgroundColor: "#10b981" },
  topBarBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});

export default UserDashboard;