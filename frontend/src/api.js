import axios from "axios";

const isProduction = window.location.hostname !== "localhost";

const api = axios.create({
  baseURL: isProduction
    ? "https://event-booking-system-u1z3.onrender.com/api"
    : "http://localhost:3300/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
