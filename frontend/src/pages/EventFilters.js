import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import "../styles/EventFilters.css";

const SORT_OPTIONS = [
  { value: "date_asc",    label: "Date (Earliest First)" },
  { value: "date_desc",   label: "Date (Latest First)" },
  { value: "price_asc",   label: "Price (Low to High)" },
  { value: "price_desc",  label: "Price (High to Low)" },
  { value: "popular",     label: "Most Popular" },
  { value: "name_asc",    label: "Name (A–Z)" },
];

const STATUS_OPTIONS = [
  { value: "upcoming",   label: "Upcoming" },
  { value: "ongoing",    label: "Ongoing" },
  { value: "early_bird", label: "Early Bird" },
  { value: "trending",   label: "Trending" },
];

const QUICK_FILTERS = [
  { key: "today",      label: "Today" },
  { key: "this_week",  label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "free",       label: "Free" },
  { key: "paid",       label: "Paid" },
];

const DEFAULT_FILTERS = {
  search:    "",
  category:  "",
  tags:      [],
  venue:     "",
  minPrice:  "",
  maxPrice:  "",
  startDate: "",
  endDate:   "",
  status:    "",
  sortBy:    "date_asc",
};

// Derive a clean params object to send to the API — undefined values are omitted
const toApiParams = (filters) => ({
  search:    filters.search    || undefined,
  category:  filters.category  || undefined,
  tags:      filters.tags.length > 0 ? filters.tags.join(",") : undefined,
  venue:     filters.venue     || undefined,
  minPrice:  filters.minPrice  ? Number(filters.minPrice) : undefined,
  maxPrice:  filters.maxPrice  ? Number(filters.maxPrice) : undefined,
  startDate: filters.startDate || undefined,
  endDate:   filters.endDate   || undefined,
  status:    filters.status    || undefined,
  sortBy:    filters.sortBy    || undefined,
});

// Count only fields that differ from default (excludes sortBy since it always has a value)
const countActiveFilters = (filters) =>
  Object.entries(filters).filter(([key, val]) => {
    if (key === "sortBy") return false;
    return Array.isArray(val) ? val.length > 0 : val !== "";
  }).length;

