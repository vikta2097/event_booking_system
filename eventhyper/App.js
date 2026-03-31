// App.js (React Native)
import React, { useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
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
  if (!authChecked) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d47a1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const isAuthenticated = !!token;

  // ─── Determine initial route ──────────────────────────────────────────────
  const getInitialRoute = () => {
    if (!isAuthenticated) return "Login";
    if (user?.role === "admin") return "AdminDashboard";
    if (user?.role === "organizer") return "OrganizerDashboard";
    return "UserDashboard";
  };

  // ─── Navigation ───────────────────────────────────────────────────────────
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={getInitialRoute()}
        screenOptions={{ headerShown: false }}
      >
        {/* ── Auth ── */}
        <Stack.Screen name="Login">
          {(props) => (
            <LoginForm {...props} onLoginSuccess={handleLogin} />
          )}
        </Stack.Screen>

        {/* ── User Dashboard ── */}
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

        {/* ── Admin Dashboard ── */}
        {isAuthenticated && user?.role === "admin" && (
          <Stack.Screen name="AdminDashboard">
            {(props) => (
              <AdminDashboard {...props} token={token} onLogout={handleLogout} />
            )}
          </Stack.Screen>
        )}

        {/* ── Organizer Dashboard ── */}
        {isAuthenticated && user?.role === "organizer" && (
          <Stack.Screen name="OrganizerDashboard">
            {(props) => (
              <OrganizerDashboard
                {...props}
                token={token}
                user={user}
                onLogout={handleLogout}
              />
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
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