import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import api from "../api";

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
  { value: "organizer", label: "Organizer" },
];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    email: "",
    fullname: "",
    role: "user",
    password: "",
  });
  const [editUserId, setEditUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  const baseUrl = `${process.env.REACT_APP_API_URL}/users`;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(baseUrl);
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
      Alert.alert("Error", "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (
      !formData.email ||
      !formData.fullname ||
      !formData.role ||
      (!editUserId && !formData.password)
    ) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      Alert.alert("Error", "Invalid email format");
      return;
    }

    if (!editUserId && formData.password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    try {
      if (editUserId) {
        await api.put(`${baseUrl}/${editUserId}`, formData);
        Alert.alert("Success", "User updated successfully");
      } else {
        await api.post(baseUrl, formData);
        Alert.alert("Success", "User created successfully");
      }

      setFormData({ email: "", fullname: "", role: "user", password: "" });
      setEditUserId(null);
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.message || "Network error. Please try again.";
      Alert.alert("Error", msg);
    }
  };

  const handleEdit = (user) => {
    setFormData({
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      password: "",
    });
    setEditUserId(user.id);
  };

  const cancelEdit = () => {
    setFormData({ email: "", fullname: "", role: "user", password: "" });
    setEditUserId(null);
  };

  const deleteUser = async (id) => {
    Alert.alert("Confirm", "Are you sure you want to delete this user?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`${baseUrl}/${id}`);
            setUsers((prev) => prev.filter((u) => u.id !== id));
            Alert.alert("Success", "User deleted successfully");
          } catch (err) {
            const msg = err.response?.data?.message || "Failed to delete user";
            Alert.alert("Error", msg);
          }
        },
      },
    ]);
  };

  const renderUser = ({ item: user }) => (
    <View style={styles.userRow}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.fullname}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{user.role}</Text>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(user)}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteUser(user.id)}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>User Management</Text>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>
            {editUserId ? "Edit User" : "Add New User"}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={formData.email}
            onChangeText={(v) => handleChange("email", v)}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#9ca3af"
          />

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={formData.fullname}
            onChangeText={(v) => handleChange("fullname", v)}
            placeholderTextColor="#9ca3af"
          />

          {/* Role Selector */}
          <Text style={styles.fieldLabel}>Role</Text>
          <View style={styles.rolePickerRow}>
            {roleOptions.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.roleOption,
                  formData.role === value && styles.roleOptionActive,
                ]}
                onPress={() => handleChange("role", value)}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    formData.role === value && styles.roleOptionTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder={editUserId ? "New Password (optional)" : "Password"}
            value={formData.password}
            onChangeText={(v) => handleChange("password", v)}
            secureTextEntry
            placeholderTextColor="#9ca3af"
          />

          <TouchableOpacity
            style={[styles.btnSubmit, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnSubmitText}>
                {editUserId ? "Update User" : "Add User"}
              </Text>
            )}
          </TouchableOpacity>

          {editUserId && (
            <TouchableOpacity style={styles.btnCancel} onPress={cancelEdit}>
              <Text style={styles.btnCancelText}>Cancel Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Users Table */}
        <View style={styles.tableCard}>
          <Text style={styles.sectionTitle}>All Users</Text>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 0.5 }]}>ID</Text>
            <Text style={[styles.headerCell, { flex: 2 }]}>Name / Email</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>Role</Text>
            <Text style={[styles.headerCell, { flex: 1.5 }]}>Actions</Text>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : users.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.noDataText}>No users found.</Text>
            </View>
          ) : (
            users.map((user) => (
              <View key={user.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 0.5 }]}>{user.id}</Text>
                <View style={{ flex: 2 }}>
                  <Text style={styles.userName}>{user.fullname}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{user.role}</Text>
                  </View>
                </View>
                <View style={[styles.actionCell, { flex: 1.5 }]}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(user)}>
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deleteUser(user.id)}
                  >
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const BLUE = "#2563eb";
const DARK_BLUE = "#1e40af";
const RED = "#dc2626";

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  scrollView: { flex: 1, padding: 16 },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    padding: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  centerContainer: { padding: 24, alignItems: "center" },

  // Form Card
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: "#1f2937",
    marginBottom: 12,
    backgroundColor: "#f9fafb",
  },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 },

  // Role Picker
  rolePickerRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  roleOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  roleOptionActive: { backgroundColor: BLUE, borderColor: BLUE },
  roleOptionText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  roleOptionTextActive: { color: "#fff" },

  // Buttons
  btnSubmit: {
    backgroundColor: BLUE,
    padding: 13,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnSubmitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnCancel: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  btnCancelText: { color: "#374151", fontWeight: "600", fontSize: 14 },

  // Table Card
  tableCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    padding: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  headerCell: {
    fontWeight: "700",
    fontSize: 13,
    color: "#374151",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableCell: { fontSize: 14, color: "#374151" },
  userName: { fontSize: 14, fontWeight: "600", color: "#1f2937" },
  userEmail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  actionCell: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

  // Role Badge
  roleBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  roleBadgeText: { color: BLUE, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },

  // User Row (card view)
  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  userInfo: { flex: 1 },
  userActions: { flexDirection: "column", gap: 6 },

  // Edit / Delete
  editBtn: {
    backgroundColor: BLUE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  editBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  deleteBtn: {
    backgroundColor: RED,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  deleteBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  // States
  noDataText: { color: "#6b7280", fontStyle: "italic", fontSize: 14 },
});

export default Users;