const EventFilters = ({ onFilter }) => {
  const [categories, setCategories] = useState([]);
  const [tags,       setTags]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [filters,    setFilters]    = useState(DEFAULT_FILTERS);

  const searchRef  = useRef(null);
  const debounceRef = useRef(null);

  // ── Fetch categories & tags once ────────────────────────────────────────
  useEffect(() => {
    const fetchMeta = async () => {
      setLoading(true);
      setError("");
      try {
        const [catRes, tagRes] = await Promise.all([
          api.get("/categories").catch((e) => { console.error("Categories:", e); return { data: [] }; }),
          api.get("/tags").catch((e)        => { console.error("Tags:", e);       return { data: [] }; }),
        ]);

        const cats = Array.isArray(catRes.data) ? catRes.data : [];
        const tgs  = Array.isArray(tagRes.data) ? tagRes.data : [];

        console.log("✅ Categories loaded:", cats.length);
        console.log("✅ Tags loaded:", tgs.length);

        setCategories(cats);
        setTags(tgs);
      } catch (err) {
        console.error("❌ Filter meta fetch failed:", err);
        setError("Couldn't load filter options.");
      } finally {
        setLoading(false);
      }
    };
    fetchMeta();
  }, []);

  // ── Emit filter changes to parent ────────────────────────────────────────
  // Called immediately for most changes; debounced for text search
  const emit = (nextFilters) => onFilter(toApiParams(nextFilters));

  const emitDebounced = (nextFilters) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onFilter(toApiParams(nextFilters)), 400);
  };

  // ── Field helpers ────────────────────────────────────────────────────────
  const setField = (name, value, debounce = false) => {
    setFilters((prev) => {
      const next = { ...prev, [name]: value };
      debounce ? emitDebounced(next) : emit(next);
      return next;
    });
  };

  const toggleTag = (tagName) => {
    setFilters((prev) => {
      const next = {
        ...prev,
        tags: prev.tags.includes(tagName)
          ? prev.tags.filter((t) => t !== tagName)
          : [...prev.tags, tagName],
      };
      emit(next);
      return next;
    });
  };

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    onFilter({});
  };

  const removeTag = (key, value = "") => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      emit(next);
      return next;
    });
  };

  // ── Quick filter presets ─────────────────────────────────────────────────
  const applyQuick = (key) => {
    const today = new Date();
    const iso   = (d) => d.toISOString().split("T")[0];

    setFilters((prev) => {
      let next = { ...prev };
      switch (key) {
        case "today":
          next.startDate = iso(today);
          next.endDate   = iso(today);
          break;
        case "this_week": {
          const end = new Date(today);
          end.setDate(today.getDate() + 7);
          next.startDate = iso(today);
          next.endDate   = iso(end);
          break;
        }
        case "this_month": {
          next.startDate = iso(new Date(today.getFullYear(), today.getMonth(), 1));
          next.endDate   = iso(new Date(today.getFullYear(), today.getMonth() + 1, 0));
          break;
        }
        case "free":
          next.minPrice = "0";
          next.maxPrice = "0";
          break;
        case "paid":
          next.minPrice = "1";
          next.maxPrice = "";
          break;
        default:
          break;
      }
      emit(next);
      return next;
    });
  };

  // ── Save / load via localStorage ─────────────────────────────────────────
  const savePreset = () => {
    localStorage.setItem("savedFilters", JSON.stringify(filters));
    // Use a toast/snackbar in your app instead of alert
    alert("Filters saved!");
  };

  const loadPreset = () => {
    const saved = localStorage.getItem("savedFilters");
    if (saved) {
      const parsed = JSON.parse(saved);
      setFilters(parsed);
      emit(parsed);
      alert("Filters loaded!");
    } else {
      alert("No saved filters found.");
    }
  };

  const activeCount = countActiveFilters(filters);

  // ── Active filter pill labels ────────────────────────────────────────────
  const activePills = [];
  if (filters.category) {
    const cat = categories.find((c) => String(c.id) === String(filters.category));
    activePills.push({ label: cat?.name || "Category", clear: () => removeTag("category") });
  }
  if (filters.venue)
    activePills.push({ label: `📍 ${filters.venue}`, clear: () => removeTag("venue") });
  if (filters.status) {
    const s = STATUS_OPTIONS.find((o) => o.value === filters.status);
    activePills.push({ label: s?.label || filters.status, clear: () => removeTag("status") });
  }
  if (filters.minPrice || filters.maxPrice)
    activePills.push({
      label: `KES ${filters.minPrice || "0"} – ${filters.maxPrice || "∞"}`,
      clear: () => setFilters((p) => { const n = { ...p, minPrice: "", maxPrice: "" }; emit(n); return n; }),
    });
  if (filters.startDate || filters.endDate)
    activePills.push({
      label: `${filters.startDate || "Any"} → ${filters.endDate || "Any"}`,
      clear: () => setFilters((p) => { const n = { ...p, startDate: "", endDate: "" }; emit(n); return n; }),
    });
  filters.tags.forEach((t) =>
    activePills.push({ label: t, clear: () => toggleTag(t) })
  );

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="ef-wrap">
        <div className="ef-search-row">
          <div className="ef-search-box ef-skeleton" style={{ flex: 1, height: 44 }} />
          <div className="ef-skeleton" style={{ width: 44, height: 44, borderRadius: 10 }} />
        </div>
        <div className="ef-chips-row">
          {QUICK_FILTERS.map((f) => (
            <div key={f.key} className="ef-skeleton" style={{ width: 72, height: 30, borderRadius: 20 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ef-wrap">
      {error && <p className="ef-error">{error}</p>}

      {/* ── Row 1: search input + filter toggle ───────────────────────── */}
      <div className="ef-search-row">
        <div className="ef-search-box">
          <svg className="ef-search-icon" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            className="ef-search-input"
            placeholder="Search events…"
            value={filters.search}
            onChange={(e) => setField("search", e.target.value, true)}
            aria-label="Search events"
            autoComplete="off"
          />
          {filters.search && (
            <button
              type="button"
              className="ef-clear-btn"
              onClick={() => setField("search", "")}
              aria-label="Clear search"
            >✕</button>
          )}
        </div>

        <button
          type="button"
          className={`ef-toggle-btn${panelOpen ? " ef-toggle-btn--on" : ""}`}
          onClick={() => setPanelOpen((v) => !v)}
          aria-label="Toggle filters"
          aria-expanded={panelOpen}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6"  x2="20" y2="6"  />
            <line x1="8" y1="12" x2="16" y2="12" />
            <line x1="11" y1="18" x2="13" y2="18" />
          </svg>
          {activeCount > 0 && <span className="ef-badge">{activeCount}</span>}
        </button>
      </div>

      {/* ── Row 2: quick-filter chips ──────────────────────────────────── */}
      <div className="ef-chips-row" role="group" aria-label="Quick filters">
        {QUICK_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className="ef-chip"
            onClick={() => applyQuick(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Row 3: active filter pills ─────────────────────────────────── */}
      {activePills.length > 0 && (
        <div className="ef-active-row" aria-label="Active filters">
          <span className="ef-active-label">Active:</span>
          {activePills.map((pill, i) => (
            <span key={i} className="ef-pill">
              {pill.label}
              <button type="button" onClick={pill.clear} aria-label={`Remove ${pill.label}`}>✕</button>
            </span>
          ))}
          <button type="button" className="ef-reset-link" onClick={reset}>
            Clear all
          </button>
        </div>
      )}

      {/* ── Expandable panel ───────────────────────────────────────────── */}
      {panelOpen && (
        <div className="ef-panel" role="region" aria-label="Filter options">

          <div className="ef-grid">

            {/* Category */}
            <div className="ef-field">
              <label className="ef-label" htmlFor="ef-category">Category</label>
              <select
                id="ef-category"
                className="ef-select"
                value={filters.category}
                onChange={(e) => setField("category", e.target.value)}
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Venue */}
            <div className="ef-field">
              <label className="ef-label" htmlFor="ef-venue">Venue</label>
              <input
                id="ef-venue"
                type="text"
                className="ef-input"
                placeholder="Venue or location"
                value={filters.venue}
                onChange={(e) => setField("venue", e.target.value, true)}
                aria-label="Filter by venue"
              />
            </div>

            {/* From date */}
            <div className="ef-field">
              <label className="ef-label" htmlFor="ef-start">From</label>
              <input
                id="ef-start"
                type="date"
                className="ef-input"
                value={filters.startDate}
                onChange={(e) => setField("startDate", e.target.value)}
                aria-label="Start date"
              />
            </div>

            {/* To date */}
            <div className="ef-field">
              <label className="ef-label" htmlFor="ef-end">To</label>
              <input
                id="ef-end"
                type="date"
                className="ef-input"
                value={filters.endDate}
                onChange={(e) => setField("endDate", e.target.value)}
                aria-label="End date"
              />
            </div>

            {/* Min price */}
            <div className="ef-field">
              <label className="ef-label" htmlFor="ef-min">Min Price (KES)</label>
              <input
                id="ef-min"
                type="number"
                className="ef-input"
                placeholder="0"
                min="0"
                value={filters.minPrice}
                onChange={(e) => setField("minPrice", e.target.value)}
                aria-label="Minimum price"
              />
            </div>

            {/* Max price */}
            <div className="ef-field">
              <label className="ef-label" htmlFor="ef-max">Max Price (KES)</label>
              <input
                id="ef-max"
                type="number"
                className="ef-input"
                placeholder="Any"
                min="0"
                value={filters.maxPrice}
                onChange={(e) => setField("maxPrice", e.target.value)}
                aria-label="Maximum price"
              />
            </div>

            {/* Status */}
            <div className="ef-field">
              <label className="ef-label" htmlFor="ef-status">Status</label>
              <select
                id="ef-status"
                className="ef-select"
                value={filters.status}
                onChange={(e) => setField("status", e.target.value)}
                aria-label="Event status"
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="ef-field">
              <label className="ef-label" htmlFor="ef-sort">Sort by</label>
              <select
                id="ef-sort"
                className="ef-select"
                value={filters.sortBy}
                onChange={(e) => setField("sortBy", e.target.value)}
                aria-label="Sort by"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="ef-tags-section">
              <span className="ef-label">Tags</span>
              <div className="ef-tags-row">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`ef-tag${filters.tags.includes(tag.name) ? " ef-tag--on" : ""}`}
                    onClick={() => toggleTag(tag.name)}
                  >
                    {tag.name}
                    {filters.tags.includes(tag.name) && (
                      <span aria-hidden="true"> ✕</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Panel footer */}
          <div className="ef-panel-footer">
            <button type="button" className="ef-reset-btn" onClick={reset}>
              Reset
            </button>
            <div className="ef-presets">
              <button type="button" className="ef-preset-btn" onClick={savePreset}>
                💾 Save filters
              </button>
              <button type="button" className="ef-preset-btn" onClick={loadPreset}>
                📂 Load filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventFilters;