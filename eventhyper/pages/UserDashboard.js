// pages/UserDashboard.js (React Native)
import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createNativeStackNavigator, useNavigationContainerRef } from "@react-navigation/native-stack";
import { NavigationContainer } from "@react-navigation/native";

import UserDashboardHome from "./UserDashboardHome";
import EventDetails from "./EventDetails";
import BookingForm from "./BookingForm";
import PaymentPage from "./PaymentPage";
import BookingSuccess from "./BookingSuccess";
import UserBookings from "./UserBookings";
import ContactUs from "./ContactUs";
import NotificationBell from "./NotificationBell";

const Stack = createNativeStackNavigator();

// ─── Top Bar ──────────────────────────────────────────────────────────────────
// ✅ Receives innerNav prop directly from UserDashboard — avoids useNavigation()
// which would return the ROOT navigator (App.js Stack) and fail to find
// screens that only exist in the nested Stack (UserHome, UserBookings, etc.)
const TopBar = ({ user, onLogout, innerNav }) => {
  return (
    <SafeAreaView style={styles.topBarSafe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => innerNav.navigate("UserHome")}>
          <Text style={styles.brandTitle}>EventHyper</Text>
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          {user ? (
            <>
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => innerNav.navigate("UserBookings")}
              >
                <Text style={styles.topBarBtnText}>My Bookings</Text>
              </TouchableOpacity>

              <NotificationBell user={user} />

              <TouchableOpacity
                style={[styles.topBarBtn, styles.logoutBtn]}
                onPress={onLogout}
              >
                <Text style={styles.topBarBtnText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => innerNav.navigate("Login")}
              >
                <Text style={styles.topBarBtnText}>Login</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.topBarBtn, styles.signupBtn]}
                onPress={() => innerNav.navigate("Login")}
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
  // ✅ useRef holds the inner Stack's navigation object once the navigator mounts.
  // We pass this ref's current value to TopBar so it targets the correct navigator.
  const innerNavRef = useRef(null);

  const handleLogout = () => {
    onLogout();
    rootNav?.navigate("UserDashboard");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* TopBar gets innerNavRef so its buttons hit the nested Stack, not root */}
      <TopBar
        user={user}
        onLogout={handleLogout}
        innerNav={{
          navigate: (name, params) => innerNavRef.current?.navigate(name, params),
        }}
      />

      <Stack.Navigator
        initialRouteName="UserHome"
        screenOptions={{
          headerShown: false,
          gestureEnabled: false, // prevents nested navigator stealing touches on Android
        }}
      >
        {/* ── Public screens ─────────────────────────────────────────────── */}
        <Stack.Screen name="UserHome">
          {(props) => {
            // ✅ Capture the inner navigation object as soon as UserHome mounts
            innerNavRef.current = props.navigation;
            return <UserDashboardHome {...props} user={user} />;
          }}
        </Stack.Screen>

        <Stack.Screen name="Contact">
          {(props) => {
            innerNavRef.current = props.navigation;
            return <ContactUs {...props} />;
          }}
        </Stack.Screen>

        <Stack.Screen name="EventDetails">
          {(props) => {
            innerNavRef.current = props.navigation;
            return <EventDetails {...props} user={user} />;
          }}
        </Stack.Screen>

        {/* ── Auth-gated screens ─────────────────────────────────────────── */}
        <Stack.Screen name="BookEvent">
          {(props) => {
            innerNavRef.current = props.navigation;
            return user ? (
              <BookingForm {...props} user={user} />
            ) : (
              props.navigation.replace("Login")
            );
          }}
        </Stack.Screen>

        <Stack.Screen name="Payment">
          {(props) => {
            innerNavRef.current = props.navigation;
            return user ? (
              <PaymentPage {...props} user={user} />
            ) : (
              props.navigation.replace("Login")
            );
          }}
        </Stack.Screen>

        <Stack.Screen name="BookingSuccess">
          {(props) => {
            innerNavRef.current = props.navigation;
            return user ? (
              <BookingSuccess {...props} user={user} />
            ) : (
              props.navigation.replace("Login")
            );
          }}
        </Stack.Screen>

        <Stack.Screen name="UserBookings">
          {(props) => {
            innerNavRef.current = props.navigation;
            return user ? (
              <UserBookings {...props} user={user} />
            ) : (
              props.navigation.replace("Login")
            );
          }}
        </Stack.Screen>
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