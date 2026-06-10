import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import TicketManagement from "./TicketManagement";

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
    event_image: "",
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
      event_image: event.image || event.event_image || "",
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

    setSelectedTags(event.tag_ids ? event.tag_ids.split(",").map(Number) : []);
  }, [event]);

  // -------------------------
  // Mapbox Geocoder (SAFE)
  // -------------------------
  useEffect(() => {
    if (step !== 2) return;
    if (useManualLocation) return;
    if (!geocoderContainerRef.current) return;
    if (geocoderRef.current) return;

    if (!mapboxgl.accessToken) {
      setUseManualLocation(true);
      return;
    }

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      types: "place,address,poi",
      placeholder: "Search for a venue or address",
      marker: false,
      countries: "ke"
    });

    geocoder.addTo(geocoderContainerRef.current);

    geocoder.on("result", (e) => {
      const place = e.result;
      const center = place?.center;

      if (!center || center.length < 2) return;

      const latitude = Number(center[1]);
      const longitude = Number(center[0]);

      if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;

      setFormData((prev) => ({
        ...prev,
        location: place.place_name || "",
        latitude,
        longitude
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
  // Fallback geocode
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
      const best = data.features?.[0];

      if (!best?.center) return null;

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
    setFormData((prev) => ({
      ...prev,
      location: "",
      latitude: "",
      longitude: ""
    }));

    geocoderRef.current?.clear();
  };

  // -------------------------
  // Validation
  // -------------------------
  const validateStep = () => {
    if (step === 1) {
      if (!formData.title.trim()) return "Event title is required.";
      if (!formData.description.trim()) return "Description is required.";
      if (!formData.category_id) return "Category required.";
      if (formData.price === "") return "Price required.";
      if (!formData.capacity) return "Capacity required.";
    }

    if (step === 3) {
      if (!formData.event_date) return "Event date required.";
      if (!formData.start_time) return "Start time required.";
    }

    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) return setStepError(err);

    setStepError("");
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStepError("");
    setStep((s) => s - 1);
  };

  const handleStepClick = (target) => {
    if (target === step) return;

    if (target < step) {
      setStepError("");
      setStep(target);
      return;
    }

    for (let s = step; s < target; s++) {
      const err = validateStep();
      if (err) {
        setStepError(err);
        setTimeout(() => setStep(s), 0);
        return;
      }
    }

    setStepError("");
    setStep(target);
  };

  const eventId = event?.id ?? null;

  // -------------------------
  // Submit
  // -------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    const err = validateStep();
    if (err) return setStepError(err);

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
        image: formData.event_image || null,
        location: geo?.location || formData.location,
        latitude:
          geo?.latitude ??
          (formData.latitude !== "" ? Number(formData.latitude) : null),
        longitude:
          geo?.longitude ??
          (formData.longitude !== "" ? Number(formData.longitude) : null),
        event_date: formData.event_date,
        price: Number(formData.price) || 0,
        capacity: Number(formData.capacity) || 0,
        tag_ids: selectedTags.join(",") || null
      };

      const headers = {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      };

      if (eventId) {
        await api.put(`/events/${eventId}`, payload, { headers });
      } else {
        await api.post("/events", payload, { headers });
      }

      await onSave();
      onClose();
    } catch (err) {
      setSubmitError(err.response?.data?.error || "Failed to save event.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="modal-overlay">
      <div className="modal large">

        <div className="modal-header">
          <h3>{eventId ? "Edit Event" : "Create Event"}</h3>

          <div className="form-steps">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`step-btn${step === i + 1 ? " active" : ""}`}
                onClick={() => handleStepClick(i + 1)}
              >
                {i + 1}. {label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="form-step">
              <input name="title" value={formData.title} onChange={handleChange} placeholder="Title" />
              <textarea name="description" value={formData.description} onChange={handleChange} />

              <input name="price" type="number" value={formData.price} onChange={handleChange} />
              <input name="capacity" type="number" value={formData.capacity} onChange={handleChange} />
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="form-step">

              <button type="button" onClick={() => setUseManualLocation(v => !v)}>
                Toggle Mode
              </button>

              {!useManualLocation ? (
                <div ref={geocoderContainerRef} />
              ) : (
                <input name="location" value={formData.location} onChange={handleChange} />
              )}

              {formData.location && (
                <div>
                  📍 {formData.location}
                  {formData.latitude && (
                    <span>
                      {" "}
                      ({Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="form-step">
              <input type="date" name="event_date" value={formData.event_date} onChange={handleChange} />
              <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} />
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="form-step">
              <input name="organizer_name" value={formData.organizer_name} onChange={handleChange} />
              <input name="organizer_email" value={formData.organizer_email} onChange={handleChange} />
            </div>
          )}

          {/* STEP 5 */}
          {step === 5 && eventId && (
            <TicketManagement event={event} embedded />
          )}

          {stepError && <div className="error">⚠️ {stepError}</div>}
          {submitError && <div className="error">❌ {submitError}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>

            {step > 1 && <button type="button" onClick={handleBack}>Back</button>}

            {step < STEPS.length ? (
              <button type="button" onClick={handleNext}>Next</button>
            ) : step === 4 ? (
              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Event"}
              </button>
            ) : (
              <button type="button" onClick={onClose}>Done</button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};

export default EventForm;