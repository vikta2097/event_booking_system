// EventFilters.js (WEB) — GPS "Near Me" chip + ef-* CSS classes

import React, { useEffect, useState } from "react";
import api from "../api";
import "../styles/EventFilters.css";

const EventFilters = ({ onFilter, nearMeActive = false, onNearMe }) => {
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState(false);
  const [filters, setFilters] = useState({
    category: "",
    venue: "",
    minPrice: "",
    maxPrice: "",
    startDate: "",
    endDate: "",
  });
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => {
        setCategories(res.data);
        setCatLoading(false);
      })
      .catch(() => {
        setCatError(true);
        setCatLoading(false);
      });
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

  // Count active filters
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="ef-wrap">
      {/* ── Row 1: chips (Near Me + categories) ── */}
      <div className="ef-chips-row">
        {/* 📍 Near Me chip — always first */}
        <button
          className={`ef-chip ef-chip--near-me${nearMeActive ? " ef-chip--on active" : ""}`}
          onClick={onNearMe}
          title="Sort events by distance from your location"
        >
          📍 Near Me
        </button>

        {catLoading && (
          <>
            <div className="ef-skeleton" style={{ width: 72, height: 32 }} />
            <div className="ef-skeleton" style={{ width: 88, height: 32 }} />
            <div className="ef-skeleton" style={{ width: 64, height: 32 }} />
          </>
        )}

        {catError && <p className="ef-error">Could not load categories.</p>}

        {!catLoading &&
          !catError &&
          categories.map((cat) => (
            <button
              key={cat.id}
              className={`ef-chip${filters.category === cat.name ? " ef-chip--on" : ""}`}
              onClick={() => toggleCategory(cat.name)}
            >
              {cat.name}
            </button>
          ))}
      </div>

      {/* ── Row 2: venue search + advanced-filter toggle ── */}
      <div className="ef-search-row">
        <div className="ef-search-box">
          <span className="ef-search-icon">📍</span>
          <input
            className="ef-search-input"
            placeholder="Filter by venue…"
            value={filters.venue}
            onChange={(e) => handleChange("venue", e.target.value)}
          />
          {filters.venue && (
            <button
              className="ef-clear-btn"
              onClick={() => handleChange("venue", "")}
            >
              ✕
            </button>
          )}
        </div>

        {/* Toggle advanced panel */}
        <button
          className={`ef-toggle-btn${panelOpen ? " ef-toggle-btn--on" : ""}`}
          onClick={() => setPanelOpen((p) => !p)}
          title="Advanced filters"
          aria-label="Toggle advanced filters"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 4a1 1 0 000 2h10a1 1 0 100-2H5zM3 9a1 1 0 011-1h2V7a1 1 0 112 0v1h7a1 1 0 110 2H8v1a1 1 0 11-2 0v-1H4a1 1 0 01-1-1zm2 5a1 1 0 000 2h10a1 1 0 100-2H5z" />
          </svg>
          {activeCount > 0 && <span className="ef-badge">{activeCount}</span>}
        </button>
      </div>

      {/* ── Active filter pills ── */}
      {activeCount > 0 && (
        <div className="ef-active-row">
          <span className="ef-active-label">Active:</span>
          {filters.category && (
            <span className="ef-pill">
              {filters.category}
              <button onClick={() => handleChange("category", "")}>✕</button>
            </span>
          )}
          {filters.venue && (
            <span className="ef-pill">
              📍 {filters.venue}
              <button onClick={() => handleChange("venue", "")}>✕</button>
            </span>
          )}
          {filters.minPrice && (
            <span className="ef-pill">
              Min KES {filters.minPrice}
              <button onClick={() => handleChange("minPrice", "")}>✕</button>
            </span>
          )}
          {filters.maxPrice && (
            <span className="ef-pill">
              Max KES {filters.maxPrice}
              <button onClick={() => handleChange("maxPrice", "")}>✕</button>
            </span>
          )}
          {filters.startDate && (
            <span className="ef-pill">
              From {filters.startDate}
              <button onClick={() => handleChange("startDate", "")}>✕</button>
            </span>
          )}
          {filters.endDate && (
            <span className="ef-pill">
              To {filters.endDate}
              <button onClick={() => handleChange("endDate", "")}>✕</button>
            </span>
          )}
          <button className="ef-reset-link" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      {/* ── Advanced panel ── */}
      {panelOpen && (
        <div className="ef-panel">
          <div className="ef-grid">
            <div className="ef-field">
              <label className="ef-label">Min Price (KES)</label>
              <input
                type="number"
                className="ef-input"
                placeholder="0"
                value={filters.minPrice}
                onChange={(e) => handleChange("minPrice", e.target.value)}
              />
            </div>
            <div className="ef-field">
              <label className="ef-label">Max Price (KES)</label>
              <input
                type="number"
                className="ef-input"
                placeholder="Any"
                value={filters.maxPrice}
                onChange={(e) => handleChange("maxPrice", e.target.value)}
              />
            </div>
            <div className="ef-field">
              <label className="ef-label">From Date</label>
              <input
                type="date"
                className="ef-input"
                value={filters.startDate}
                onChange={(e) => handleChange("startDate", e.target.value)}
              />
            </div>
            <div className="ef-field">
              <label className="ef-label">To Date</label>
              <input
                type="date"
                className="ef-input"
                value={filters.endDate}
                onChange={(e) => handleChange("endDate", e.target.value)}
              />
            </div>
          </div>

          <div className="ef-panel-footer">
            <button className="ef-reset-btn" onClick={clearFilters}>
              Reset All
            </button>
            <div className="ef-presets">
              <button
                className="ef-preset-btn"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  handleChange("startDate", today);
                  handleChange("endDate", today);
                }}
              >
                Today
              </button>
              <button
                className="ef-preset-btn"
                onClick={() => {
                  const today = new Date();
                  const end = new Date(today);
                  end.setDate(today.getDate() + 7);
                  handleChange("startDate", today.toISOString().split("T")[0]);
                  handleChange("endDate", end.toISOString().split("T")[0]);
                }}
              >
                This Week
              </button>
              <button
                className="ef-preset-btn"
                onClick={() => {
                  handleChange("minPrice", "0");
                  handleChange("maxPrice", "0");
                }}
              >
                Free Only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventFilters;