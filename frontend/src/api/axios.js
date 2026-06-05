import axios from 'axios';

// In production (Vercel), VITE_API_URL points to your Render backend
// In development, /api is proxied to localhost:5000 by vite.config.js
const BASE_URL = (import.meta.env.VITE_API_URL || '/api').trim();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthRoute = err.config?.url?.includes('/auth/login') || err.config?.url?.includes('/auth/staff-pin');
    if (err.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_restaurant');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
