import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const STEPS = ["Basic Info", "Location", "Date & Time", "Organizer", "Ticket Types"];

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
  const [ticketTypes, setTicketTypes] = useState([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState("");
  const [editingTicket, setEditingTicket] = useState(null); // null = no form open
  const blankTicket = {
    name: "", description: "", price: "", quantity_available: "",
    is_early_bird: false, early_bird_deadline: "",
    is_group_discount: false, group_size: "", group_discount_percent: ""
  };
  const [ticketDraft, setTicketDraft] = useState(blankTicket);
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
  // Load existing ticket types (edit mode, step 5)
  // -------------------------
  useEffect(() => {
    if (step !== 5) return;
    const eventId = event?.id ?? null;
    if (!eventId) return;
    const fetchTicketTypes = async () => {
      try {
        setTicketLoading(true);
        const res = await api.get(`/events/${eventId}/ticket-types`);
        setTicketTypes(res.data.ticket_types || []);
      } catch (err) {
        console.error("Failed to load ticket types:", err);
      } finally {
        setTicketLoading(false);
      }
    };
    fetchTicketTypes();
  }, [step, event]);

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
  // Ticket type helpers
  // -------------------------
  const handleTicketDraftChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTicketDraft((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setTicketError("");
  };

  const validateTicketDraft = (draft) => {
    if (!draft.name.trim()) return "Ticket name is required.";
    if (draft.price === "" || isNaN(Number(draft.price))) return "Price is required (use 0 for free).";
    if (!draft.quantity_available || isNaN(Number(draft.quantity_available)) || Number(draft.quantity_available) < 1)
      return "Quantity must be at least 1.";
    if (draft.is_early_bird && !draft.early_bird_deadline) return "Early bird deadline is required.";
    if (draft.is_group_discount) {
      if (!draft.group_size || isNaN(Number(draft.group_size))) return "Group size is required.";
      if (draft.group_discount_percent === "" || isNaN(Number(draft.group_discount_percent))) return "Group discount % is required.";
    }
    return null;
  };

  const handleTicketSave = async () => {
    const err = validateTicketDraft(ticketDraft);
    if (err) { setTicketError(err); return; }

    // For new events, the event won't have an id yet — warn the user
    if (!eventId) {
      setTicketError("Save the event first (click Create Event on the previous step), then re-open it to add ticket types.");
      return;
    }

    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    const payload = {
      ...ticketDraft,
      price: Number(ticketDraft.price),
      quantity_available: Number(ticketDraft.quantity_available),
      group_size: ticketDraft.group_size ? Number(ticketDraft.group_size) : null,
      group_discount_percent: ticketDraft.group_discount_percent ? Number(ticketDraft.group_discount_percent) : null,
      early_bird_deadline: ticketDraft.early_bird_deadline || null,
    };

    try {
      setTicketLoading(true);
      setTicketError("");

      if (editingTicket?.id) {
        // Update existing
        await api.put(`/ticket-types/${editingTicket.id}`, payload, { headers });
      } else {
        // Create new
        await api.post(`/events/${eventId}/ticket-types`, payload, { headers });
      }

      // Refresh list
      const res = await api.get(`/events/${eventId}/ticket-types`);
      setTicketTypes(res.data.ticket_types || []);
      setEditingTicket(null);
      setTicketDraft(blankTicket);
    } catch (err) {
      setTicketError(err.response?.data?.error || "Failed to save ticket type.");
    } finally {
      setTicketLoading(false);
    }
  };

  const handleTicketEdit = (tt) => {
    setEditingTicket(tt);
    setTicketDraft({
      name: tt.name || "",
      description: tt.description || "",
      price: tt.price ?? "",
      quantity_available: tt.quantity_available ?? "",
      is_early_bird: tt.is_early_bird || false,
      early_bird_deadline: tt.early_bird_deadline?.split("T")[0] || "",
      is_group_discount: tt.is_group_discount || false,
      group_size: tt.group_size ?? "",
      group_discount_percent: tt.group_discount_percent ?? "",
    });
    setTicketError("");
  };

  const handleTicketDelete = async (ttId) => {
    if (!window.confirm("Delete this ticket type? This cannot be undone.")) return;
    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      setTicketLoading(true);
      await api.delete(`/ticket-types/${ttId}`, { headers });
      setTicketTypes((prev) => prev.filter((t) => t.id !== ttId));
    } catch (err) {
      setTicketError(err.response?.data?.error || "Failed to delete ticket type.");
    } finally {
      setTicketLoading(false);
    }
  };

  const handleTicketCancel = () => {
    setEditingTicket(null);
    setTicketDraft(blankTicket);
    setTicketError("");
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

          {/* ════════════════════════════════
              STEP 5 — Ticket Types
          ════════════════════════════════ */}
          {step === 5 && (
            <div className="form-step">

              {!eventId && (
                <div className="info-banner" style={{
                  background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "8px",
                  padding: "12px 16px", marginBottom: "16px", fontSize: "0.9rem", color: "#92400e"
                }}>
                  ⚠️ Ticket types can only be added after the event is created. Complete the form and save first, then re-open the event to add ticket types.
                </div>
              )}

              {/* ── Existing ticket types list ── */}
              {ticketLoading && <p style={{ color: "#6b7280", textAlign: "center" }}>Loading…</p>}

              {!ticketLoading && ticketTypes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                  {ticketTypes.map((tt) => (
                    <div key={tt.id} style={{
                      border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px 16px",
                      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                      background: "#f9fafb"
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1f2937" }}>
                          {tt.name}
                          {tt.is_early_bird && <span style={{ marginLeft: "8px", fontSize: "0.75rem", background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "12px", border: "1px solid #f59e0b" }}>🐦 Early Bird</span>}
                          {tt.is_group_discount && <span style={{ marginLeft: "8px", fontSize: "0.75rem", background: "#eff6ff", color: "#1e40af", padding: "2px 8px", borderRadius: "12px", border: "1px solid #3b82f6" }}>👥 Group Discount</span>}
                        </div>
                        {tt.description && <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "4px" }}>{tt.description}</div>}
                        <div style={{ marginTop: "6px", fontSize: "0.9rem", color: "#374151", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                          <span>💰 KES {Number(tt.price).toLocaleString()}</span>
                          <span>🎟️ {tt.quantity_available - (tt.quantity_sold || 0)} / {tt.quantity_available} available</span>
                          {tt.is_early_bird && tt.early_bird_deadline && (
                            <span>📅 Deadline: {new Date(tt.early_bird_deadline).toLocaleDateString("en-GB")}</span>
                          )}
                          {tt.is_group_discount && (
                            <span>👥 {tt.group_size}+ people → {tt.group_discount_percent}% off</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginLeft: "12px" }}>
                        <button type="button" onClick={() => handleTicketEdit(tt)}
                          style={{ background: "none", border: "1px solid #d1d5db", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "0.85rem" }}>
                          ✏️ Edit
                        </button>
                        <button type="button" onClick={() => handleTicketDelete(tt.id)}
                          style={{ background: "none", border: "1px solid #fca5a5", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "0.85rem", color: "#dc2626" }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!ticketLoading && ticketTypes.length === 0 && eventId && (
                <p style={{ color: "#9ca3af", textAlign: "center", marginBottom: "16px" }}>
                  No ticket types yet. Add one below.
                </p>
              )}

              {/* ── Add / Edit form ── */}
              {eventId && (
                <div style={{
                  border: "2px dashed #d1d5db", borderRadius: "10px", padding: "20px",
                  background: "#f9fafb"
                }}>
                  <h4 style={{ margin: "0 0 16px", color: "#374151", fontSize: "1rem" }}>
                    {editingTicket ? "✏️ Edit Ticket Type" : "➕ Add Ticket Type"}
                  </h4>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Ticket Name *</label>
                      <input
                        name="name"
                        value={ticketDraft.name}
                        onChange={handleTicketDraftChange}
                        placeholder="e.g. VIP, Regular, Student"
                      />
                    </div>
                    <div className="form-group">
                      <label>Price (KES) *</label>
                      <input
                        type="number"
                        name="price"
                        value={ticketDraft.price}
                        onChange={handleTicketDraftChange}
                        placeholder="0 for free"
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantity Available *</label>
                      <input
                        type="number"
                        name="quantity_available"
                        value={ticketDraft.quantity_available}
                        onChange={handleTicketDraftChange}
                        placeholder="e.g. 100"
                        min="1"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label>Description</label>
                    <input
                      name="description"
                      value={ticketDraft.description}
                      onChange={handleTicketDraftChange}
                      placeholder="e.g. Includes backstage access, priority seating"
                    />
                  </div>

                  {/* Early bird toggle */}
                  <div className="form-group" style={{ marginBottom: "8px" }}>
                    <label style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        name="is_early_bird"
                        checked={ticketDraft.is_early_bird}
                        onChange={handleTicketDraftChange}
                      />
                      {" "}🐦 Early Bird Pricing
                    </label>
                  </div>

                  {ticketDraft.is_early_bird && (
                    <div className="form-group" style={{ marginBottom: "12px" }}>
                      <label>Early Bird Deadline *</label>
                      <input
                        type="date"
                        name="early_bird_deadline"
                        value={ticketDraft.early_bird_deadline}
                        onChange={handleTicketDraftChange}
                      />
                    </div>
                  )}

                  {/* Group discount toggle */}
                  <div className="form-group" style={{ marginBottom: "8px" }}>
                    <label style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        name="is_group_discount"
                        checked={ticketDraft.is_group_discount}
                        onChange={handleTicketDraftChange}
                      />
                      {" "}👥 Group Discount
                    </label>
                  </div>

                  {ticketDraft.is_group_discount && (
                    <div className="form-row">
                      <div className="form-group">
                        <label>Min Group Size *</label>
                        <input
                          type="number"
                          name="group_size"
                          value={ticketDraft.group_size}
                          onChange={handleTicketDraftChange}
                          placeholder="e.g. 5"
                          min="2"
                        />
                      </div>
                      <div className="form-group">
                        <label>Discount % *</label>
                        <input
                          type="number"
                          name="group_discount_percent"
                          value={ticketDraft.group_discount_percent}
                          onChange={handleTicketDraftChange}
                          placeholder="e.g. 15"
                          min="1"
                          max="100"
                        />
                      </div>
                    </div>
                  )}

                  {ticketError && (
                    <div className="error" style={{ margin: "8px 0" }}>⚠️ {ticketError}</div>
                  )}

                  <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleTicketSave}
                      disabled={ticketLoading}
                    >
                      {ticketLoading ? "Saving…" : editingTicket ? "💾 Update" : "➕ Add Ticket Type"}
                    </button>
                    {editingTicket && (
                      <button type="button" className="btn-secondary" onClick={handleTicketCancel}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}


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

            {step < STEPS.length - 1 ? (
              <button type="button" className="btn-primary" onClick={handleNext}>
                Next →
              </button>
            ) : step === STEPS.length - 1 ? (
              <>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Saving..." : (eventId ? "💾 Save Changes" : "🚀 Create Event")}
                </button>
                {eventId && (
                  <button type="button" className="btn-secondary" onClick={() => setStep(5)}>
                    Ticket Types →
                  </button>
                )}
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={onClose}>
                ✅ Done
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};

export default EventForm;