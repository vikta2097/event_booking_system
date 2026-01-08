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
    search: ""
  });

  // Fetch categories and tags with proper error handling
  useEffect(() => {
    const fetchFiltersData = async () => {
      setLoading(true);
      setError("");
      
      try {
        const [categoriesRes, tagsRes] = await Promise.all([
          api.get("/categories").catch(err => {
            console.error("Categories fetch error:", err);
            return { data: [] };
          }),
          api.get("/tags").catch(err => {
            console.error("Tags fetch error:", err);
            return { data: [] };
          })
        ]);
        
        // Debug logging
        console.log("✅ API Response: /categories", categoriesRes.status || 200);
        console.log("✅ API Response: /tags", tagsRes.status || 200);
        console.log("Categories data:", categoriesRes.data);
        console.log("Tags data:", tagsRes.data);
        
        // Ensure we have arrays
        const categoriesData = Array.isArray(categoriesRes.data) 
          ? categoriesRes.data 
          : [];
        const tagsData = Array.isArray(tagsRes.data) 
          ? tagsRes.data 
          : [];
        
        console.log("Is categories array?", Array.isArray(categoriesData), "Length:", categoriesData.length);
        console.log("Is tags array?", Array.isArray(tagsData), "Length:", tagsData.length);
        
        setCategories(categoriesData);
        setTags(tagsData);
        
        if (categoriesData.length === 0) {
          console.warn("⚠️ No categories loaded");
        }
        if (tagsData.length === 0) {
          console.warn("⚠️ No tags loaded");
        }
        
      } catch (err) {
        console.error("❌ Error fetching filter data:", err);
        setError("Failed to load filters. Using defaults.");
        // Ensure arrays even on error
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
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tagName) => {
    setFilters(prev => {
      const newTags = prev.tags.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
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
      search: filters.search || undefined
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
      search: ""
    };
    
    setFilters(resetFilters);
    onFilter({});
  };

  const handleQuickFilter = (filterType) => {
    const today = new Date();
    let newFilters = { ...filters };

    switch (filterType) {
      case "today":
        newFilters.startDate = today.toISOString().split('T')[0];
        newFilters.endDate = today.toISOString().split('T')[0];
        break;
      case "this_week":
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);
        newFilters.startDate = today.toISOString().split('T')[0];
        newFilters.endDate = weekEnd.toISOString().split('T')[0];
        break;
      case "this_month":
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        newFilters.startDate = monthStart.toISOString().split('T')[0];
        newFilters.endDate = monthEnd.toISOString().split('T')[0];
        break;
      case "free":
        newFilters.minPrice = "0";
        newFilters.maxPrice = "0";
        break;
      case "paid":
        newFilters.minPrice = "1";
        break;
      default:
        break;
    }

    setFilters(newFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => 
    Array.isArray(v) ? v.length > 0 : v !== ""
  ).length - 1; // Subtract 1 for sortBy which is always set

  if (loading) {
    return (
      <div className="event-filters-container">
        <div className="filters-loading">
          <p>Loading filters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="event-filters-container">
      {error && <div className="filters-error">{error}</div>}
      
      {/* Quick Filters */}
      <div className="quick-filters">
        <button 
          type="button"
          className="quick-filter-btn"
          onClick={() => handleQuickFilter("today")}
        >
          Today
        </button>
        <button 
          type="button"
          className="quick-filter-btn"
          onClick={() => handleQuickFilter("this_week")}
        >
          This Week
        </button>
        <button 
          type="button"
          className="quick-filter-btn"
          onClick={() => handleQuickFilter("this_month")}
        >
          This Month
        </button>
        <button 
          type="button"
          className="quick-filter-btn"
          onClick={() => handleQuickFilter("free")}
        >
          Free Events
        </button>
        <button 
          type="button"
          className="quick-filter-btn"
          onClick={() => handleQuickFilter("paid")}
        >
          Paid Events
        </button>
      </div>

      {/* Main Filter Form */}
      <form className="event-filters" onSubmit={handleSubmit}>
        <div className="filters-row">
          {/* Category Filter */}
          <select
            name="category"
            value={filters.category}
            onChange={handleChange}
            className="filter-input"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {Array.isArray(categories) && categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Venue Filter */}
          <input
            type="text"
            name="venue"
            placeholder="Venue or Location"
            value={filters.venue}
            onChange={handleChange}
            className="filter-input"
            aria-label="Filter by venue"
          />

          {/* Date Range */}
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleChange}
            className="filter-input"
            aria-label="Start date"
          />
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleChange}
            className="filter-input"
            aria-label="End date"
          />

          {/* Sort By */}
          <select
            name="sortBy"
            value={filters.sortBy}
            onChange={handleChange}
            className="filter-input"
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

        {/* Tags Filter (Visible when tags exist) */}
        {Array.isArray(tags) && tags.length > 0 && (
          <div className="tags-filter">
            <label className="tags-label">Tags:</label>
            <div className="tags-container">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-btn ${filters.tags.includes(tag.name) ? 'active' : ''}`}
                  onClick={() => handleTagToggle(tag.name)}
                >
                  {tag.name}
                  {filters.tags.includes(tag.name) && <span className="tag-close">✕</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Filters Toggle */}
        <div className="advanced-toggle">
          <button
            type="button"
            className="toggle-advanced-btn"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "∧ Hide" : "+ Show"} Advanced Filters
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="advanced-filters">
            <div className="filters-row">
              {/* Price Range */}
              <input
                type="number"
                name="minPrice"
                placeholder="Min Price (KES)"
                value={filters.minPrice}
                onChange={handleChange}
                className="filter-input"
                min="0"
                aria-label="Minimum price"
              />
              <input
                type="number"
                name="maxPrice"
                placeholder="Max Price (KES)"
                value={filters.maxPrice}
                onChange={handleChange}
                className="filter-input"
                min="0"
                aria-label="Maximum price"
              />

              {/* Event Status */}
              <select
                name="status"
                value={filters.status}
                onChange={handleChange}
                className="filter-input"
                aria-label="Event status"
              >
                <option value="">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="early_bird">Early Bird Available</option>
              </select>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="filter-buttons">
          <button type="submit" className="apply-btn">
            Apply Filters
            {activeFilterCount > 0 && (
              <span className="filter-count">{activeFilterCount}</span>
            )}
          </button>
          <button type="button" className="reset-btn" onClick={handleReset}>
            Reset All
          </button>
        </div>

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="active-filters">
            <span className="active-filters-label">Active filters:</span>
            {filters.category && (
              <span className="active-filter-tag">
                Category: {categories.find(c => c.id === parseInt(filters.category))?.name}
                <button onClick={() => setFilters({...filters, category: ""})} aria-label="Remove category filter">✕</button>
              </span>
            )}
            {filters.tags.map(tag => (
              <span key={tag} className="active-filter-tag">
                Tag: {tag}
                <button onClick={() => handleTagToggle(tag)} aria-label={`Remove ${tag} tag`}>✕</button>
              </span>
            ))}
            {filters.venue && (
              <span className="active-filter-tag">
                Venue: {filters.venue}
                <button onClick={() => setFilters({...filters, venue: ""})} aria-label="Remove venue filter">✕</button>
              </span>
            )}
            {(filters.minPrice || filters.maxPrice) && (
              <span className="active-filter-tag">
                Price: {filters.minPrice || "0"} - {filters.maxPrice || "∞"}
                <button onClick={() => setFilters({...filters, minPrice: "", maxPrice: ""})} aria-label="Remove price filter">✕</button>
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="active-filter-tag">
                Date: {filters.startDate || "Any"} to {filters.endDate || "Any"}
                <button onClick={() => setFilters({...filters, startDate: "", endDate: ""})} aria-label="Remove date filter">✕</button>
              </span>
            )}
          </div>
        )}
      </form>

      {/* Filter Presets (Save/Load) */}
      <div className="filter-presets">
        <button 
          type="button"
          className="preset-btn"
          onClick={() => {
            localStorage.setItem("savedFilters", JSON.stringify(filters));
            alert("Filters saved!");
          }}
        >
          💾 Save Current Filters
        </button>
        <button 
          type="button"
          className="preset-btn"
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
          📂 Load Saved Filters
        </button>
      </div>
    </div>
  );
};

export default EventFilters;