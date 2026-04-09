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
  const [geocoderReady, setGeocoderReady] = useState(false);
  const [locationInputMode, setLocationInputMode] = useState("search"); // "search" | "manual"

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || "",
        description: event.description || "",
        category_id: event.category_id || "",
        location: event.location || "",
        event_date: event.event_date ? event.event_date.split('T')[0] : "",
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
      setSelectedTags(event.tag_ids ? event.tag_ids.split(',').map(Number) : []);
    }
  }, [event]);
  // Mapbox Geocoder — initialised once, pre-filled when editing
  useEffect(() => {
    if (!geocoderContainer.current || geocoderRef.current) return;
    if (!mapboxgl.accessToken) {
      // No token — fall back to manual mode immediately
      setLocationInputMode("manual");
      return;
    }

    try {
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        types: "place,address,poi",
        countries: "ke",
        placeholder: "Search venue or address in Kenya…",
        marker: false
      });

      geocoder.addTo(geocoderContainer.current);
      geocoderRef.current = geocoder;
      setGeocoderReady(true);

      // Pre-fill the geocoder input when editing an existing event
      if (event?.location) {
        // MapboxGeocoder exposes setInput to set the text in the search box
        geocoder.setInput(event.location);
      }

      geocoder.on("result", (e) => {
        const { place_name, center } = e.result;
        setFormData(prev => ({
          ...prev,
          location: place_name,
          longitude: center[0],
          latitude: center[1]
        }));
      });

      geocoder.on("clear", () => {
        setFormData(prev => ({
          ...prev,
          location: "",
          longitude: "",
          latitude: ""
        }));
      });
    } catch (err) {
      console.error("Mapbox Geocoder failed to initialise:", err);
      setLocationInputMode("manual");
    }

    return () => {
      if (geocoderRef.current) {
        try { geocoderRef.current.onRemove(); } catch {}
        geocoderRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ 
      ...formData, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const handleTagSelection = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
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

  const handleNext = (e) => {
    e.preventDefault();
    if (validateStep()) {
      setFormStep(formStep + 1);
    }
  };

  const handlePrevious = (e) => {
    e.preventDefault();
    setError("");
    setFormStep(formStep - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || isSubmitting) return;

    if (!validateStep()) return;

    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        ...formData,
        created_by: currentUser.id,
        event_date: formData.event_date ? formData.event_date.split('T')[0] : formData.event_date,
        price: Number(formData.price) || 0,
        capacity: Number(formData.capacity) || 0,
        image: formData.organizer_image || null,
        venue: formData.venue || null,
        organizer_email: formData.organizer_email || null,
        parking_info: formData.parking_info || null,
        map_link: formData.map_link || null,
        tag_ids: selectedTags.join(',') || null,
        early_bird_price: formData.is_early_bird ? Number(formData.early_bird_price) : null,
        early_bird_deadline: formData.is_early_bird ? formData.early_bird_deadline : null
      };

      if (event) {
        await api.put(`/events/${event.id}`, payload, { headers: getAuthHeaders() });
      } else {
        await api.post("/events", payload, { headers: getAuthHeaders() });
      }

      await onSave();
      onClose();
    } catch (err) {
      console.error("Failed to save event:", err);
      setError(err.response?.data?.error || "Failed to save event. Please try again.");
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal large">
        <div className="modal-header">
          <h3>{event ? "Edit Event" : "Create New Event"}</h3>
          <div className="form-steps">
            <span className={formStep === 1 ? "active" : formStep > 1 ? "completed" : ""}>
              1. Basic Info
            </span>
            <span className={formStep === 2 ? "active" : formStep > 2 ? "completed" : ""}>
              2. Details
            </span>
            <span className={formStep === 3 ? "active" : ""}>
              3. Additional
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1: Basic Information */}
          {formStep === 1 && (
            <div className="form-step">
              <div className="form-group">
                <label>Event Title *</label>
                <input 
                  type="text" 
                  name="title" 
                  value={formData.title} 
                  onChange={handleChange}
                  placeholder="Enter event title"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea 
                  name="description" 
                  value={formData.description} 
                  onChange={handleChange} 
                  rows={5}
                  placeholder="Describe your event..."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select name="category_id" value={formData.category_id} onChange={handleChange}>
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {tags.length > 0 && (
                <div className="form-group">
                  <label>Tags (Optional - Select multiple)</label>
                  <div className="tags-selector">
                    {tags.map((tag) => (
                      <label key={tag.id} className="tag-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag.id)}
                          onChange={() => handleTagSelection(tag.id)}
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date, Time, Location */}
          {formStep === 2 && (
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
                  <label>End Time *</label>
                  <input 
                    type="time" 
                    name="end_time" 
                    value={formData.end_time} 
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: "1 1 100%" }}>
                  <label>
                    Location *
                    <button
                      type="button"
                      className="location-mode-toggle"
                      onClick={() =>
                        setLocationInputMode((m) =>
                          m === "search" ? "manual" : "search"
                        )
                      }
                      title={
                        locationInputMode === "search"
                          ? "Switch to manual entry"
                          : "Switch to map search"
                      }
                    >
                      {locationInputMode === "search"
                        ? "✏️ Type manually"
                        : "🔍 Use map search"}
                    </button>
                  </label>

                  {/* ── Mapbox geocoder (search mode) ── */}
                  <div
                    ref={geocoderContainer}
                    style={{
                      display: locationInputMode === "search" ? "block" : "none"
                    }}
                  />

                  {/* ── Manual text input (manual mode OR geocoder not ready) ── */}
                  {locationInputMode === "manual" && (
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="e.g., KICC, Nairobi, Kenya"
                      required
                    />
                  )}

                  {/* ── Selected location confirmation ── */}
                  {formData.location && (
                    <div className="location-confirmed">
                      <span className="location-confirmed__pin">📍</span>
                      <span className="location-confirmed__text">
                        {formData.location}
                      </span>
                      {formData.latitude && formData.longitude && (
                        <span className="location-confirmed__coords">
                          ({parseFloat(formData.latitude).toFixed(5)},{" "}
                          {parseFloat(formData.longitude).toFixed(5)})
                        </span>
                      )}
                      {/* Allow clearing the picked location */}
                      <button
                        type="button"
                        className="location-confirmed__clear"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            location: "",
                            latitude: "",
                            longitude: ""
                          }));
                          if (geocoderRef.current) {
                            try { geocoderRef.current.clear(); } catch {}
                          }
                        }}
                        title="Clear location"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Hidden lat/lng inputs so values travel with the form */}
                  <input type="hidden" name="latitude" value={formData.latitude} />
                  <input type="hidden" name="longitude" value={formData.longitude} />
                </div>

                <div className="form-group">
                  <label>Venue / Hall Name</label>
                  <input
                    type="text"
                    name="venue"
                    value={formData.venue}
                    onChange={handleChange}
                    placeholder="e.g., KICC Hall A"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Capacity</label>
                  <input 
                    type="number" 
                    name="capacity" 
                    value={formData.capacity} 
                    onChange={handleChange} 
                    min="0"
                    placeholder="Maximum attendees"
                  />
                </div>
                <div className="form-group">
                  <label>Base Price (KES)</label>
                  <input 
                    type="number" 
                    name="price" 
                    value={formData.price} 
                    onChange={handleChange} 
                    min="0" 
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  <input 
                    type="checkbox" 
                    name="is_early_bird" 
                    checked={formData.is_early_bird}
                    onChange={handleChange}
                  />
                  Enable Early Bird Pricing
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
                      min="0" 
                      step="0.01"
                      placeholder="Discounted price"
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
            </div>
          )}

          {/* Step 3: Additional Info */}
          {formStep === 3 && (
            <div className="form-step">
              <div className="form-row">
                <div className="form-group">
                  <label>Organizer Name</label>
                  <input 
                    type="text" 
                    name="organizer_name" 
                    value={formData.organizer_name} 
                    onChange={handleChange}
                    placeholder="Event organizer"
                  />
                </div>

                <div className="form-group">
                  <label>Organizer Email</label>
                  <input 
                    type="email" 
                    name="organizer_email" 
                    value={formData.organizer_email} 
                    onChange={handleChange}
                    placeholder="contact@example.com"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Event Poster/Image URL</label>
                <input 
                  type="url" 
                  name="organizer_image" 
                  value={formData.organizer_image} 
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                />
                {formData.organizer_image && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <img 
                      src={formData.organizer_image} 
                      alt="Preview" 
                      style={{ maxWidth: "200px", maxHeight: "150px", objectFit: "cover", borderRadius: "4px" }}
                      onError={(e) => e.target.style.display = "none"}
                    />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Parking Information</label>
                <input 
                  type="text" 
                  name="parking_info" 
                  value={formData.parking_info} 
                  onChange={handleChange}
                  placeholder="e.g., Free parking available"
                />
              </div>

              <div className="form-group">
                <label>Google Maps Link</label>
                <input 
                  type="url" 
                  name="map_link" 
                  value={formData.map_link} 
                  onChange={handleChange} 
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          )}

          {error && <div className="error" style={{ marginTop: "1rem" }}>{error}</div>}

          {/* Navigation Buttons */}
          <div className="modal-actions">
            {formStep > 1 && (
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={(e) => handlePrevious(e)}
                disabled={isSubmitting}
              >
                ← Previous
              </button>
            )}
            
            {formStep < 3 ? (
              <button 
                type="button" 
                className="btn-primary" 
                onClick={(e) => handleNext(e)}
                disabled={isSubmitting}
              >
                Next →
              </button>
            ) : (
              <button 
                type="submit" 
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : (event ? "Save Changes" : "Create Event")}
              </button>
            )}
            
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;