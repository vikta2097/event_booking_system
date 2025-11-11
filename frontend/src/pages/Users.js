import React, { useState, useEffect, useCallback } from "react";
import '../styles/Users.css';

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    email: "",
    fullname: "",
    role: "user",
    password: "",
  });
  const [editUserId, setEditUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  const baseUrl = "http://localhost:3300/api/users";

  const fetchUsers = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("No token found. Skipping user fetch.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(baseUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType?.includes("application/json")) {
        const errorText = await res.text();
        throw new Error(`Unexpected response: ${errorText}`);
      }

      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    if (!formData.email || !formData.fullname || !formData.role || (!editUserId && !formData.password)) {
      alert("Please fill all required fields");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      alert("Invalid email format");
      return;
    }

    if (!editUserId && formData.password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    const url = editUserId ? `${baseUrl}/${editUserId}` : baseUrl;
    const method = editUserId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const contentType = res.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");
      const result = isJson ? await res.json() : { message: "Unexpected response" };

      if (!res.ok) {
        alert("Error: " + (result.message || "Unknown"));
        return;
      }

      setFormData({ email: "", fullname: "", role: "user", password: "" });
      setEditUserId(null);
      fetchUsers();
    } catch (err) {
      console.error("Error submitting user:", err);
      alert("Network error. Please try again.");
    }
  };

  const handleEdit = (user) => {
    setFormData({
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      password: "",
    });
    setEditUserId(user.id);
  };

  const cancelEdit = () => {
    setFormData({ email: "", fullname: "", role: "user", password: "" });
    setEditUserId(null);
  };

  const deleteUser = async (id) => {
    const token = localStorage.getItem("token");
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`${baseUrl}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setUsers((prev) => prev.filter((user) => user.id !== id));
      } else {
        alert("Failed to delete user");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Network error. Please try again.");
    }
  };

  return (
    <div className="users-management">
      <h2>User Management</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <input
          type="text"
          name="fullname"
          placeholder="Full Name"
          value={formData.fullname}
          onChange={handleChange}
          required
        />
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          required
        >
          {roleOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="password"
          name="password"
          placeholder={editUserId ? "New Password (optional)" : "Password"}
          value={formData.password}
          onChange={handleChange}
          required={!editUserId}
        />
        <button type="submit">{editUserId ? "Update User" : "Add User"}</button>
        {editUserId && (
          <button type="button" onClick={cancelEdit} style={{ marginLeft: "10px" }}>
            Cancel Edit
          </button>
        )}
      </form>

      {loading ? (
        <p>Loading users...</p>
      ) : users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table border="1" cellPadding="8" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.email}</td>
                <td>{user.fullname}</td>
                <td>{user.role}</td>
                <td>
                  <button onClick={() => handleEdit(user)}>Edit</button>{" "}
                  <button onClick={() => deleteUser(user.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Users;
