import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Alert,
  Switch,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import api from "../api";

// NOTE: Mapbox is not directly available in React Native the same way.
// Replace with react-native-mapbox-gl or use a text input for location.
// This conversion uses a plain TextInput for location with a geocode button.
// Install: @rnmapbox/maps or react-native-google-places-autocomplete for full geocoding.

const EventForm = ({ event, categories, tags, currentUser, onClose, onSave, visible }) => {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category_id: "",
    location: "",
    event_date: "",
    start_time: "",
    end_time: "",
    capacity: "",
    price: "",
    status: "upcoming",
    organizer_name: "",
    organizer_image: "",
    venue: "",
    organizer_email: "",
    parking_info: "",
    map_link: "",
    is_early_bird: false,
    early_bird_price: "",
    early_bird_deadline: "",
    latitude: "",
    longitude: "",
  });

  const [selectedTags, setSelectedTags] = useState([]);
  const [formStep, setFormStep] = useState(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || "",
        description: event.description || "",
        category_id: event.category_id || "",
        location: event.location || "",
        event_date: event.event_date ? event.event_date.split("T")[0] : "",
        start_time: event.start_time || "",
        end_time: event.end_time || "",
        capacity: event.capacity ? String(event.capacity) : "",
        price: event.price ? String(event.price) : "",
        status: event.status || "upcoming",
        organizer_name: event.organizer_name || "",
        organizer_image: event.organizer_image || event.image || "",
        venue: event.venue || "",
        organizer_email: event.organizer_email || "",
        parking_info: event.parking_info || "",
        map_link: event.map_link || "",
        is_early_bird: event.is_early_bird || false,
        early_bird_price: event.early_bird_price ? String(event.early_bird_price) : "",
        early_bird_deadline: event.early_bird_deadline || "",
        latitude: event.latitude ? String(event.latitude) : "",
        longitude: event.longitude ? String(event.longitude) : "",
      });
      setSelectedTags(
        event.tag_ids ? event.tag_ids.split(",").map(Number) : []
      );
    }
  }, [event]);

  const getAuthHeaders = () => {
    // Use AsyncStorage in React Native instead of localStorage
    // import AsyncStorage from '@react-native-async-storage/async-storage';
    // const token = await AsyncStorage.getItem('token');
    // For now keeping the same pattern — update to AsyncStorage in your app
    const token = ""; // Replace: await AsyncStorage.getItem('token')
    return { Authorization: `Bearer ${token}` };
  };

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const validateStep = () => {
    if (formStep === 1) {
      if (!formData.title.trim()) {
        setError("Event title is required");
        return false;
      }
      if (!formData.description.trim()) {
        setError("Event description is required");
        return false;
      }
    }
    if (formStep === 2) {
      if (!formData.event_date) {
        setError("Event date is required");
        return false;
      }
      if (!formData.start_time) {
        setError("Start time is required");
        return false;
      }
      if (!formData.end_time) {
        setError("End time is required");
        return false;
      }
      if (!formData.location.trim()) {
        setError("Location is required");
        return false;
      }
    }
    setError("");
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setFormStep((s) => s + 1);
  };

  const handlePrevious = () => {
    setError("");
    setFormStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (!currentUser || isSubmitting) return;
    if (!validateStep()) return;

    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        ...formData,
        created_by: currentUser.id,
        event_date: formData.event_date
          ? formData.event_date.split("T")[0]
          : formData.event_date,
        price: Number(formData.price) || 0,
        capacity: Number(formData.capacity) || 0,
        image: formData.organizer_image || null,
        venue: formData.venue || null,
        organizer_email: formData.organizer_email || null,
        parking_info: formData.parking_info || null,
        map_link: formData.map_link || null,
        tag_ids: selectedTags.join(",") || null,
        early_bird_price: formData.is_early_bird
          ? Number(formData.early_bird_price)
          : null,
        early_bird_deadline: formData.is_early_bird
          ? formData.early_bird_deadline
          : null,
      };

      const headers = getAuthHeaders();
      if (event) {
        await api.put(`/events/${event.id}`, payload, { headers });
      } else {
        await api.post("/events", payload, { headers });
      }

      await onSave();
      onClose();
    } catch (err) {
      console.error("Failed to save event:", err);
      setError(
        err.response?.data?.error || "Failed to save event. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions = ["upcoming", "ongoing", "cancelled"];

  const selectedCategoryName =
    categories.find((c) => String(c.id) === String(formData.category_id))?.name ||
    "Select Category";

  // ─── Step Indicator ───────────────────────────────────────────────────────
  const StepIndicator = () => (
    <View style={styles.stepsRow}>
      {[1, 2, 3].map((step) => {
        const labels = ["Basic Info", "Details", "Additional"];
        const isActive = formStep === step;
        const isCompleted = formStep > step;
        return (
          <View key={step} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                isActive && styles.stepCircleActive,
                isCompleted && styles.stepCircleCompleted,
              ]}
            >
              <Text
                style={[
                  styles.stepNumber,
                  (isActive || isCompleted) && styles.stepNumberActive,
                ]}
              >
                {isCompleted ? "✓" : step}
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
              ]}
            >
              {labels[step - 1]}
            </Text>
          </View>
        );
      })}
    </View>
  );

  // ─── Step 1: Basic Info ───────────────────────────────────────────────────
  const Step1 = () => (
    <View>
      {/* Title */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Event Title *</Text>
        <TextInput
          style={styles.input}
          value={formData.title}
          onChangeText={(v) => handleChange("title", v)}
          placeholder="Enter event title"
          placeholderTextColor="#9ca3af"
          autoFocus
        />
      </View>

      {/* Description */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={formData.description}
          onChangeText={(v) => handleChange("description", v)}
          placeholder="Describe your event..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
      </View>

      {/* Category */}
      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Text style={styles.pickerButtonText}>{selectedCategoryName}</Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          {/* Category Picker Modal */}
          <Modal
            visible={showCategoryPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCategoryPicker(false)}
          >
            <TouchableOpacity
              style={styles.pickerOverlay}
              activeOpacity={1}
              onPress={() => setShowCategoryPicker(false)}
            >
              <View style={styles.pickerModal}>
                <Text style={styles.pickerTitle}>Select Category</Text>
                <ScrollView>
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => {
                      handleChange("category_id", "");
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={styles.pickerOptionText}>Select Category</Text>
                  </TouchableOpacity>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.pickerOption,
                        String(formData.category_id) === String(c.id) &&
                          styles.pickerOptionSelected,
                      ]}
                      onPress={() => {
                        handleChange("category_id", String(c.id));
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          String(formData.category_id) === String(c.id) &&
                            styles.pickerOptionTextSelected,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        {/* Status */}
        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Status</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowStatusPicker(true)}
          >
            <Text style={styles.pickerButtonText}>
              {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>

          <Modal
            visible={showStatusPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowStatusPicker(false)}
          >
            <TouchableOpacity
              style={styles.pickerOverlay}
              activeOpacity={1}
              onPress={() => setShowStatusPicker(false)}
            >
              <View style={styles.pickerModal}>
                <Text style={styles.pickerTitle}>Select Status</Text>
                {statusOptions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.pickerOption,
                      formData.status === s && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      handleChange("status", s);
                      setShowStatusPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        formData.status === s && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </View>

      {/* Tags */}
      {tags.length > 0 && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tags (Optional)</Text>
          <View style={styles.tagsSelector}>
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[styles.tagCheckbox, isSelected && styles.tagCheckboxSelected]}
                  onPress={() => handleTagToggle(tag.id)}
                >
                  <Text
                    style={[
                      styles.tagCheckboxText,
                      isSelected && styles.tagCheckboxTextSelected,
                    ]}
                  >
                    {isSelected ? "✓ " : ""}{tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );

  // ─── Step 2: Date, Time, Location ─────────────────────────────────────────
  const Step2 = () => (
    <View>
      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Event Date * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={formData.event_date}
            onChangeText={(v) => handleChange("event_date", v)}
            placeholder="2025-12-31"
            placeholderTextColor="#9ca3af"
            // NOTE: Use @react-native-community/datetimepicker for a native date picker
          />
        </View>
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Start Time * (HH:MM)</Text>
          <TextInput
            style={styles.input}
            value={formData.start_time}
            onChangeText={(v) => handleChange("start_time", v)}
            placeholder="09:00"
            placeholderTextColor="#9ca3af"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>End Time * (HH:MM)</Text>
          <TextInput
            style={styles.input}
            value={formData.end_time}
            onChangeText={(v) => handleChange("end_time", v)}
            placeholder="17:00"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* Location */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Location *</Text>
        <TextInput
          style={styles.input}
          value={formData.location}
          onChangeText={(v) => handleChange("location", v)}
          placeholder="Search venue or address..."
          placeholderTextColor="#9ca3af"
          // NOTE: Replace with react-native-google-places-autocomplete
          // or @rnmapbox/maps geocoder for full autocomplete support
        />
        {formData.location ? (
          <Text style={styles.locationPreview}>📍 {formData.location}</Text>
        ) : null}
      </View>

      {/* Venue */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Venue</Text>
        <TextInput
          style={styles.input}
          value={formData.venue}
          onChangeText={(v) => handleChange("venue", v)}
          placeholder="e.g., KICC Hall"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Capacity</Text>
          <TextInput
            style={styles.input}
            value={formData.capacity}
            onChangeText={(v) => handleChange("capacity", v)}
            placeholder="Maximum attendees"
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Base Price (KES)</Text>
          <TextInput
            style={styles.input}
            value={formData.price}
            onChangeText={(v) => handleChange("price", v)}
            placeholder="0.00"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Early Bird Toggle */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>Enable Early Bird Pricing</Text>
        <Switch
          value={formData.is_early_bird}
          onValueChange={(v) => handleChange("is_early_bird", v)}
          trackColor={{ false: "#e5e7eb", true: "#bfdbfe" }}
          thumbColor={formData.is_early_bird ? "#3b82f6" : "#9ca3af"}
        />
      </View>

      {formData.is_early_bird && (
        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Early Bird Price (KES)</Text>
            <TextInput
              style={styles.input}
              value={formData.early_bird_price}
              onChangeText={(v) => handleChange("early_bird_price", v)}
              placeholder="Discounted price"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Deadline (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={formData.early_bird_deadline}
              onChangeText={(v) => handleChange("early_bird_deadline", v)}
              placeholder="2025-11-30"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      )}
    </View>
  );

  // ─── Step 3: Additional Info ──────────────────────────────────────────────
  const Step3 = () => (
    <View>
      <View style={styles.formRow}>
        <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Organizer Name</Text>
          <TextInput
            style={styles.input}
            value={formData.organizer_name}
            onChangeText={(v) => handleChange("organizer_name", v)}
            placeholder="Event organizer"
            placeholderTextColor="#9ca3af"
          />
        </View>
        <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Organizer Email</Text>
          <TextInput
            style={styles.input}
            value={formData.organizer_email}
            onChangeText={(v) => handleChange("organizer_email", v)}
            placeholder="contact@example.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Image URL */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Event Poster/Image URL</Text>
        <TextInput
          style={styles.input}
          value={formData.organizer_image}
          onChangeText={(v) => {
            handleChange("organizer_image", v);
            setImageError(false);
          }}
          placeholder="https://example.com/image.jpg"
          placeholderTextColor="#9ca3af"
          keyboardType="url"
          autoCapitalize="none"
        />
        {formData.organizer_image && !imageError && (
          <Image
            source={{ uri: formData.organizer_image }}
            style={styles.imagePreview}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Parking Info */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Parking Information</Text>
        <TextInput
          style={styles.input}
          value={formData.parking_info}
          onChangeText={(v) => handleChange("parking_info", v)}
          placeholder="e.g., Free parking available"
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Map Link */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Google Maps Link</Text>
        <TextInput
          style={styles.input}
          value={formData.map_link}
          onChangeText={(v) => handleChange("map_link", v)}
          placeholder="https://maps.google.com/..."
          placeholderTextColor="#9ca3af"
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {event ? "Edit Event" : "Create New Event"}
            </Text>
            <StepIndicator />
          </View>

          {/* Scrollable Form */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {formStep === 1 && <Step1 />}
            {formStep === 2 && <Step2 />}
            {formStep === 3 && <Step3 />}

            {/* Error */}
            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            {formStep > 1 && (
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={handlePrevious}
                disabled={isSubmitting}
              >
                <Text style={styles.btnSecondaryText}>← Previous</Text>
              </TouchableOpacity>
            )}

            {formStep < 3 ? (
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={handleNext}
                disabled={isSubmitting}
              >
                <Text style={styles.btnPrimaryText}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 1 }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>
                    {event ? "Save Changes" : "Create Event"}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ── Overlay & Modal ────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "100%",
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0a1f44",
    marginBottom: 16,
  },
  scrollArea: {
    maxHeight: "70%",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 8,
  },

  // ── Step Indicator ─────────────────────────────────────────────────────────
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  stepCircleActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  stepCircleCompleted: {
    borderColor: "#3b82f6",
    backgroundColor: "#3b82f6",
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9ca3af",
  },
  stepNumberActive: {
    color: "#fff",
  },
  stepLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
    textAlign: "center",
  },
  stepLabelActive: {
    color: "#3b82f6",
  },

  // ── Form Elements ──────────────────────────────────────────────────────────
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: "row",
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1f2937",
    backgroundColor: "#fff",
  },
  textarea: {
    minHeight: 100,
    paddingTop: 10,
  },
  locationPreview: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 6,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  // ── Tags ───────────────────────────────────────────────────────────────────
  tagsSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  tagCheckbox: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 6,
  },
  tagCheckboxSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  tagCheckboxText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },
  tagCheckboxTextSelected: {
    color: "#3b82f6",
    fontWeight: "700",
  },

  // ── Picker ─────────────────────────────────────────────────────────────────
  pickerButton: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  pickerButtonText: {
    fontSize: 14,
    color: "#1f2937",
    flex: 1,
  },
  pickerArrow: {
    fontSize: 12,
    color: "#6b7280",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerModal: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    maxHeight: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a1f44",
    marginBottom: 12,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: "#eff6ff",
  },
  pickerOptionText: {
    fontSize: 14,
    color: "#374151",
  },
  pickerOptionTextSelected: {
    color: "#3b82f6",
    fontWeight: "700",
  },

  // ── Image Preview ──────────────────────────────────────────────────────────
  imagePreview: {
    marginTop: 10,
    width: 180,
    height: 130,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  // ── Error ──────────────────────────────────────────────────────────────────
  errorBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
  },
  errorText: {
    color: "#991b1b",
    fontWeight: "600",
    fontSize: 14,
  },

  // ── Action Buttons ─────────────────────────────────────────────────────────
  modalActions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    alignItems: "center",
  },
  btnPrimary: {
    backgroundColor: "#3b82f6",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  btnSecondaryText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 14,
  },
});

export default EventForm;