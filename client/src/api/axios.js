import axios from 'axios';

/**
 * Axios instance pre-configured for the Food Waste AI backend.
 * The Vite proxy forwards /api/* → http://localhost:5000/api/*,
 * so we use a relative baseURL for seamless development.
 */
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach JWT token automatically
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------------------------------------------------------------------
// Response interceptor — normalise error shape
// ---------------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server returned an error status
      const { status, data } = error.response;

      // Token expired or invalid — force logout
      if (status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        // Only redirect if not already on an auth page
        if (!window.location.pathname.startsWith('/login') &&
            !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
        }
      }

      return Promise.reject({
        status,
        message: data?.message || 'An error occurred.',
        errors:  data?.errors  || [],
      });
    }

    if (error.request) {
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
        errors: [],
      });
    }

    return Promise.reject({ status: 0, message: error.message, errors: [] });
  }
);

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),
};

export const organizationApi = {
  getCurrent: ()     => api.get('/organizations/current'),
  create:     (data) => api.post('/organizations', data),
  update:     (data) => api.put('/organizations/current', data),
};

export const foodItemsApi = {
  list:   ()         => api.get('/food-items'),
  get:    (id)       => api.get(`/food-items/${id}`),
  create: (data)     => api.post('/food-items', data),
  update: (id, data) => api.put(`/food-items/${id}`, data),
  delete: (id)       => api.delete(`/food-items/${id}`),
};

export const demandApi = {
  list:   (params)   => api.get('/demand', { params }),
  get:    (id)       => api.get(`/demand/${id}`),
  create: (data)     => api.post('/demand', data),
  update: (id, data) => api.put(`/demand/${id}`, data),
  delete: (id)       => api.delete(`/demand/${id}`),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

export const mlApi = {
  checkHealth:      ()     => api.get('/ml/health'),
  predictDemand:    (data) => api.post('/ml/predict/demand', data),
  predictWasteRisk: (data) => api.post('/ml/predict/waste-risk', data),
};

export const analyticsApi = {
  getSummary:         () => api.get('/analytics/summary'),
  getRecommendations: () => api.get('/analytics/recommendations'),
};

export default api;

