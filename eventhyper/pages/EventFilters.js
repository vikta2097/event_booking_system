import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import api from "../api";

const EventFilters = ({ onFilter }) => {
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: "",
    venue: "",
    minPrice: "",
    maxPrice: "",
    startDate: null,
    endDate: null,
  });

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // ✅ Fetch categories dynamically
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get("/categories");
        setCategories(res.data);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };
    fetchCategories();
  }, []);

  const handleChange = (name, value) => {
    const updated = { ...filters, [name]: value };
    setFilters(updated);
    onFilter(updated);
  };

  const toggleCategory = (cat) => {
    const newCategory = filters.category === cat ? "" : cat;
    handleChange("category", newCategory);
  };

  const clearFilters = () => {
    const reset = {
      category: "",
      venue: "",
      minPrice: "",
      maxPrice: "",
      startDate: null,
      endDate: null,
    };
    setFilters(reset);
    onFilter(reset);
  };

  const formatDate = (date) =>
    date ? date.toISOString().split("T")[0] : "";

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Filter Events</Text>

      {/* 🔥 Category Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.chip,
              filters.category === cat.name && styles.activeChip,
            ]}
            onPress={() => toggleCategory(cat.name)}
          >
            <Text
              style={[
                styles.chipText,
                filters.category === cat.name && styles.activeChipText,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Venue */}
      <TextInput
        placeholder="Venue"
        style={styles.input}
        value={filters.venue}
        onChangeText={(text) => handleChange("venue", text)}
      />

      {/* Price */}
      <TextInput
        placeholder="Min Price"
        keyboardType="numeric"
        style={styles.input}
        value={filters.minPrice}
        onChangeText={(text) => handleChange("minPrice", text)}
      />

      <TextInput
        placeholder="Max Price"
        keyboardType="numeric"
        style={styles.input}
        value={filters.maxPrice}
        onChangeText={(text) => handleChange("maxPrice", text)}
      />

      {/* Dates */}
      <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
        <Text>{filters.startDate ? `Start: ${formatDate(filters.startDate)}` : "Start Date"}</Text>
      </TouchableOpacity>

      {showStartPicker && (
        <DateTimePicker
          value={filters.startDate || new Date()}
          mode="date"
          onChange={(e, d) => {
            setShowStartPicker(false);
            if (d) handleChange("startDate", d);
          }}
        />
      )}

      <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
        <Text>{filters.endDate ? `End: ${formatDate(filters.endDate)}` : "End Date"}</Text>
      </TouchableOpacity>

      {showEndPicker && (
        <DateTimePicker
          value={filters.endDate || new Date()}
          mode="date"
          onChange={(e, d) => {
            setShowEndPicker(false);
            if (d) handleChange("endDate", d);
          }}
        />
      )}

      {/* Clear */}
      <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
        <Text style={styles.clearText}>Clear Filters</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 10 },
  title: { fontWeight: "bold", marginBottom: 10 },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#e5e7eb",
    marginRight: 8,
  },
  activeChip: {
    backgroundColor: "#0077ff",
  },
  chipText: { color: "#333" },
  activeChipText: { color: "#fff" },

  input: {
    backgroundColor: "#f1f5f9",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },

  clearBtn: {
    marginTop: 12,
    backgroundColor: "#e74c3c",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  clearText: { color: "#fff", fontWeight: "600" },
});

export default EventFilters;