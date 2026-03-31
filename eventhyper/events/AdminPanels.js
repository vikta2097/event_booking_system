import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  FlatList, Modal, StyleSheet, Alert, Platform
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DocumentPicker from "react-native-document-picker";
import api from "../api";

const AdminPanels = ({ categories, tags, onRefresh }) => {
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showCategoryCard, setShowCategoryCard] = useState(false);
  const [showTagsCard, setShowTagsCard] = useState(false);

  const [bulkFile, setBulkFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryError, setCategoryError] = useState("");

  const [newTag, setNewTag] = useState("");
  const [tagError, setTagError] = useState("");

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.csv, "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      });
      setBulkFile(result);
      setUploadError("");
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) setUploadError("Failed to pick file");
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    const formData = new FormData();
    formData.append("file", { uri: bulkFile.uri, name: bulkFile.name, type: bulkFile.type });
    try {
      setUploadLoading(true);
      setUploadError("");
      const headers = await getAuthHeaders();
      await api.post("/events/bulk-upload", formData, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      Alert.alert("Success", "Events uploaded successfully!");
      setShowBulkUpload(false);
      setBulkFile(null);
      await onRefresh();
    } catch (err) {
      setUploadError(err.response?.data?.error || err.response?.data?.message || "Bulk upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleCategoryAdd = async () => {
    if (!newCategory.trim()) { setCategoryError("Category name cannot be empty"); return; }
    try {
      setCategoryError("");
      const headers = await getAuthHeaders();
      await api.post("/categories", { name: newCategory.trim() }, { headers });
      setNewCategory("");
      await onRefresh();
    } catch (err) {
      setCategoryError(err.response?.data?.error || "Failed to add category");
    }
  };

  const handleCategoryUpdate = async (id, name) => {
    if (!name.trim()) { setCategoryError("Category name cannot be empty"); return; }
    try {
      setCategoryError("");
      const headers = await getAuthHeaders();
      await api.put(`/categories/${id}`, { name: name.trim() }, { headers });
      setEditingCategory(null);
      await onRefresh();
    } catch (err) {
      setCategoryError(err.response?.data?.error || "Failed to update category");
    }
  };

  const handleCategoryDelete = (id) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this category?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            setCategoryError("");
            const headers = await getAuthHeaders();
            await api.delete(`/categories/${id}`, { headers });
            await onRefresh();
          } catch (err) {
            setCategoryError(err.response?.data?.error || "Failed to delete category");
          }
        }
      }
    ]);
  };

  const handleTagAdd = async () => {
    if (!newTag.trim()) { setTagError("Tag name cannot be empty"); return; }
    try {
      setTagError("");
      const headers = await getAuthHeaders();
      await api.post("/tags", { name: newTag.trim() }, { headers });
      setNewTag("");
      await onRefresh();
    } catch (err) {
      setTagError(err.response?.data?.error || "Failed to add tag");
    }
  };

  const handleTagDelete = (id) => {
    Alert.alert("Confirm Delete", "Delete this tag?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            setTagError("");
            const headers = await getAuthHeaders();
            await api.delete(`/tags/${id}`, { headers });
            await onRefresh();
          } catch (err) {
            setTagError(err.response?.data?.error || "Failed to delete tag");
          }
        }
      }
    ]);
  };

  return (
    <View>
      {/* Action Buttons */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionsRow}>
        <TouchableOpacity style={styles.adminBtn} onPress={() => setShowBulkUpload(true)}>
          <Text style={styles.adminBtnText}>📤 Bulk Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adminBtn} onPress={() => setShowCategoryCard(!showCategoryCard)}>
          <Text style={styles.adminBtnText}>🏷️ Categories</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adminBtn} onPress={() => setShowTagsCard(!showTagsCard)}>
          <Text style={styles.adminBtnText}>🔖 Tags</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bulk Upload Modal */}
      <Modal visible={showBulkUpload} transparent animationType="fade" onRequestClose={() => setShowBulkUpload(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>📤 Bulk Upload Events</Text>

            <TouchableOpacity style={styles.filePickerBtn} onPress={pickFile}>
              <Text style={styles.filePickerBtnText}>{bulkFile ? `📄 ${bulkFile.name}` : "Choose CSV/Excel File"}</Text>
            </TouchableOpacity>

            <Text style={styles.helpText}>
              Required: title, description, category_id, location, event_date, start_time, end_time, capacity, price
            </Text>

            {!!uploadError && <Text style={styles.errorText}>{uploadError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.primaryBtn, (!bulkFile || uploadLoading) && styles.disabledBtn]}
                onPress={handleBulkUpload}
                disabled={!bulkFile || uploadLoading}
              >
                <Text style={styles.primaryBtnText}>{uploadLoading ? "Uploading..." : "Upload"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setShowBulkUpload(false); setBulkFile(null); setUploadError(""); }}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Card */}
      {showCategoryCard && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>🏷️ Manage Categories</Text>
            <TouchableOpacity onPress={() => { setShowCategoryCard(false); setCategoryError(""); setEditingCategory(null); }}>
              <Text style={styles.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inlineForm}>
            <TextInput
              style={styles.inlineInput}
              placeholder="New category name"
              value={newCategory}
              onChangeText={setNewCategory}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleCategoryAdd}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {!!categoryError && <Text style={styles.errorText}>{categoryError}</Text>}

          {categories.length > 0 ? (
            <View>
              {categories.map((c) => (
                <View key={c.id} style={styles.listItem}>
                  {editingCategory?.id === c.id ? (
                    <>
                      <TextInput
                        style={[styles.inlineInput, { flex: 1 }]}
                        value={editingCategory.name}
                        onChangeText={(v) => setEditingCategory({ ...editingCategory, name: v })}
                        autoFocus
                      />
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleCategoryUpdate(c.id, editingCategory.name)}>
                        <Text style={styles.saveIcon}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingCategory(null)}>
                        <Text style={styles.cancelIcon}>✕</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.itemName}>{c.name}</Text>
                      <View style={styles.itemActions}>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingCategory(c)}>
                          <Text>✏️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtn} onPress={() => handleCategoryDelete(c.id)}>
                          <Text>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No categories yet. Add one above.</Text>
          )}
        </View>
      )}

      {/* Tags Card */}
      {showTagsCard && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>🔖 Manage Tags</Text>
            <TouchableOpacity onPress={() => { setShowTagsCard(false); setTagError(""); }}>
              <Text style={styles.closeBtn}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inlineForm}>
            <TextInput
              style={styles.inlineInput}
              placeholder="New tag name"
              value={newTag}
              onChangeText={setNewTag}
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleTagAdd}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {!!tagError && <Text style={styles.errorText}>{tagError}</Text>}

          <View style={styles.tagsList}>
            {tags.map((t) => (
              <View key={t.id} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{t.name}</Text>
                <TouchableOpacity onPress={() => handleTagDelete(t.id)} style={styles.tagDeleteBtn}>
                  <Text style={styles.tagDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {tags.length === 0 && <Text style={styles.emptyText}>No tags yet. Add one above.</Text>}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  actionsRow: { marginBottom: 12 },
  adminBtn: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8 },
  adminBtnText: { color: "#374151", fontWeight: "700", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modal: { backgroundColor: "#fff", borderRadius: 14, padding: 24, width: "90%", maxWidth: 420 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16, color: "#1f2937" },
  filePickerBtn: { backgroundColor: "#f3f4f6", borderRadius: 8, padding: 14, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#d1d5db" },
  filePickerBtnText: { color: "#374151", fontWeight: "600" },
  helpText: { color: "#6b7280", fontSize: 12, marginBottom: 12, lineHeight: 18 },
  errorText: { color: "#ef4444", fontSize: 13, marginBottom: 8 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  primaryBtn: { flex: 1, backgroundColor: "#3b82f6", borderRadius: 8, padding: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  disabledBtn: { opacity: 0.5 },
  secondaryBtn: { flex: 1, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, alignItems: "center" },
  secondaryBtnText: { color: "#374151", fontWeight: "600" },
  panel: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  panelTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  closeBtn: { fontSize: 24, color: "#6b7280", fontWeight: "700", lineHeight: 28 },
  inlineForm: { flexDirection: "row", gap: 8, marginBottom: 8 },
  inlineInput: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, fontSize: 14 },
  addBtn: { backgroundColor: "#3b82f6", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "700" },
  listItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  itemName: { flex: 1, color: "#1f2937", fontSize: 15 },
  itemActions: { flexDirection: "row", gap: 8 },
  iconBtn: { padding: 6 },
  saveIcon: { color: "#10b981", fontWeight: "700", fontSize: 18 },
  cancelIcon: { color: "#ef4444", fontWeight: "700", fontSize: 16 },
  emptyText: { textAlign: "center", color: "#9ca3af", marginVertical: 16 },
  tagsList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tagChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 20, paddingLeft: 12, paddingRight: 6, paddingVertical: 6, borderWidth: 1, borderColor: "#d1d5db" },
  tagChipText: { color: "#374151", fontSize: 13, fontWeight: "500", marginRight: 4 },
  tagDeleteBtn: { padding: 2 },
  tagDeleteText: { color: "#6b7280", fontWeight: "700", fontSize: 14 },
});

export default AdminPanels;
