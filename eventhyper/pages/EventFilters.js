import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../api";

const EventFilters = ({ onFilter }) => {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    category: "", tags: [], venue: "", minPrice: "", maxPrice: "",
    startDate: "", endDate: "", status: "", sortBy: "date_asc", search: "",
  });

  useEffect(() => {
    const fetchFiltersData = async () => {
      setLoading(true);
      setError("");
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          api.get("/categories").catch(() => ({ data: [] })),
          api.get("/tags").catch(() => ({ data: [] })),
        ]);
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
        setTags(Array.isArray(tagsRes.data) ? tagsRes.data : []);
      } catch {
        setError("Failed to load filters. Using defaults.");
        setCategories([]);
        setTags([]);
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

  const handleSubmit = () => {
    const cleaned = {
      category: filters.category || undefined,
      tags: filters.tags.length > 0 ? filters.tags.join(",") : undefined,
      venue: filters.venue || undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      status: filters.status || undefined,
      sortBy: filters.sortBy || undefined,
      search: filters.search || undefined,
    };
    onFilter(cleaned);
  };

  const handleReset = () => {
    const reset = {
      category: "", tags: [], venue: "", minPrice: "", maxPrice: "",
      startDate: "", endDate: "", status: "", sortBy: "date_asc", search: "",
    };
    setFilters(reset);
    onFilter({});
  };

  const handleQuickFilter = (type) => {
    const today = new Date();
    let newFilters = { ...filters };
    switch (type) {
      case "today":
        newFilters.startDate = newFilters.endDate = today.toISOString().split("T")[0]; break;
      case "this_week":
        const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
        newFilters.startDate = today.toISOString().split("T")[0];
        newFilters.endDate = weekEnd.toISOString().split("T")[0]; break;
      case "this_month":
        const mStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const mEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        newFilters.startDate = mStart.toISOString().split("T")[0];
        newFilters.endDate = mEnd.toISOString().split("T")[0]; break;
      case "free":
        newFilters.minPrice = "0"; newFilters.maxPrice = "0"; break;
      case "paid":
        newFilters.minPrice = "1"; break;
      default: break;
    }
    setFilters(newFilters);
  };

  const activeFilterCount = Object.values(filters).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v !== "" && v !== "date_asc"
  ).length;

  if (loading) return <View style={styles.container}><ActivityIndicator color="#3b82f6" /></View>;

  return (
    <View style={styles.container}>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {/* Quick Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
        {["today", "this_week", "this_month", "free", "paid"].map((type) => (
          <TouchableOpacity key={type} style={styles.quickBtn} onPress={() => handleQuickFilter(type)}>
            <Text style={styles.quickBtnText}>
              {{ today: "Today", this_week: "This Week", this_month: "This Month", free: "Free Events", paid: "Paid Events" }[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category & Sort */}
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={filters.category} onValueChange={(v) => setFilter("category", v)} style={styles.picker}>
          <Picker.Item label="All Categories" value="" />
          {categories.map((cat) => <Picker.Item key={cat.id} label={cat.name} value={String(cat.id)} />)}
        </Picker>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Venue or Location"
        value={filters.venue}
        onChangeText={(v) => setFilter("venue", v)}
      />

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
        <View style={styles.tagsSection}>
          <Text style={styles.tagsLabel}>Tags:</Text>
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
        </View>
      )}

      {/* Advanced Toggle */}
      <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
        <Text style={styles.advancedToggleText}>{showAdvanced ? "∧ Hide" : "+ Show"} Advanced Filters</Text>
      </TouchableOpacity>

      {/* Advanced Filters */}
      {showAdvanced && (
        <View style={styles.advancedBox}>
          <TextInput style={styles.input} placeholder="Min Price (KES)" value={filters.minPrice} onChangeText={(v) => setFilter("minPrice", v)} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Max Price (KES)" value={filters.maxPrice} onChangeText={(v) => setFilter("maxPrice", v)} keyboardType="numeric" />
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

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFiltersScroll}>
          {filters.category && (
            <TouchableOpacity style={styles.activeFilterTag} onPress={() => setFilter("category", "")}>
              <Text style={styles.activeFilterText}>Category ✕</Text>
            </TouchableOpacity>
          )}
          {filters.venue ? (
            <TouchableOpacity style={styles.activeFilterTag} onPress={() => setFilter("venue", "")}>
              <Text style={styles.activeFilterText}>Venue: {filters.venue} ✕</Text>
            </TouchableOpacity>
          ) : null}
          {filters.tags.map((tag) => (
            <TouchableOpacity key={tag} style={styles.activeFilterTag} onPress={() => handleTagToggle(tag)}>
              <Text style={styles.activeFilterText}>Tag: {tag} ✕</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.applyBtn} onPress={handleSubmit}>
          <Text style={styles.applyBtnText}>Apply Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>Reset All</Text>
        </TouchableOpacity>
      </View>

      {/* Presets */}
      <View style={styles.presetsRow}>
        <TouchableOpacity style={styles.presetBtn} onPress={async () => {
          await AsyncStorage.setItem("savedFilters", JSON.stringify(filters));
          alert("Filters saved!");
        }}>
          <Text style={styles.presetBtnText}>💾 Save Filters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetBtn} onPress={async () => {
          const saved = await AsyncStorage.getItem("savedFilters");
          if (saved) { setFilters(JSON.parse(saved)); alert("Filters loaded!"); }
          else alert("No saved filters found");
        }}>
          <Text style={styles.presetBtnText}>📂 Load Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  error: { color: "#ef4444", marginBottom: 8 },
  quickScroll: { marginBottom: 16 },
  quickBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff", borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 20, marginRight: 8 },
  quickBtnText: { color: "#6b7280", fontWeight: "600", fontSize: 13 },
  input: { borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10, color: "#1f2937" },
  pickerWrapper: { borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 8, marginBottom: 10, overflow: "hidden" },
  picker: { height: 50 },
  tagsSection: { marginBottom: 12 },
  tagsLabel: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 8 },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagBtn: { paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 20 },
  tagBtnActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  tagBtnText: { color: "#6b7280", fontSize: 13, fontWeight: "500" },
  tagBtnTextActive: { color: "#fff" },
  advancedToggle: { borderWidth: 2, borderColor: "#d1d5db", borderStyle: "dashed", borderRadius: 8, padding: 10, alignItems: "center", marginBottom: 12 },
  advancedToggleText: { color: "#6b7280", fontWeight: "600", fontSize: 14 },
  advancedBox: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 12 },
  activeFiltersScroll: { marginBottom: 12 },
  activeFilterTag: { backgroundColor: "#eff6ff", borderWidth: 1, borderColor: "#bfdbfe", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  activeFilterText: { color: "#1e40af", fontSize: 12, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  applyBtn: { flex: 1, backgroundColor: "#3b82f6", borderRadius: 8, padding: 12, alignItems: "center" },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  resetBtn: { flex: 1, backgroundColor: "#fff", borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, alignItems: "center" },
  resetBtnText: { color: "#6b7280", fontWeight: "700", fontSize: 14 },
  presetsRow: { flexDirection: "row", gap: 10 },
  presetBtn: { flex: 1, backgroundColor: "#fff", borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, alignItems: "center" },
  presetBtnText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
});

export default EventFilters;
