import axios from 'axios';

// API base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Request interceptor: Add auth token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Only force JSON when the caller did not already choose another payload type.
    if (
      config.data &&
      !(config.data instanceof FormData) &&
      !(config.data instanceof URLSearchParams) &&
      typeof config.data === 'object' &&
      !(config.data instanceof Blob)
    ) {
      config.headers['Content-Type'] = 'application/json';
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle common errors (e.g., 401 unauthorized)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // If the error is from the login endpoint, don't reload
      // because the Login component needs to handle the error itself
      if (error.config?.url?.includes('/login')) {
        return Promise.reject(error);
      }

      // Token expired or invalid - clear session and redirect to login
      localStorage.removeItem('token');
      window.location.reload();
      return Promise.reject(error);
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      const message = error.response?.data?.detail || 'Anda tidak memiliki izin untuk melakukan tindakan ini';
      console.error('Forbidden:', message);
      return Promise.reject(new Error(message));
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      const message = error.response?.data?.detail || 'Sumber daya yang diminta tidak ditemukan';
      console.error('Not Found:', message);
      return Promise.reject(new Error(message));
    }

    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      console.error('Server Error:', error.response?.data?.detail || 'Internal server error');
      return Promise.reject(new Error('Kesalahan server. Harap coba lagi nanti.'));
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network Error:', error.message);
      return Promise.reject(new Error('Kesalahan jaringan. Harap periksa koneksi Anda.'));
    }

    return Promise.reject(error);
  }
);

// Export convenience methods
export const api = {
  // Generic methods for custom endpoints
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),

  // Auth
  login: (credentials) => {
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    return apiClient.post('/login', formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },

  // Users
  getUsers: () => apiClient.get('/users/'),
  getUser: (userId) => apiClient.get(`/users/${userId}`),
  createUser: (userData) => apiClient.post('/users/', userData),
  updateUser: (userId, userData) => apiClient.put(`/users/${userId}`, userData),
  deleteUser: (userId) => apiClient.delete(`/users/${userId}`),
  resetPassword: (userId) => apiClient.post(`/admin/reset-password/${userId}`),
  getCurrentUser: () => apiClient.get('/users/me'),
  getClasses: () => apiClient.get('/users/classes'),
  completeTutorial: (assignmentId) => apiClient.post(`/assignments/${assignmentId}/complete-tutorial`),

  // Tests
  getTests: () => apiClient.get('/tests/'),

  // Assignments
  getAssignments: (userId = null) => {
    const params = userId ? { user_id: userId } : {};
    return apiClient.get('/assignments/', { params });
  },
  getMyAssignments: () => apiClient.get('/users/me/assignments'),
  createAssignment: (userId, testId) =>
    apiClient.post('/assignments/', null, { params: { user_id: userId, test_id: testId } }),
  assignAllTests: (userId) => apiClient.post(`/assignments/assign-all/${userId}`),
  startTest: (assignmentId) => apiClient.get(`/assignments/${assignmentId}/start`),
  submitTest: (assignmentId, answers, timeTaken, deviceInfo) =>
    apiClient.post(`/assignments/${assignmentId}/submit`, {
      answers,
      time_taken: timeTaken,
      device_info: deviceInfo,
    }),
  lockAssignment: (assignmentId) =>
    apiClient.post(`/assignments/${assignmentId}/lock`),
  unlockAssignment: (assignmentId) =>
    apiClient.post(`/admin/assignments/${assignmentId}/unlock`),
  resetAssignment: (assignmentId) =>
    apiClient.post(`/admin/assignments/${assignmentId}/reset`),
  saveAnswer: (assignmentId, data) => 
    apiClient.post(`/assignments/${assignmentId}/save-answer`, null, { params: data }),
  logExit: (assignmentId) =>
    apiClient.post(`/assignments/${assignmentId}/exit-log`),
  getLockedAssignments: () => apiClient.get('/admin/locked-assignments'),
  updateAssignmentReview: (assignmentId, data) => 
    apiClient.patch(`/assignments/${assignmentId}/review`, data),

  // Results
  getResults: (params = {}) => apiClient.get('/results/', { params }),

  // Exit Logs
  getExitLogs: (params = {}) => apiClient.get('/admin/exit-logs/', { params }),

  // Stats
  getStatsSummary: () => apiClient.get('/admin/stats/summary'),
  getStatsTests: () => apiClient.get('/admin/stats/tests'),
  getStatsRecent: (limit = 10) =>
    apiClient.get(`/admin/stats/recent?limit=${limit}`),
  getCompletionStats: () => apiClient.get('/admin/stats/completion'),
  getLiveStats: () => apiClient.get('/admin/stats/live'),
  getSecurityEvents: (limit = 10) =>
    apiClient.get(`/admin/stats/security-events?limit=${limit}`),
  getParticipantSummary: (id) => apiClient.get(`/admin/participant/${id}/summary`),

  // Sessions
  getSessions: () => apiClient.get('/admin/sessions/'),
  getSession: (id) => apiClient.get(`/admin/sessions/${id}`),
  createSession: (data) => apiClient.post('/admin/sessions/', data),
  updateSession: (id, data) => apiClient.put(`/admin/sessions/${id}`, data),
  toggleSessionUnlock: (id) => apiClient.post(`/admin/sessions/${id}/unlock`),
  deleteSession: (id) => apiClient.delete(`/admin/sessions/${id}`),
  getSessionStatus: (assignmentId) => apiClient.get(`/admin/sessions/status/${assignmentId}`),

  // Export/Download methods (blob responses)
  exportResults: (params) => apiClient.get('/admin/export/results', { params, responseType: 'blob' }),
  exportParticipantDocx: (id) => apiClient.get(`/admin/export/participant/${id}/docx`, { responseType: 'blob' }),
  exportParticipant: (id) =>
    apiClient.get(`/admin/export/participant/${id}`, { responseType: 'blob' }),
};

export default apiClient;
