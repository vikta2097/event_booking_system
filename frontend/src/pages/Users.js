import React, { useEffect, useState, useCallback } from "react";
import api from "../api"; // Global axios instance with token
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/Users.css";

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
  { value: "organizer", label: "Organizer" }, // added
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

  // Use environment variable
  const baseUrl = `${process.env.REACT_APP_API_URL}/users`;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(baseUrl);
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to fetch users");
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

    if (!formData.email || !formData.fullname || !formData.role || (!editUserId && !formData.password)) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error("Invalid email format");
      return;
    }

    if (!editUserId && formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      if (editUserId) {
        await api.put(`${baseUrl}/${editUserId}`, formData);
        toast.success("User updated successfully");
      } else {
        await api.post(baseUrl, formData);
        toast.success("User created successfully");
      }

      setFormData({ email: "", fullname: "", role: "user", password: "" });
      setEditUserId(null);
      fetchUsers();
    } catch (err) {
      console.error("Error submitting user:", err);
      const msg = err.response?.data?.message || "Network error. Please try again.";
      toast.error(msg);
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
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await api.delete(`${baseUrl}/${id}`);
      setUsers((prev) => prev.filter((user) => user.id !== id));
      toast.success("User deleted successfully");
    } catch (err) {
      console.error("Error deleting user:", err);
      const msg = err.response?.data?.message || "Failed to delete user";
      toast.error(msg);
    }
  };

  return (
    <div className="users-management">
      <ToastContainer position="top-right" autoClose={3000} />
      <h2>User Management</h2>

      <form onSubmit={handleSubmit} className="user-form">
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
        <select name="role" value={formData.role} onChange={handleChange} required>
          {roleOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
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
        <button type="submit" disabled={loading}>
          {editUserId ? "Update User" : "Add User"}
        </button>
        {editUserId && <button type="button" onClick={cancelEdit} className="cancel-btn">Cancel Edit</button>}
      </form>

      {loading ? (
        <p>Loading users...</p>
      ) : users.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table className="users-table">
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
