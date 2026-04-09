// EventFilters.jsx (WEB) — with GPS "Near Me" chip

import React, { useEffect, useState } from "react";
import api from "../api";
import "./EventFilters.css";

const EventFilters = ({ onFilter, nearMeActive = false, onNearMe }) => {
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    category: "",
    venue: "",
    minPrice: "",
    maxPrice: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.data));
  }, []);

  const handleChange = (name, value) => {
    const updated = { ...filters, [name]: value };
    setFilters(updated);
    onFilter(updated);
  };

  const toggleCategory = (cat) => {
    handleChange("category", filters.category === cat ? "" : cat);
  };

  const clearFilters = () => {
    const reset = {
      category: "",
      venue: "",
      minPrice: "",
      maxPrice: "",
      startDate: "",
      endDate: "",
    };
    setFilters(reset);
    onFilter(reset);
  };

  return (
    <div className="filters">
      {/* Category chips + Near Me chip */}
      <div className="chips">
        {/* 📍 Near Me chip — always first */}
        <button
          className={`chip chip--near-me ${nearMeActive ? "active" : ""}`}
          onClick={onNearMe}
          title="Sort events by distance from your location"
        >
          📍 Near Me
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            className={filters.category === cat.name ? "chip active" : "chip"}
            onClick={() => toggleCategory(cat.name)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <input
        placeholder="Venue"
        value={filters.venue}
        onChange={(e) => handleChange("venue", e.target.value)}
      />
      <input
        type="number"
        placeholder="Min Price"
        value={filters.minPrice}
        onChange={(e) => handleChange("minPrice", e.target.value)}
      />
      <input
        type="number"
        placeholder="Max Price"
        value={filters.maxPrice}
        onChange={(e) => handleChange("maxPrice", e.target.value)}
      />
      <input
        type="date"
        value={filters.startDate}
        onChange={(e) => handleChange("startDate", e.target.value)}
      />
      <input
        type="date"
        value={filters.endDate}
        onChange={(e) => handleChange("endDate", e.target.value)}
      />

      <button onClick={clearFilters}>Clear</button>
    </div>
  );
};

export default EventFilters;