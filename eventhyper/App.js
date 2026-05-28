import 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Auth
import LoginForm from "./components/LoginForm";

// Dashboards
import AdminDashboard from "./pages/AdminDashboard";
import OrganizerDashboard from "./Organizer/OrganizerDashboard";
import UserDashboard from "./pages/UserDashboard";

const Stack = createNativeStackNavigator();
const SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours

// ✅ Ref lives outside the component so handleLogin / handleLogout
//    can call it without needing it in their closure.
const navigationRef = createNavigationContainerRef();

// Helper — navigate safely; no-ops if navigator isn't ready yet
const navigateTo = (name) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name);
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const logoutTimerRef = useRef(null);

  // ─── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    await AsyncStorage.multiRemove(["token", "role", "user", "loginTime", "userId"]);
    setUser(null);
    setToken(null);
    // Return guests to UserDashboard (public browse view)
    navigateTo("UserDashboard");
  };

  // ─── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async ({ token, role, user }) => {
    const loginTime = Date.now().toString();
    await AsyncStorage.multiSet([
      ["token", token],
      ["role", role],
      ["user", JSON.stringify(user)],
      ["loginTime", loginTime],
    ]);

    setToken(token);
    setUser({ ...user, role });

    // ✅ Redirect to the correct dashboard immediately after login.
    //    All three screens are always registered (see Stack below), so
    //    there is no race between screen registration and this navigate call.
    const target =
      role === "admin"      ? "AdminDashboard"      :
      role === "organizer"  ? "OrganizerDashboard"  :
                              "UserDashboard";

    navigateTo(target);

    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
      Alert.alert("Session Expired", "Please log in again.");
    }, SESSION_TIMEOUT);
  };

  // ─── Restore session on mount ─────────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [[, storedToken], [, storedRole], [, storedUser], [, storedLoginTime]] =
          await AsyncStorage.multiGet(["token", "role", "user", "loginTime"]);

        if (storedToken && storedRole && storedUser && storedLoginTime) {
          const elapsed = Date.now() - Number(storedLoginTime);
          const parsedUser = JSON.parse(storedUser);

          if (elapsed < SESSION_TIMEOUT) {
            setToken(storedToken);
            setUser({ ...parsedUser, role: storedRole });

            logoutTimerRef.current = setTimeout(() => {
              handleLogout();
              Alert.alert("Session Expired", "Please log in again.");
            }, SESSION_TIMEOUT - elapsed);
          } else {
            await handleLogout();
          }
        }
      } catch {
        await handleLogout();
      } finally {
        setAuthChecked(true);
      }
    };

    restoreSession();
    return () => logoutTimerRef.current && clearTimeout(logoutTimerRef.current);
  }, []);

  // ─── Loading screen ───────────────────────────────────────────────────────
  // Providers wrap even the loading state so they're never conditionally mounted
  if (!authChecked) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#0d47a1" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // ─── Initial route logic — mirrors web App.js exactly ────────────────────
  const getInitialRoute = () => {
    if (!token) return "UserDashboard";
    if (user?.role === "admin") return "AdminDashboard";
    if (user?.role === "organizer") return "OrganizerDashboard";
    return "UserDashboard";
  };

  // ─── Navigation ───────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* ✅ ref attached so navigateTo() works from handleLogin / handleLogout */}
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName={getInitialRoute()}
            screenOptions={{ headerShown: false }}
          >
            {/* ── Auth ─────────────────────────────────────────────────────── */}
            <Stack.Screen name="Login">
              {(props) => <LoginForm {...props} onLoginSuccess={handleLogin} />}
            </Stack.Screen>

            {/* ── User Dashboard — always registered, guests browse freely ─── */}
            <Stack.Screen name="UserDashboard">
              {(props) => (
                <UserDashboard
                  {...props}
                  user={user}
                  token={token}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            {/* ✅ Admin + Organizer screens are ALWAYS registered.
                Previously they were conditionally rendered, which meant they
                didn't exist in the navigator at the moment handleLogin tried
                to navigate to them — causing a silent no-op or "no route"
                crash. Access control is enforced inside each dashboard. */}
            <Stack.Screen name="AdminDashboard">
              {(props) =>
                token && user?.role === "admin" ? (
                  <AdminDashboard {...props} token={token} onLogout={handleLogout} />
                ) : (
                  // Not authorised — silently return to UserDashboard
                  <>{navigateTo("UserDashboard")}</>
                )
              }
            </Stack.Screen>

            <Stack.Screen name="OrganizerDashboard">
              {(props) =>
                token && user?.role === "organizer" ? (
                  <OrganizerDashboard
                    {...props}
                    token={token}
                    user={user}
                    onLogout={handleLogout}
                  />
                ) : (
                  <>{navigateTo("UserDashboard")}</>
                )
              }
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#555",
  },
});