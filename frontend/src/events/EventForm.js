import React, { useState, useEffect } from "react";
import api from "../api";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ======================
  // LOAD EVENT (EDIT MODE)
  // ======================
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
        event.tag_ids
          ? String(event.tag_ids).split(",").map(Number)
          : []
      );
    }
  }, [event]);

  // ======================
  // HELPERS
  // ======================
  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const toggleTag = (id) => {
    setSelectedTags((prev) =>
      prev.includes(id)
        ? prev.filter((t) => t !== id)
        : [...prev, id]
    );
  };

  // ======================
  // VALIDATION
  // ======================
  const validate = () => {
    if (!formData.title.trim()) return "Title is required";
    if (!formData.description.trim()) return "Description is required";
    if (!formData.location.trim()) return "Location is required";
    if (!formData.event_date) return "Event date is required";
    if (!formData.start_time) return "Start time is required";
    if (!formData.end_time) return "End time is required";

    return null;
  };

  // ======================
  // SUBMIT (FIXED CORE)
  // ======================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || loading) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        title: formData.title,
        description: formData.description,
        category_id: formData.category_id || null,
        location: formData.location,
        event_date: formData.event_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        capacity: Number(formData.capacity) || 0,
        price: Number(formData.price) || 0,
        status: formData.status,

        organizer_name: formData.organizer_name || null,
        organizer_image: formData.organizer_image || null,
        venue: formData.venue || null,
        organizer_email: formData.organizer_email || null,
        parking_info: formData.parking_info || null,
        map_link: formData.map_link || null,

        is_early_bird: !!formData.is_early_bird,
        early_bird_price: formData.is_early_bird
          ? Number(formData.early_bird_price) || null
          : null,
        early_bird_deadline: formData.is_early_bird
          ? formData.early_bird_deadline
          : null,

        latitude: formData.latitude || null,
        longitude: formData.longitude || null,

        tag_ids: selectedTags.length
          ? selectedTags.join(",")
          : null,

        created_by: currentUser.id
      };

      if (event?.id) {
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
      console.error("Event save error:", err.response?.data || err.message);
      setError(err.response?.data?.error || "Failed to save event");
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // UI (MINIMAL, SAFE)
  // ======================
  return (
    <div className="modal-overlay">
      <div className="modal large">
        <h3>{event ? "Edit Event" : "Create Event"}</h3>

        <form onSubmit={handleSubmit}>
          {/* STEP 1 */}
          {step === 1 && (
            <>
              <input
                name="title"
                placeholder="Title"
                value={formData.title}
                onChange={handleChange}
              />

              <textarea
                name="description"
                placeholder="Description"
                value={formData.description}
                onChange={handleChange}
              />

              <button type="button" onClick={() => setStep(2)}>
                Next
              </button>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <input
                name="location"
                placeholder="Location"
                value={formData.location}
                onChange={handleChange}
              />

              <input
                type="date"
                name="event_date"
                value={formData.event_date}
                onChange={handleChange}
              />

              <input
                name="start_time"
                placeholder="Start time"
                value={formData.start_time}
                onChange={handleChange}
              />

              <input
                name="end_time"
                placeholder="End time"
                value={formData.end_time}
                onChange={handleChange}
              />

              <button type="button" onClick={() => setStep(1)}>
                Back
              </button>

              <button type="submit">
                {loading ? "Saving..." : "Save Event"}
              </button>
            </>
          )}

          {error && <p className="error">{error}</p>}
        </form>

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default EventForm;