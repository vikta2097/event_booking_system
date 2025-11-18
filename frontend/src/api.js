import axios from "axios";

// Use production URL automatically
const isProduction = window.location.hostname !== "localhost";

const api = axios.create({
  baseURL: isProduction
    ? "https://event-booking-system-u1z3.onrender.com/api"
    : "http://localhost:3300/api",
});

// Interceptor to attach token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for response errors (optional)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 unauthorized globally
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("role");
      // optionally redirect to login page
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
