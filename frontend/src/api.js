import axios from "axios";

// Use production URL automatically
const isProduction = window.location.hostname !== "localhost";

const api = axios.create({
  baseURL: isProduction
    ? "https://event-booking-system-u1z3.onrender.com/api"
    : "http://localhost:3300/api",
  timeout: 60000, // 60 seconds for Render.com wake-up
});

// Interceptor to attach token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('🔄 API Request:', config.method.toUpperCase(), config.url);
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for response errors with auto-retry logic
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.config.url, response.status);
    return response;
  },
  async (error) => {
    const config = error.config;
    
    // Auto-retry logic for network errors (sleeping Render.com server)
    if ((error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') && !config._retry) {
      config._retry = true;
      config._retryCount = (config._retryCount || 0) + 1;
      
      // Max 3 retries with exponential backoff
      if (config._retryCount <= 3) {
        const delay = config._retryCount * 3000; // 3s, 6s, 9s
        console.log(`⚠️ Network error, retrying (${config._retryCount}/3) in ${delay/1000}s...`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return api.request(config);
      }
    }
    
    // Handle 401 unauthorized globally
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("userId");
      localStorage.removeItem("role");
      // optionally redirect to login page
      window.location.href = "/login";
    }
    
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      code: error.code
    });
    
    return Promise.reject(error);
  }
);

export default api;