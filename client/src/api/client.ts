// Axios API client with JWT refresh interceptor
// Does NOT auto-redirect on 401 — lets components handle auth failure gracefully
// This prevents the display page from being redirected away while the socket is connected

import axios from 'axios';
import { useAuthStore } from '../store/auth-store';

const API_BASE = '/api'; // Uses Vite proxy in dev

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh on 401
// On refresh failure: clear tokens but do NOT redirect — just reject the promise.
// The calling component (e.g. useSocket, login page) decides what to do.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        // No refresh token available — clear auth state
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        // Signal auth failure via a custom event — components listen and decide
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return Promise.reject(error);
      }

      try {
        const { data } = await apiClient.post('/auth/refresh', {
          refreshToken,
        });

        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Update auth store so subsequent requests use the new token
        useAuthStore.getState().updateToken(data.token, data.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear auth state
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('auth:expired'));
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;