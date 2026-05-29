import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const EventForm = ({
  event,
  categories,
  tags,
  currentUser,
  onClose,
  onSave
}) => {
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
  // Mapbox init (SAFE)
  // -------------------------
  useEffect(() => {
    if (!geocoderContainerRef.current) return;
    if (geocoderRef.current) return;

    if (!mapboxgl.accessToken) {
      console.warn("Mapbox token missing");
      return;
    }

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      types: "place,address,poi",
      placeholder: "Search location",
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
      geocoder.remove();
      geocoderRef.current = null;
    };
  }, []);

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
  };

  const toggleTag = (id) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  // -------------------------
  // Submit (ROBUST)
  // -------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

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

      if (event) {
        await api.put(`/events/${event.id}`, payload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });
      } else {
        await api.post("/events", payload, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        });
      }

      await onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save event");
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
        <h2>{event ? "Edit Event" : "Create Event"}</h2>

        <form onSubmit={handleSubmit}>
          {/* BASIC */}
          {step === 1 && (
            <>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Title"
              />

              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Description"
              />
            </>
          )}

          {/* LOCATION */}
          {step === 2 && (
            <>
              <label>Location (Mapbox)</label>
              <div ref={geocoderContainerRef} />

              <input
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Manual fallback"
              />

              {formData.latitude && (
                <p>
                  {formData.latitude}, {formData.longitude}
                </p>
              )}
            </>
          )}

          {/* ACTIONS */}
          <div className="modal-actions">
            {step > 1 && (
              <button type="button" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}

            {step < 2 ? (
              <button type="button" onClick={() => setStep(step + 1)}>
                Next
              </button>
            ) : (
              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
            )}

            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>

          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default EventForm;