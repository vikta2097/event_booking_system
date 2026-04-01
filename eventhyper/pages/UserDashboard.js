// pages/UserDashboard.js (React Native)
// Mirrors web UserDashboard.js logic exactly:
//   - TopBar: guest sees Login/Sign Up; authenticated sees My Bookings + Bell + Logout
//   - Auth-gated screens (BookEvent, Payment, BookingSuccess, UserBookings) redirect
//     to Login if unauthenticated — same as web's per-route <Navigate to="/auth/login">
//   - Logout navigates back to UserDashboard as guest (not to Login screen),
//     matching web which calls onLogout() then navigate("/auth/login") —
//     except on mobile, dumping the user to Login when they could still browse
//     would break parity with the guest-browsing model, so we stay on UserDashboard.
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
import NotificationBell from "./NotificationBell";

const Stack = createNativeStackNavigator();

// ─── Top Bar — mirrors web UserDashboard top bar exactly ─────────────────────
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
              {/* My Bookings — mirrors web my-bookings-btn */}
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => navigation.navigate("UserBookings")}
              >
                <Text style={styles.topBarBtnText}>My Bookings</Text>
              </TouchableOpacity>

              {/* NotificationBell — mirrors web <NotificationBell user={user} /> */}
              <NotificationBell user={user} />

              {/* Logout — mirrors web logout-btn */}
              <TouchableOpacity
                style={[styles.topBarBtn, styles.logoutBtn]}
                onPress={onLogout}
              >
                <Text style={styles.topBarBtnText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Login — mirrors web login-btn → navigate("/auth/login") */}
              <TouchableOpacity
                style={styles.topBarBtn}
                onPress={() => navigation.navigate("Login")}
              >
                <Text style={styles.topBarBtnText}>Login</Text>
              </TouchableOpacity>

              {/* Sign Up — mirrors web signup-btn → navigate("/auth/login") */}
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
  // Mirrors web: onLogout() is called, then navigate to login.
  // On RN we navigate to UserDashboard (resets to guest state) rather than
  // kicking user to Login, preserving the guest-browsing parity with web.
  const handleLogout = () => {
    onLogout();
    // rootNav is the root Stack (App.js). Navigate to UserDashboard so the
    // user stays on the events list as a guest — same UX intent as web's
    // redirect to /dashboard which is publicly accessible.
    rootNav?.navigate("UserDashboard");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Top bar shown on all screens — same as web fixed top bar */}
      <TopBar user={user} onLogout={handleLogout} />

      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName="UserHome"
      >
        {/* ── Public screens — no auth required, mirrors web index + contact + events/:id */}
        <Stack.Screen name="UserHome">
          {(props) => <UserDashboardHome {...props} user={user} />}
        </Stack.Screen>

        <Stack.Screen name="Contact" component={ContactUs} />

        <Stack.Screen name="EventDetails">
          {(props) => <EventDetails {...props} user={user} />}
        </Stack.Screen>

        {/* ── Auth-gated screens — mirror web per-route <Navigate to="/auth/login"> */}
        <Stack.Screen name="BookEvent">
          {(props) =>
            user ? (
              <BookingForm {...props} user={user} />
            ) : (
              // Mirrors: <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
              props.navigation.replace("Login")
            )
          }
        </Stack.Screen>

        <Stack.Screen name="Payment">
          {(props) =>
            user ? (
              <PaymentPage {...props} user={user} />
            ) : (
              // Mirrors: <Navigate to="/auth/login" replace />
              props.navigation.replace("Login")
            )
          }
        </Stack.Screen>

        <Stack.Screen name="BookingSuccess">
          {(props) =>
            user ? (
              <BookingSuccess {...props} user={user} />
            ) : (
              // Mirrors: <Navigate to="/auth/login" replace />
              props.navigation.replace("Login")
            )
          }
        </Stack.Screen>

        <Stack.Screen name="UserBookings">
          {(props) =>
            user ? (
              <UserBookings {...props} user={user} />
            ) : (
              // Mirrors: <Navigate to="/auth/login" replace />
              props.navigation.replace("Login")
            )
          }
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