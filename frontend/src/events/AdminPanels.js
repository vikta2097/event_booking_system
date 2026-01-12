import React, { useState } from "react";
import api from "../api";

const AdminPanels = ({ categories, tags, onRefresh }) => {
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showCategoryCard, setShowCategoryCard] = useState(false);
  const [showTagsCard, setShowTagsCard] = useState(false);

  const [bulkFile, setBulkFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [newCategory, setNewCategory] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryError, setCategoryError] = useState("");

  const [newTag, setNewTag] = useState("");
  const [tagError, setTagError] = useState("");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  // Bulk Upload Handler
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", bulkFile);

    try {
      setUploadLoading(true);
      setUploadError("");
      
      await api.post("/events/bulk-upload", formDataUpload, {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data"
        }
      });

      alert("✅ Events uploaded successfully!");
      setShowBulkUpload(false);
      setBulkFile(null);
      await onRefresh();
    } catch (err) {
      console.error("Bulk upload error:", err);
      const errorMsg = err.response?.data?.error || err.response?.data?.message || "Bulk upload failed";
      setUploadError(errorMsg);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setBulkFile(file);
    setUploadError("");
  };

  // Category Handlers
  const handleCategoryAdd = async (e) => {
    e.preventDefault();
    if (!newCategory.trim()) {
      setCategoryError("Category name cannot be empty");
      return;
    }

    try {
      setCategoryError("");
      await api.post("/categories", { name: newCategory.trim() }, { headers: getAuthHeaders() });
      setNewCategory("");
      await onRefresh();
    } catch (err) {
      console.error("Failed to add category:", err);
      setCategoryError(err.response?.data?.error || "Failed to add category");
    }
  };

  const handleCategoryUpdate = async (id, name) => {
    if (!name.trim()) {
      setCategoryError("Category name cannot be empty");
      return;
    }
    
    try {
      setCategoryError("");
      await api.put(`/categories/${id}`, { name: name.trim() }, { headers: getAuthHeaders() });
      setEditingCategory(null);
      await onRefresh();
    } catch (err) {
      console.error("Failed to update category:", err);
      setCategoryError(err.response?.data?.error || "Failed to update category");
    }
  };

  const handleCategoryDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this category? This action cannot be undone.")) return;
    
    try {
      setCategoryError("");
      await api.delete(`/categories/${id}`, { headers: getAuthHeaders() });
      await onRefresh();
    } catch (err) {
      console.error("Failed to delete category:", err);
      setCategoryError(err.response?.data?.error || "Failed to delete category");
    }
  };

  const startEditingCategory = (category) => {
    setEditingCategory(category);
    setCategoryError("");
  };

  const cancelEditingCategory = () => {
    setEditingCategory(null);
    setCategoryError("");
  };

  // Tag Handlers
  const handleTagAdd = async (e) => {
    e.preventDefault();
    if (!newTag.trim()) {
      setTagError("Tag name cannot be empty");
      return;
    }

    try {
      setTagError("");
      await api.post("/tags", { name: newTag.trim() }, { headers: getAuthHeaders() });
      setNewTag("");
      await onRefresh();
    } catch (err) {
      console.error("Failed to add tag:", err);
      setTagError(err.response?.data?.error || "Failed to add tag");
    }
  };

  const handleTagDelete = async (id) => {
    if (!window.confirm("Delete this tag? This action cannot be undone.")) return;
    
    try {
      setTagError("");
      await api.delete(`/tags/${id}`, { headers: getAuthHeaders() });
      await onRefresh();
    } catch (err) {
      console.error("Failed to delete tag:", err);
      setTagError(err.response?.data?.error || "Failed to delete tag");
    }
  };

  return (
    <>
      {/* Admin Action Buttons */}
      <div className="header-actions" style={{ marginBottom: "1rem", gap: "0.5rem", display: "flex", flexWrap: "wrap" }}>
        <button className="add-btn secondary" onClick={() => setShowBulkUpload(true)}>
          📤 Bulk Upload
        </button>
        <button className="add-btn secondary" onClick={() => setShowCategoryCard(!showCategoryCard)}>
          🏷️ Categories
        </button>
        <button className="add-btn secondary" onClick={() => setShowTagsCard(!showTagsCard)}>
          🔖 Tags
        </button>
      </div>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="modal-overlay">
          <div className="modal small">
            <h3>📤 Bulk Upload Events</h3>
            <form onSubmit={handleBulkUpload}>
              <div className="form-group">
                <label>Upload CSV/Excel File</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  required
                  disabled={uploadLoading}
                />
                {bulkFile && (
                  <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#666" }}>
                    Selected: <strong>{bulkFile.name}</strong> ({(bulkFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
                <p className="help-text" style={{ marginTop: "0.75rem" }}>
                  <strong>Required columns:</strong> title, description, category_id, location, event_date, start_time, end_time, capacity, price
                </p>
              </div>
              
              {uploadError && (
                <div className="error" style={{ marginBottom: "1rem" }}>
                  {uploadError}
                </div>
              )}

              <div className="modal-actions">
                <button type="submit" disabled={!bulkFile || uploadLoading} className="btn-primary">
                  {uploadLoading ? "Uploading..." : "Upload"}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowBulkUpload(false);
                    setBulkFile(null);
                    setUploadError("");
                  }}
                  disabled={uploadLoading}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Card */}
      {showCategoryCard && (
        <div className="category-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h4>🏷️ Manage Categories</h4>
            <button 
              type="button" 
              onClick={() => {
                setShowCategoryCard(false);
                setCategoryError("");
                setEditingCategory(null);
              }}
              style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleCategoryAdd} className="inline-form">
            <input
              type="text"
              placeholder="New category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              required
            />
            <button type="submit">Add</button>
          </form>

          {categoryError && <p className="error" style={{ marginTop: "0.5rem" }}>{categoryError}</p>}

          {categories.length > 0 ? (
            <ul className="category-list">
              {categories.map((c) => (
                <li key={c.id}>
                  {editingCategory && editingCategory.id === c.id ? (
                    <>
                      <input
                        type="text"
                        value={editingCategory.name}
                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCategoryUpdate(c.id, editingCategory.name);
                          } else if (e.key === "Escape") {
                            cancelEditingCategory();
                          }
                        }}
                        autoFocus
                      />
                      <div>
                        <button 
                          onClick={() => handleCategoryUpdate(c.id, editingCategory.name)}
                          title="Save"
                        >
                          ✓
                        </button>
                        <button 
                          onClick={cancelEditingCategory}
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>{c.name}</span>
                      <div>
                        <button 
                          onClick={() => startEditingCategory(c)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleCategoryDelete(c.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ textAlign: "center", color: "#999", margin: "1rem 0" }}>
              No categories yet. Add one above.
            </p>
          )}
        </div>
      )}

      {/* Tags Management Card */}
      {showTagsCard && (
        <div className="category-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h4>🔖 Manage Tags</h4>
            <button 
              type="button" 
              onClick={() => {
                setShowTagsCard(false);
                setTagError("");
              }}
              style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleTagAdd} className="inline-form">
            <input
              type="text"
              placeholder="New tag name"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              required
            />
            <button type="submit">Add</button>
          </form>

          {tagError && <p className="error" style={{ marginTop: "0.5rem" }}>{tagError}</p>}

          {tags.length > 0 ? (
            <div className="tags-list">
              {tags.map((t) => (
                <span key={t.id} className="tag-item">
                  {t.name}
                  <button 
                    onClick={() => handleTagDelete(t.id)}
                    title="Delete tag"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "#999", margin: "1rem 0" }}>
              No tags yet. Add one above.
            </p>
          )}
        </div>
      )}
    </>
  );
};

export default AdminPanels;