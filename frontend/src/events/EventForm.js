import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

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
  const [formStep, setFormStep] = useState(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const geocoderContainer = useRef(null);
  const geocoderRef = useRef(null);
  const [locationInputMode, setLocationInputMode] = useState("search");

  // =========================
  // Load event
  // =========================
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
        capacity: event.capacity || "",
        price: event.price || "",
        status: event.status || "upcoming",
        organizer_name: event.organizer_name || "",
        organizer_image: event.organizer_image || event.image || "",
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
    }
  }, [event]);

  // =========================
  // Mapbox geocoder init
  // =========================
  useEffect(() => {
    if (!geocoderContainer.current || geocoderRef.current) return;

    if (!mapboxgl.accessToken) {
      setLocationInputMode("manual");
      return;
    }

    try {
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        types: "place,address,poi",
        countries: "ke",
        placeholder: "Search location...",
        marker: false
      });

      geocoder.addTo(geocoderContainer.current);
      geocoderRef.current = geocoder;

      if (event?.location) {
        geocoder.setInput(event.location);
      }

      geocoder.on("result", (e) => {
        const { place_name, center } = e.result;

        setFormData((prev) => ({
          ...prev,
          location: place_name,
          longitude: center[0],
          latitude: center[1]
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
    } catch (err) {
      console.error("Geocoder error:", err);
      setLocationInputMode("manual");
    }

    return () => {
      if (geocoderRef.current) {
        try {
          geocoderRef.current.onRemove();
        } catch {}
        geocoderRef.current = null;
      }
    };
  }, []);

  // =========================
  // Helpers
  // =========================
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const handleTagSelection = (tagId) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  // =========================
  // 🔥 GPS FIX (OPTION B)
  // =========================
  const geocodeLocation = async (text) => {
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
    } catch (err) {
      console.error("Geocode failed:", err);
      return null;
    }
  };

  // =========================
  // Submit (FIXED, FULL COMPATIBLE)
  // =========================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setError("");

      let geo = null;

      // 🔥 auto-geocode if missing coords
      if (!formData.latitude || !formData.longitude) {
        geo = await geocodeLocation(formData.location);
      }

      const payload = {
        ...formData,
        created_by: currentUser.id,
        location: geo?.location || formData.location,
        latitude: geo?.latitude || formData.latitude || null,
        longitude: geo?.longitude || formData.longitude || null,
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
          : null
      };

      if (event) {
        await api.put(`/events/${event.id}`, payload, {
          headers: getAuthHeaders()
        });
      } else {
        await api.post("/events", payload, {
          headers: getAuthHeaders()
        });
      }

      await onSave();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to save event");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // UI (UNCHANGED STRUCTURE)
  // =========================
  return (
    <div className="modal-overlay">
      <div className="modal large">
        <div className="modal-header">
          <h3>{event ? "Edit Event" : "Create New Event"}</h3>

          <div className="form-steps">
            <span className={formStep === 1 ? "active" : ""}>1. Basic Info</span>
            <span className={formStep === 2 ? "active" : ""}>2. Details</span>
            <span className={formStep === 3 ? "active" : ""}>3. Additional</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {formStep === 1 && (
            <div className="form-step">
              <div className="form-group">
                <label>Event Title *</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>
            </div>
          )}

          {formStep === 2 && (
            <div className="form-step">
              <div className="form-group">
                <label>Location *</label>

                <button
                  type="button"
                  className="location-mode-toggle"
                  onClick={() =>
                    setLocationInputMode((m) =>
                      m === "search" ? "manual" : "search"
                    )
                  }
                >
                  {locationInputMode === "search"
                    ? "Switch to Manual"
                    : "Switch to Search"}
                </button>

                <div
                  ref={geocoderContainer}
                  style={{
                    display: locationInputMode === "search" ? "block" : "none"
                  }}
                />

                {locationInputMode === "manual" && (
                  <input
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                  />
                )}

                {formData.location && (
                  <div className="location-confirmed">
                    📍 {formData.location}
                    {formData.latitude && formData.longitude && (
                      <span>
                        ({Number(formData.latitude).toFixed(4)},
                        {Number(formData.longitude).toFixed(4)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="modal-actions">
            {formStep > 1 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFormStep(formStep - 1)}
              >
                Back
              </button>
            )}

            {formStep < 2 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setFormStep(formStep + 1)}
              >
                Next
              </button>
            ) : (
              <button type="submit" className="btn-primary">
                {isSubmitting ? "Saving..." : "Save Event"}
              </button>
            )}

            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </form>
      </div>
    </div>
  );
};

export default EventForm;