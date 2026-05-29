import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const STEPS = ["Basic Info", "Location", "Date & Time", "Organizer"];

const EventForm = ({ event, categories, tags, currentUser, onClose, onSave }) => {
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
    longitude: ""
  });

  const [selectedTags, setSelectedTags] = useState([]);
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [useManualLocation, setUseManualLocation] = useState(false);

  const geocoderRef = useRef(null);
  const geocoderContainerRef = useRef(null);

  // -------------------------
  // Load event (edit mode)
  // -------------------------
  useEffect(() => {
    if (!event) return;

    setFormData({
      title: event.title || "",
      description: event.description || "",
      category_id: event.category_id || "",
      location: event.location || "",
      event_date: event.event_date?.split("T")[0] || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      capacity: event.capacity || "",
      price: event.price || "",
      status: event.status || "upcoming",
      organizer_name: event.organizer_name || "",
      organizer_image: event.organizer_image || "",
      venue: event.venue || "",
      organizer_email: event.organizer_email || "",
      parking_info: event.parking_info || "",
      map_link: event.map_link || "",
      is_early_bird: event.is_early_bird || false,
      early_bird_price: event.early_bird_price || "",
      early_bird_deadline: event.early_bird_deadline || "",
      latitude: event.latitude || "",
      longitude: event.longitude || ""
    });

    setSelectedTags(
      event.tag_ids ? event.tag_ids.split(",").map(Number) : []
    );
  }, [event]);

  // -------------------------
  // Mapbox geocoder — only mounts on step 2
  // -------------------------
  useEffect(() => {
    if (step !== 2) return;
    if (useManualLocation) return;
    if (!geocoderContainerRef.current) return;
    if (geocoderRef.current) return;

    if (!mapboxgl.accessToken) {
      console.warn("Mapbox token missing — falling back to manual");
      setUseManualLocation(true);
      return;
    }

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      types: "place,address,poi",
      placeholder: "Search for a venue or address in Kenya",
      marker: false,
      countries: "ke"
    });

    geocoder.addTo(geocoderContainerRef.current);

    geocoder.on("result", (e) => {
      const place = e.result;
      setFormData((prev) => ({
        ...prev,
        location: place.place_name,
        latitude: place.center[1],
        longitude: place.center[0]
      }));
    });

    geocoder.on("clear", () => {
      setFormData((prev) => ({
        ...prev,
        location: "",
        latitude: "",
        longitude: ""
      }));
    });

    geocoderRef.current = geocoder;

    return () => {
      if (geocoderRef.current) {
        geocoderRef.current.remove();
        geocoderRef.current = null;
      }
    };
  }, [step, useManualLocation]);

  // -------------------------
  // Manual geocode fallback
  // -------------------------
  const geocodeFallback = async (text) => {
    if (!text) return null;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          text
        )}.json?access_token=${mapboxgl.accessToken}`
      );
      const data = await res.json();
      if (!data.features?.length) return null;
      const best = data.features[0];
      return {
        location: best.place_name,
        latitude: best.center[1],
        longitude: best.center[0]
      };
    } catch {
      return null;
    }
  };

  // -------------------------
  // Helpers
  // -------------------------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
    setStepError("");
  };

  const toggleTag = (id) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const clearLocation = () => {
    setFormData((prev) => ({ ...prev, location: "", latitude: "", longitude: "" }));
    if (geocoderRef.current) geocoderRef.current.clear();
  };

  // -------------------------
  // Per-step validation (no browser required, fully JS)
  // -------------------------
  const validateStep = () => {
    if (step === 1) {
      if (!formData.title.trim()) return "Event title is required.";
      if (!formData.description.trim()) return "Description is required.";
      if (!formData.category_id) return "Please select a category.";
      if (formData.price === "" || formData.price === null) return "Price is required (use 0 for free).";
      if (!formData.capacity) return "Capacity is required.";
    }
    if (step === 3) {
      if (!formData.event_date) return "Event date is required.";
      if (!formData.start_time) return "Start time is required.";
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) {
      setStepError(err);
      return;
    }
    setStepError("");
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStepError("");
    setStep((s) => s - 1);
  };

  // Allow clicking a step label to jump directly to it.
  // Going forward: validate every step up to (but not including) the target.
  // Going backward: always allowed.
  const handleStepClick = (targetStep) => {
    if (targetStep === step) return;

    if (targetStep < step) {
      // Going back — no validation needed
      setStepError("");
      setStep(targetStep);
      return;
    }

    // Going forward — validate each intermediate step
    for (let s = step; s < targetStep; s++) {
      // Temporarily evaluate validation for step s
      const err = (() => {
        if (s === 1) {
          if (!formData.title.trim()) return "Event title is required.";
          if (!formData.description.trim()) return "Description is required.";
          if (!formData.category_id) return "Please select a category.";
          if (formData.price === "" || formData.price === null) return "Price is required (use 0 for free).";
          if (!formData.capacity) return "Capacity is required.";
        }
        if (s === 3) {
          if (!formData.event_date) return "Event date is required.";
          if (!formData.start_time) return "Start time is required.";
        }
        return null;
      })();

      if (err) {
        setStepError(err);
        setStep(s); // Jump to the failing step so the user sees the error
        return;
      }
    }

    setStepError("");
    setStep(targetStep);
  };

  // Guard: never PUT to /events/undefined
  const eventId = event?.id ?? null;

  // -------------------------
  // Submit
  // -------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Final validation on last step
    const err = validateStep();
    if (err) {
      setStepError(err);
      return;
    }

    try {
      setLoading(true);
      setSubmitError("");

      let geo = null;
      if (!formData.latitude || !formData.longitude) {
        geo = await geocodeFallback(formData.location);
      }

      const payload = {
        ...formData,
        created_by: currentUser.id,
        location: geo?.location || formData.location,
        latitude: geo?.latitude || formData.latitude || null,
        longitude: geo?.longitude || formData.longitude || null,
        event_date: formData.event_date?.split("T")[0],
        price: Number(formData.price) || 0,
        capacity: Number(formData.capacity) || 0,
        tag_ids: selectedTags.join(",") || null
      };

      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

      if (eventId) {
        await api.put(`/events/${eventId}`, payload, { headers });
      } else {
        await api.post("/events", payload, { headers });
      }

      await onSave();
      onClose();
    } catch (err) {
      setSubmitError(err.response?.data?.error || "Failed to save event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="modal-overlay">
      <div className="modal large" style={{ width: "100%" }}>

        {/* ── Modal Header ── */}
        <div className="modal-header">
          <h3>{eventId ? "✏️ Edit Event" : "➕ Create Event"}</h3>
          <div className="form-steps">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`step-btn${step === i + 1 ? " active" : ""}${i + 1 < step ? " completed" : ""}`}
                onClick={() => handleStepClick(i + 1)}
                title={`Go to ${label}`}
              >
                <span className="step-number">{i + 1 < step ? "✓" : i + 1}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* NOTE: noValidate disables browser HTML5 validation so our JS validation runs instead */}
        <form onSubmit={handleSubmit} noValidate>

          {/* ════════════════════════════════
              STEP 1 — Basic Info
          ════════════════════════════════ */}
          {step === 1 && (
            <div className="form-step">

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Event Title *</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Nairobi Tech Summit 2025"
                />
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe your event..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category *</label>
                  <select name="category_id" value={formData.category_id} onChange={handleChange}>
                    <option value="">— Select category —</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Price (KES) *</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="0 for free events"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label>Capacity *</label>
                  <input
                    type="number"
                    name="capacity"
                    value={formData.capacity}
                    onChange={handleChange}
                    placeholder="Max attendees"
                    min="1"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    name="is_early_bird"
                    checked={formData.is_early_bird}
                    onChange={handleChange}
                  />
                  {" "}Enable Early Bird Pricing
                </label>
              </div>

              {formData.is_early_bird && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Early Bird Price (KES)</label>
                    <input
                      type="number"
                      name="early_bird_price"
                      value={formData.early_bird_price}
                      onChange={handleChange}
                      placeholder="Discounted price"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label>Early Bird Deadline</label>
                    <input
                      type="date"
                      name="early_bird_deadline"
                      value={formData.early_bird_deadline}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}

              {tags && tags.length > 0 && (
                <div className="form-group" style={{ marginBottom: "16px" }}>
                  <label>Tags</label>
                  <div className="tags-selector">
                    {tags.map((t) => (
                      <label key={t.id} className="tag-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(t.id)}
                          onChange={() => toggleTag(t.id)}
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════
              STEP 2 — Location
          ════════════════════════════════ */}
          {step === 2 && (
            <div className="form-step">

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>
                  Search Location
                  <button
                    type="button"
                    className="location-mode-toggle"
                    onClick={() => {
                      setUseManualLocation((v) => !v);
                      clearLocation();
                    }}
                  >
                    {useManualLocation ? "Use Map Search" : "Enter Manually"}
                  </button>
                </label>

                {!useManualLocation ? (
                  <div ref={geocoderContainerRef} />
                ) : (
                  <input
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g. Kenyatta International Convention Centre, Nairobi"
                  />
                )}

                {formData.location && (
                  <div className="location-confirmed">
                    <span className="location-confirmed__pin">📍</span>
                    <span className="location-confirmed__text">{formData.location}</span>
                    {formData.latitude && (
                      <span className="location-confirmed__coords">
                        {Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)}
                      </span>
                    )}
                    <button
                      type="button"
                      className="location-confirmed__clear"
                      onClick={clearLocation}
                      title="Clear location"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Venue / Hall Name</label>
                <input
                  name="venue"
                  value={formData.venue}
                  onChange={handleChange}
                  placeholder="e.g. Main Hall, Rooftop Terrace"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Parking Info</label>
                  <input
                    name="parking_info"
                    value={formData.parking_info}
                    onChange={handleChange}
                    placeholder="e.g. Free parking available on-site"
                  />
                </div>
                <div className="form-group">
                  <label>Google Maps Link</label>
                  <input
                    name="map_link"
                    value={formData.map_link}
                    onChange={handleChange}
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              STEP 3 — Date & Time
          ════════════════════════════════ */}
          {step === 3 && (
            <div className="form-step">
              <div className="form-row">
                <div className="form-group">
                  <label>Event Date *</label>
                  <input
                    type="date"
                    name="event_date"
                    value={formData.event_date}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Start Time *</label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════
              STEP 4 — Organizer
          ════════════════════════════════ */}
          {step === 4 && (
            <div className="form-step">
              <div className="form-row">
                <div className="form-group">
                  <label>Organizer Name</label>
                  <input
                    name="organizer_name"
                    value={formData.organizer_name}
                    onChange={handleChange}
                    placeholder="e.g. EventHyper Kenya"
                  />
                </div>
                <div className="form-group">
                  <label>Organizer Email</label>
                  <input
                    type="email"
                    name="organizer_email"
                    value={formData.organizer_email}
                    onChange={handleChange}
                    placeholder="organizer@example.com"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>Organizer Image URL</label>
                <input
                  name="organizer_image"
                  value={formData.organizer_image}
                  onChange={handleChange}
                  placeholder="https://... (logo or profile photo)"
                />
                {formData.organizer_image && (
                  <img
                    src={formData.organizer_image}
                    alt="Organizer preview"
                    style={{
                      marginTop: "8px",
                      width: "80px",
                      height: "80px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "2px solid #e5e7eb"
                    }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Step validation error ── */}
          {stepError && (
            <div className="error" style={{ margin: "0 24px 12px" }}>
              ⚠️ {stepError}
            </div>
          )}

          {/* ── Submit error ── */}
          {submitError && (
            <div className="error" style={{ margin: "0 24px 12px" }}>
              ❌ {submitError}
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>

            {step > 1 && (
              <button type="button" className="btn-secondary" onClick={handleBack}>
                ← Back
              </button>
            )}

            {step < STEPS.length ? (
              <button type="button" className="btn-primary" onClick={handleNext}>
                Next →
              </button>
            ) : (
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Saving..." : (eventId ? "💾 Save Changes" : "🚀 Create Event")}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};

export default EventForm;