import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ================= BASE URL ================= */



const BASE_URL = "https://event-booking-system-u1z3.onrender.com/api";
// const BASE_URL = "http://192.168.1.10:3300/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60 seconds (Render wake-up)
});

/* ================= REQUEST INTERCEPTOR ================= */

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      console.log("🔄 API Request:", config.method?.toUpperCase(), config.url);

      return config;
    } catch (err) {
      console.error("Token error:", err);
      return config;
    }
  },
  (error) => Promise.reject(error)
);

/* ================= RESPONSE INTERCEPTOR ================= */

api.interceptors.response.use(
  (response) => {
    console.log("✅ API Response:", response.config.url, response.status);
    return response;
  },
  async (error) => {
    const config = error.config;

    /* ===== AUTO RETRY (Render sleep fix) ===== */
    if (
      (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED") &&
      !config._retry
    ) {
      config._retry = true;
      config._retryCount = (config._retryCount || 0) + 1;

      if (config._retryCount <= 3) {
        const delay = config._retryCount * 3000;

        console.log(
          `⚠️ Network error, retrying (${config._retryCount}/3) in ${
            delay / 1000
          }s...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));

        return api.request(config);
      }
    }

    /* ===== HANDLE 401 ===== */
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("userId");
      await AsyncStorage.removeItem("role");

      console.log("🔒 Session expired - user logged out");

      // NOTE:
      // Navigation must be handled in your screens
      // (React Navigation), not here
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
//set REACT_NATIVE_PACKAGER_HOSTNAME=172.16.13.179
//npx expo start --lan

export default api;