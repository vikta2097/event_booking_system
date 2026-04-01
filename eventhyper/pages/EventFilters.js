// components/EventFilters.js (React Native)
// Search bar by default → tap to expand filters as an overlay modal
// Does NOT push/hide the events list beneath it
import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, SafeAreaView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const EventFilters = ({ onFilter }) => {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [filters, setFilters] = useState({
    category: "", tags: [], venue: "", minPrice: "", maxPrice: "",
    startDate: "", endDate: "", status: "", sortBy: "date_asc", search: "",
  });

  // Live search — fires onFilter as user types, no modal needed
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const fetchFiltersData = async () => {
      setLoading(true);
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          api.get("/categories").catch(() => ({ data: [] })),
          api.get("/tags").catch(() => ({ data: [] })),
        ]);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
        setTags(Array.isArray(tagsRes.data) ? tagsRes.data : []);
      } catch {
        setError("Failed to load filters.");
      } finally {
        setLoading(false);
      }
    };
    fetchFiltersData();
  }, []);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleTagToggle = (tagName) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter((t) => t !== tagName)
        : [...prev.tags, tagName],
    }));
  };

  const handleSearchChange = (text) => {
    setSearchText(text);
    onFilter({ ...buildCleaned(filters), search: text || undefined });
  };

  const buildCleaned = (f) => ({
    category: f.category || undefined,
    tags: f.tags.length > 0 ? f.tags.join(",") : undefined,
    venue: f.venue || undefined,
    minPrice: f.minPrice ? Number(f.minPrice) : undefined,
    maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
    startDate: f.startDate || undefined,
    endDate: f.endDate || undefined,
    status: f.status || undefined,
    sortBy: f.sortBy || undefined,
    search: searchText || undefined,
  });

  const handleApply = () => {
    onFilter(buildCleaned(filters));
    setModalVisible(false);
  };

  const handleReset = () => {
    const reset = {
      category: "", tags: [], venue: "", minPrice: "", maxPrice: "",
      startDate: "", endDate: "", status: "", sortBy: "date_asc", search: "",
    };
    setFilters(reset);
    setSearchText("");
    onFilter({});
    setModalVisible(false);
  };

  const handleQuickFilter = (type) => {
    const today = new Date();
    let f = { ...filters };
    switch (type) {
      case "today":
        f.startDate = f.endDate = today.toISOString().split("T")[0]; break;
      case "this_week":
        const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
        f.startDate = today.toISOString().split("T")[0];
        f.endDate = weekEnd.toISOString().split("T")[0]; break;
      case "this_month":
        const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        f.startDate = mStart.toISOString().split("T")[0];
        f.endDate = mEnd.toISOString().split("T")[0]; break;
      case "free":
        f.minPrice = "0"; f.maxPrice = "0"; break;
      case "paid":
        f.minPrice = "1"; break;
    }
    setFilters(f);
  };

  const activeFilterCount = [
    filters.category, filters.venue, filters.minPrice, filters.maxPrice,
    filters.startDate, filters.endDate, filters.status,
    ...filters.tags,
    filters.sortBy !== "date_asc" ? "sort" : "",
  ].filter(Boolean).length;

  // ── Search bar (always visible, never pushes content) ────────────────────
  return (
    <>
      <View style={styles.searchRow}>
        {/* Search input — live filter */}
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search events..."
            placeholderTextColor="#9ca3af"
            value={searchText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange("")}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter toggle button */}
        <TouchableOpacity
          style={[styles.filterToggleBtn, activeFilterCount > 0 && styles.filterToggleBtnActive]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.filterToggleIcon}>⚙️</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Filter Modal overlay — does NOT move the events list ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />

          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Events</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#3b82f6" />
              </View>
            ) : (
              <ScrollView
                style={styles.modalScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {!!error && <Text style={styles.error}>{error}</Text>}

                {/* Quick filters */}
                <Text style={styles.sectionLabel}>Quick Filters</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
                  {[
                    { key: "today", label: "Today" },
                    { key: "this_week", label: "This Week" },
                    { key: "this_month", label: "This Month" },
                    { key: "free", label: "Free" },
                    { key: "paid", label: "Paid" },
                  ].map(({ key, label }) => (
                    <TouchableOpacity key={key} style={styles.quickBtn} onPress={() => handleQuickFilter(key)}>
                      <Text style={styles.quickBtnText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Category */}
                <Text style={styles.sectionLabel}>Category</Text>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={filters.category} onValueChange={(v) => setFilter("category", v)} style={styles.picker}>
                    <Picker.Item label="All Categories" value="" />
                    {categories.map((cat) => (
                      <Picker.Item key={cat.id} label={cat.name} value={String(cat.id)} />
                    ))}
                  </Picker>
                </View>

                {/* Venue */}
                <Text style={styles.sectionLabel}>Venue / Location</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Nairobi, KICC"
                  value={filters.venue}
                  onChangeText={(v) => setFilter("venue", v)}
                />

                {/* Sort */}
                <Text style={styles.sectionLabel}>Sort By</Text>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={filters.sortBy} onValueChange={(v) => setFilter("sortBy", v)} style={styles.picker}>
                    <Picker.Item label="Date (Earliest First)" value="date_asc" />
                    <Picker.Item label="Date (Latest First)" value="date_desc" />
                    <Picker.Item label="Price (Low to High)" value="price_asc" />
                    <Picker.Item label="Price (High to Low)" value="price_desc" />
                    <Picker.Item label="Most Popular" value="popular" />
                    <Picker.Item label="Name (A-Z)" value="name_asc" />
                  </Picker>
                </View>

                {/* Tags */}
                {tags.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Tags</Text>
                    <View style={styles.tagsContainer}>
                      {tags.map((tag) => (
                        <TouchableOpacity
                          key={tag.id}
                          style={[styles.tagBtn, filters.tags.includes(tag.name) && styles.tagBtnActive]}
                          onPress={() => handleTagToggle(tag.name)}
                        >
                          <Text style={[styles.tagBtnText, filters.tags.includes(tag.name) && styles.tagBtnTextActive]}>
                            {tag.name}{filters.tags.includes(tag.name) ? " ✕" : ""}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Advanced toggle */}
                <TouchableOpacity
                  style={styles.advancedToggle}
                  onPress={() => setShowAdvanced(!showAdvanced)}
                >
                  <Text style={styles.advancedToggleText}>
                    {showAdvanced ? "∧ Hide" : "+ Show"} Advanced Filters
                  </Text>
                </TouchableOpacity>

                {showAdvanced && (
                  <View style={styles.advancedBox}>
                    <TextInput style={styles.input} placeholder="Min Price (KES)" value={filters.minPrice}
                      onChangeText={(v) => setFilter("minPrice", v)} keyboardType="numeric" />
                    <TextInput style={styles.input} placeholder="Max Price (KES)" value={filters.maxPrice}
                      onChangeText={(v) => setFilter("maxPrice", v)} keyboardType="numeric" />
                    <View style={styles.pickerWrapper}>
                      <Picker selectedValue={filters.status} onValueChange={(v) => setFilter("status", v)} style={styles.picker}>
                        <Picker.Item label="All Status" value="" />
                        <Picker.Item label="Upcoming" value="upcoming" />
                        <Picker.Item label="Ongoing" value="ongoing" />
                        <Picker.Item label="Early Bird Available" value="early_bird" />
                      </Picker>
                    </View>
                  </View>
                )}

                {/* Save/Load presets */}
                <View style={styles.presetsRow}>
                  <TouchableOpacity style={styles.presetBtn} onPress={async () => {
                    await AsyncStorage.setItem("savedFilters", JSON.stringify(filters));
                    alert("Filters saved!");
                  }}>
                    <Text style={styles.presetBtnText}>💾 Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.presetBtn} onPress={async () => {
                    const saved = await AsyncStorage.getItem("savedFilters");
                    if (saved) { setFilters(JSON.parse(saved)); alert("Filters loaded!"); }
                    else alert("No saved filters found");
                  }}>
                    <Text style={styles.presetBtnText}>📂 Load</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>
            )}

            {/* Action buttons — sticky at bottom of modal */}
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
                <Text style={styles.applyBtnText}>
                  Apply{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // ── Search bar row ──────────────────────────────────────────────────────
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: "#1f2937", padding: 0 },
  clearBtn: { color: "#9ca3af", fontSize: 14, paddingHorizontal: 4 },
  filterToggleBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  filterToggleBtnActive: { backgroundColor: "#dbeafe" },
  filterToggleIcon: { fontSize: 18 },
  filterBadge: {
    position: "absolute", top: 0, right: 0,
    backgroundColor: "#3b82f6",
    borderRadius: 10, width: 18, height: 18,
    justifyContent: "center", alignItems: "center",
  },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  // ── Modal ───────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalClose: { fontSize: 18, color: "#6b7280", padding: 4 },
  modalScroll: { paddingHorizontal: 20, paddingTop: 12 },
  loadingBox: { padding: 40, alignItems: "center" },

  // ── Filter controls ─────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 13, fontWeight: "700", color: "#374151",
    marginBottom: 8, marginTop: 14,
  },
  error: { color: "#ef4444", marginBottom: 8 },
  quickScroll: { marginBottom: 4 },
  quickBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: "#f3f4f6",
    borderRadius: 20, marginRight: 8,
  },
  quickBtnText: { color: "#374151", fontWeight: "600", fontSize: 13 },
  pickerWrapper: {
    borderWidth: 1, borderColor: "#e5e7eb",
    borderRadius: 8, marginBottom: 4, overflow: "hidden",
  },
  picker: { height: 50 },
  input: {
    borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8,
    padding: 10, fontSize: 14, marginBottom: 8, color: "#1f2937",
    backgroundColor: "#fff",
  },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tagBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: "#f3f4f6", borderRadius: 20,
  },
  tagBtnActive: { backgroundColor: "#3b82f6" },
  tagBtnText: { color: "#6b7280", fontSize: 13, fontWeight: "500" },
  tagBtnTextActive: { color: "#fff" },
  advancedToggle: {
    borderWidth: 1, borderColor: "#d1d5db", borderStyle: "dashed",
    borderRadius: 8, padding: 10, alignItems: "center", marginVertical: 12,
  },
  advancedToggleText: { color: "#6b7280", fontWeight: "600", fontSize: 14 },
  advancedBox: {
    backgroundColor: "#f9fafb", borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 8,
  },
  presetsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  presetBtn: {
    flex: 1, backgroundColor: "#f3f4f6",
    borderRadius: 8, padding: 10, alignItems: "center",
  },
  presetBtnText: { color: "#374151", fontSize: 13, fontWeight: "600" },

  // ── Modal footer ────────────────────────────────────────────────────────
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  applyBtn: {
    flex: 2, backgroundColor: "#3b82f6",
    borderRadius: 10, padding: 14, alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  resetBtn: {
    flex: 1, backgroundColor: "#f3f4f6",
    borderRadius: 10, padding: 14, alignItems: "center",
  },
  resetBtnText: { color: "#374151", fontWeight: "700", fontSize: 15 },
});

export default EventFilters;