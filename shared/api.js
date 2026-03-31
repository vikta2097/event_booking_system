// shared/api.js
import axios from "axios";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Check environment
const isWeb = typeof window !== "undefined" && typeof window.document !== "undefined";
const isProduction = isWeb
  ? window.location.hostname !== "localhost"
  : false;

// Storage helper
const storageGet = (key) =>
  isWeb ? Promise.resolve(localStorage.getItem(key)) : AsyncStorage.getItem(key);

const storageSet = (key, value) =>
  isWeb ? Promise.resolve(localStorage.setItem(key, value)) : AsyncStorage.setItem(key, value);

const storageRemove = (key) =>
  isWeb ? Promise.resolve(localStorage.removeItem(key)) : AsyncStorage.removeItem(key);

// Axios instance
const api = axios.create({
  baseURL: isProduction
    ? "https://event-booking-system-u1z3.onrender.com/api"
    : isWeb
    ? "http://localhost:3300/api"
    : "http://192.168.X.X:3300/api", // replace with your PC IP for mobile dev
  timeout: 60000,
});

// Attach token automatically
api.interceptors.request.use(
  async (config) => {
    const token = await storageGet("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log("🔄 API Request:", config.method.toUpperCase(), config.url);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with retry
api.interceptors.response.use(
  (response) => {
    console.log("✅ API Response:", response.config.url, response.status);
    return response;
  },
  async (error) => {
    const config = error.config;

    // Auto-retry network errors (sleeping Render server)
    if ((error.code === "ERR_NETWORK" || error.code === "ECONNABORTED") && !config._retry) {
      config._retry = true;
      config._retryCount = (config._retryCount || 0) + 1;

      if (config._retryCount <= 3) {
        const delay = config._retryCount * 3000;
        console.log(`⚠️ Network error, retrying (${config._retryCount}/3) in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api.request(config);
      }
    }

    // Handle 401 globally
    if (error.response?.status === 401) {
      await storageRemove("token");
      await storageRemove("userId");
      await storageRemove("role");

      if (isWeb) {
        window.location.href = "/login";
      } else {
        console.log("🔒 Unauthorized - handle navigation to login screen in mobile app manually");
      }
    }

    console.error("❌ API Error:", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      code: error.code,
    });

    return Promise.reject(error);
  }
);

export default api;