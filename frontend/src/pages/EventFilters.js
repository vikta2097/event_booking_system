import React, { useState, useEffect } from "react";
import api from "../api";
import "../styles/EventFilters.css";

const EventFilters = ({ onFilter }) => {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    category: "",
    tags: [],
    venue: "",
    minPrice: "",
    maxPrice: "",
    startDate: "",
    endDate: "",
    status: "",
    sortBy: "date_asc",
    search: "",
  });

  // Fetch categories and tags with proper error handling
  useEffect(() => {
    const fetchFiltersData = async () => {
      setLoading(true);
      setError("");

      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          api.get("/categories").catch((err) => {
            console.error("Categories fetch error:", err);
            return { data: [] };
          }),
          api.get("/tags").catch((err) => {
            console.error("Tags fetch error:", err);
            return { data: [] };
          }),
        ]);

        console.log("✅ API Response: /categories", categoriesRes.status || 200);
        console.log("✅ API Response: /tags", tagsRes.status || 200);
        console.log("Categories data:", categoriesRes.data);
        console.log("Tags data:", tagsRes.data);

        const categoriesData = Array.isArray(categoriesRes.data)
          ? categoriesRes.data
          : [];
        const tagsData = Array.isArray(tagsRes.data) ? tagsRes.data : [];

        console.log("Is categories array?", Array.isArray(categoriesData), "Length:", categoriesData.length);
        console.log("Is tags array?", Array.isArray(tagsData), "Length:", tagsData.length);

        setCategories(categoriesData);
        setTags(tagsData);

        if (categoriesData.length === 0) console.warn("⚠️ No categories loaded");
        if (tagsData.length === 0) console.warn("⚠️ No tags loaded");
      } catch (err) {
        console.error("❌ Error fetching filter data:", err);
        setError("Failed to load filters. Using defaults.");
        setCategories([]);
        setTags([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFiltersData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tagName) => {
    setFilters((prev) => {
      const newTags = prev.tags.includes(tagName)
        ? prev.tags.filter((t) => t !== tagName)
        : [...prev.tags, tagName];
      return { ...prev, tags: newTags };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const cleanedFilters = {
      category: filters.category || undefined,
      tags: filters.tags.length > 0 ? filters.tags.join(",") : undefined,
      venue: filters.venue || undefined,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      status: filters.status || undefined,
      sortBy: filters.sortBy || undefined,
      search: filters.search || undefined,
    };

    onFilter(cleanedFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      category: "",
      tags: [],
      venue: "",
      minPrice: "",
      maxPrice: "",
      startDate: "",
      endDate: "",
      status: "",
      sortBy: "date_asc",
      search: "",
    };
    setFilters(resetFilters);
    onFilter({});
  };

  const handleQuickFilter = (filterType) => {
    const today = new Date();
    let newFilters = { ...filters };

    switch (filterType) {
      case "today":
        newFilters.startDate = today.toISOString().split("T")[0];
        newFilters.endDate = today.toISOString().split("T")[0];
        break;
      case "this_week":
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);
        newFilters.startDate = today.toISOString().split("T")[0];
        newFilters.endDate = weekEnd.toISOString().split("T")[0];
        break;
      case "this_month":
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        newFilters.startDate = monthStart.toISOString().split("T")[0];
        newFilters.endDate = monthEnd.toISOString().split("T")[0];
        break;
      case "free":
        newFilters.minPrice = "0";
        newFilters.maxPrice = "0";
        break;
      case "paid":
        newFilters.minPrice = "1";
        newFilters.maxPrice = "";
        break;
      default:
        break;
    }

    setFilters(newFilters);
  };

  const activeFilterCount =
    Object.values(filters).filter((v) =>
      Array.isArray(v) ? v.length > 0 : v !== ""
    ).length - 1; // Subtract 1 for sortBy which is always set

  if (loading) {
    return (
      <div className="ef-container">
        <div className="ef-loading">
          <span className="ef-loading-dot" />
          <span className="ef-loading-dot" />
          <span className="ef-loading-dot" />
          <span className="ef-loading-label">Loading filters…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ef-container">
      {error && <div className="ef-error">{error}</div>}

      {/* ── Search bar + filter toggle ──────────────────────────────── */}
      <form className="ef-search-row" onSubmit={handleSubmit}>
        <div className="ef-search-box">
          <span className="ef-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="22" y2="22" />
            </svg>
          </span>
          <input
            type="text"
            name="search"
            className="ef-search-input"
            placeholder="Search events…"
            value={filters.search}
            onChange={handleChange}
            aria-label="Search events"
            autoComplete="off"
          />
          {filters.search && (
            <button
              type="button"
              className="ef-search-clear"
              onClick={() => setFilters((p) => ({ ...p, search: "" }))}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          className={`ef-filter-btn${showAdvanced ? " ef-filter-btn--active" : ""}`}
          onClick={() => setShowAdvanced((v) => !v)}
          aria-label="Toggle filters"
          aria-expanded={showAdvanced}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          {activeFilterCount > 0 && (
            <span className="ef-badge">{activeFilterCount}</span>
          )}
        </button>

        {/* Hidden submit so Enter key on the search field works */}
        <button type="submit" aria-hidden="true" style={{ display: "none" }} />
      </form>

      {/* ── Quick filter chips ──────────────────────────────────────── */}
      <div className="ef-chips-scroll" role="group" aria-label="Quick filters">
        {[
          { key: "today",      label: "Today" },
          { key: "this_week",  label: "This Week" },
          { key: "this_month", label: "This Month" },
          { key: "free",       label: "Free Events" },
          { key: "paid",       label: "Paid Events" },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className="ef-chip"
            onClick={() => handleQuickFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Active filter tags ──────────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <div className="ef-active-tags" aria-label="Active filters">
          <span className="ef-active-label">Active:</span>

          {filters.category && (
            <span className="ef-active-tag">
              {categories.find((c) => c.id === parseInt(filters.category))?.name || "Category"}
              <button
                onClick={() => setFilters({ ...filters, category: "" })}
                aria-label="Remove category filter"
              >✕</button>
            </span>
          )}
          {filters.tags.map((tag) => (
            <span key={tag} className="ef-active-tag">
              {tag}
              <button onClick={() => handleTagToggle(tag)} aria-label={`Remove ${tag} tag`}>✕</button>
            </span>
          ))}
          {filters.venue && (
            <span className="ef-active-tag">
              📍 {filters.venue}
              <button onClick={() => setFilters({ ...filters, venue: "" })} aria-label="Remove venue filter">✕</button>
            </span>
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <span className="ef-active-tag">
              KES {filters.minPrice || "0"}–{filters.maxPrice || "∞"}
              <button onClick={() => setFilters({ ...filters, minPrice: "", maxPrice: "" })} aria-label="Remove price filter">✕</button>
            </span>
          )}
          {(filters.startDate || filters.endDate) && (
            <span className="ef-active-tag">
              {filters.startDate || "Any"} → {filters.endDate || "Any"}
              <button onClick={() => setFilters({ ...filters, startDate: "", endDate: "" })} aria-label="Remove date filter">✕</button>
            </span>
          )}

          <button type="button" className="ef-reset-inline" onClick={handleReset}>
            Reset all
          </button>
        </div>
      )}

      {/* ── Expandable filter panel ─────────────────────────────────── */}
      {showAdvanced && (
        <form className="ef-panel" onSubmit={handleSubmit}>
          <div className="ef-panel-grid">

            <div className="ef-field">
              <label className="ef-field-label" htmlFor="ef-category">Category</label>
              <select
                id="ef-category"
                name="category"
                value={filters.category}
                onChange={handleChange}
                className="ef-select"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {Array.isArray(categories) &&
                  categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
              </select>
            </div>

            <div className="ef-field">
              <label className="ef-field-label" htmlFor="ef-venue">Venue</label>
              <input
                id="ef-venue"
                type="text"
                name="venue"
                placeholder="Venue or Location"
                value={filters.venue}
                onChange={handleChange}
                className="ef-input"
                aria-label="Filter by venue"
              />
            </div>

            <div className="ef-field">
              <label className="ef-field-label" htmlFor="ef-startDate">From</label>
              <input
                id="ef-startDate"
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleChange}
                className="ef-input"
                aria-label="Start date"
              />
            </div>

            <div className="ef-field">
              <label className="ef-field-label" htmlFor="ef-endDate">To</label>
              <input
                id="ef-endDate"
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleChange}
                className="ef-input"
                aria-label="End date"
              />
            </div>

            <div className="ef-field">
              <label className="ef-field-label" htmlFor="ef-sortBy">Sort by</label>
              <select
                id="ef-sortBy"
                name="sortBy"
                value={filters.sortBy}
                onChange={handleChange}
                className="ef-select"
                aria-label="Sort by"
              >
                <option value="date_asc">Date (Earliest First)</option>
                <option value="date_desc">Date (Latest First)</option>
                <option value="price_asc">Price (Low to High)</option>
                <option value="price_desc">Price (High to Low)</option>
                <option value="popular">Most Popular</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>

            <div className="ef-field">
              <label className="ef-field-label" htmlFor="ef-minPrice">Min Price (KES)</label>
              <input
                id="ef-minPrice"
                type="number"
                name="minPrice"
                placeholder="0"
                value={filters.minPrice}
                onChange={handleChange}
                className="ef-input"
                min="0"
                aria-label="Minimum price"
              />
            </div>

            <div className="ef-field">
              <label className="ef-field-label" htmlFor="ef-maxPrice">Max Price (KES)</label>
              <input
                id="ef-maxPrice"
                type="number"
                name="maxPrice"
                placeholder="Any"
                value={filters.maxPrice}
                onChange={handleChange}
                className="ef-input"
                min="0"
                aria-label="Maximum price"
              />
            </div>

            <div className="ef-field">
              <label className="ef-field-label" htmlFor="ef-status">Status</label>
              <select
                id="ef-status"
                name="status"
                value={filters.status}
                onChange={handleChange}
                className="ef-select"
                aria-label="Event status"
              >
                <option value="">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="early_bird">Early Bird Available</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          {Array.isArray(tags) && tags.length > 0 && (
            <div className="ef-tags-section">
              <span className="ef-field-label">Tags</span>
              <div className="ef-tags-row">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`ef-tag-btn${filters.tags.includes(tag.name) ? " ef-tag-btn--active" : ""}`}
                    onClick={() => handleTagToggle(tag.name)}
                  >
                    {tag.name}
                    {filters.tags.includes(tag.name) && (
                      <span className="ef-tag-close" aria-hidden="true">✕</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Panel actions */}
          <div className="ef-panel-actions">
            <button type="submit" className="ef-apply-btn">
              Apply Filters
              {activeFilterCount > 0 && (
                <span className="ef-apply-badge">{activeFilterCount}</span>
              )}
            </button>
            <button type="button" className="ef-reset-btn" onClick={handleReset}>
              Reset
            </button>
            <div className="ef-presets">
              <button
                type="button"
                className="ef-preset-btn"
                onClick={() => {
                  localStorage.setItem("savedFilters", JSON.stringify(filters));
                  alert("Filters saved!");
                }}
              >
                💾 Save
              </button>
              <button
                type="button"
                className="ef-preset-btn"
                onClick={() => {
                  const saved = localStorage.getItem("savedFilters");
                  if (saved) {
                    setFilters(JSON.parse(saved));
                    alert("Filters loaded!");
                  } else {
                    alert("No saved filters found");
                  }
                }}
              >
                📂 Load
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default EventFilters;