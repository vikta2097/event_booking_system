// EventFilters.jsx (WEB)

import React, { useEffect, useState } from "react";
import api from "../api";
import "./EventFilters.css";

const EventFilters = ({ onFilter }) => {
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

  return (
    <div className="filters">
      <div className="chips">
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

      <input placeholder="Venue" onChange={(e) => handleChange("venue", e.target.value)} />
      <input type="number" placeholder="Min Price" onChange={(e) => handleChange("minPrice", e.target.value)} />
      <input type="number" placeholder="Max Price" onChange={(e) => handleChange("maxPrice", e.target.value)} />
      <input type="date" onChange={(e) => handleChange("startDate", e.target.value)} />
      <input type="date" onChange={(e) => handleChange("endDate", e.target.value)} />

      <button onClick={() => handleChange("category", "")}>Clear</button>
    </div>
  );
};

export default EventFilters;