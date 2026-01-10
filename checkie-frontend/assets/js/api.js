/**
 * Checkie API Client
 * Handles all communication with the backend API
 */

const CheckieAPI = (function() {
  // Configuration
  const API_URL = window.CHECKIE_API_URL || 'https://checkie-production.up.railway.app/api';

  // Token storage keys
  const ACCESS_TOKEN_KEY = 'checkie_access_token';
  const REFRESH_TOKEN_KEY = 'checkie_refresh_token';
  const USER_KEY = 'checkie_user';

  // ============================================
  // Token Management
  // ============================================

  function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  function setTokens(accessToken, refreshToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  function clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function isAuthenticated() {
    return !!getAccessToken();
  }

  // ============================================
  // HTTP Client
  // ============================================

  async function request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth header if token exists
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 - try to refresh token
      if (response.status === 401 && getRefreshToken()) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry original request with new token
          headers['Authorization'] = `Bearer ${getAccessToken()}`;
          const retryResponse = await fetch(url, { ...options, headers });
          return handleResponse(retryResponse);
        } else {
          // Refresh failed, logout
          clearTokens();
          window.location.href = '/login';
          throw new Error('Session expired');
        }
      }

      return handleResponse(response);
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async function handleResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || 'Request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async function refreshAccessToken() {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // Auth API
  // ============================================

  async function login(email, password) {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const { accessToken, refreshToken, user } = response.data;
    setTokens(accessToken, refreshToken);
    setUser(user);

    return user;
  }

  async function register(email, password, firstName, lastName) {
    const response = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });

    const { accessToken, refreshToken, user } = response.data;
    setTokens(accessToken, refreshToken);
    setUser(user);

    return user;
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Ignore logout errors
      }
    }
    clearTokens();
    window.location.href = '/login';
  }

  // ============================================
  // User API
  // ============================================

  async function getProfile() {
    const response = await request('/users/me');
    const user = response.data;
    setUser(user);
    return user;
  }

  async function updateProfile(data) {
    const response = await request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    const user = response.data;
    setUser(user);
    return user;
  }

  async function getMyStores() {
    const response = await request('/users/me/stores');
    return response.data;
  }

  // ============================================
  // Store API
  // ============================================

  async function createStore(data) {
    const response = await request('/stores', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async function getStore(storeId) {
    const response = await request(`/stores/${storeId}`);
    return response.data;
  }

  async function updateStore(storeId, data) {
    const response = await request(`/stores/${storeId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  // ============================================
  // Public API
  // ============================================

  return {
    // Config
    API_URL,

    // Auth state
    isAuthenticated,
    getUser,
    getAccessToken,

    // Auth actions
    login,
    register,
    logout,

    // User
    getProfile,
    updateProfile,
    getMyStores,

    // Stores
    createStore,
    getStore,
    updateStore,

    // Low-level
    request,
    clearTokens,
  };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CheckieAPI;
}
