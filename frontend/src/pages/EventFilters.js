import React, { useState } from "react";
import "../styles/EventFilters.css"; // ✅ Import CSS

const EventFilters = ({ onFilter }) => {
  const [category, setCategory] = useState("");
  const [venue, setVenue] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const filters = {
      category: category || undefined,
      venue: venue || undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };
    onFilter(filters);
  };

  const handleReset = () => {
    setCategory("");
    setVenue("");
    setMinPrice("");
    setMaxPrice("");
    setStartDate("");
    setEndDate("");
    onFilter({});
  };

  return (
    <form className="event-filters" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="filter-input"
      />
      <input
        type="text"
        placeholder="Venue"
        value={venue}
        onChange={(e) => setVenue(e.target.value)}
        className="filter-input"
      />
      <input
        type="number"
        placeholder="Min Price"
        value={minPrice}
        onChange={(e) => setMinPrice(e.target.value)}
        className="filter-input"
        min="0"
      />
      <input
        type="number"
        placeholder="Max Price"
        value={maxPrice}
        onChange={(e) => setMaxPrice(e.target.value)}
        className="filter-input"
        min="0"
      />
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="filter-input"
      />
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        className="filter-input"
      />
      <div className="filter-buttons">
        <button type="submit" className="apply-btn">
          Apply
        </button>
        <button type="button" className="reset-btn" onClick={handleReset}>
          Reset
        </button>
      </div>
    </form>
  );
};

export default EventFilters;
