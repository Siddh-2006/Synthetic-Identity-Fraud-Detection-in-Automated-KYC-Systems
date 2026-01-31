import { create } from 'zustand';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api/users';

// Configure axios to send cookies
axios.defaults.withCredentials = true;

const useAuthStore = create((set) => ({
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  // Signup
  signup: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}`, userData);
      set({ user: response.data, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error.response?.data?.message || 'Signup failed' 
      });
      throw error;
    }
  },

  // Login
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL}/auth`, { email, password });
      set({ user: response.data, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error.response?.data?.message || 'Login failed' 
      });
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      await axios.post(`${API_URL}/logout`);
      set({ user: null, isAuthenticated: false });
    } catch (error) {
      console.error('Logout failed', error);
    }
  },

  // Check Auth (Get Profile)
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const response = await axios.get(`${API_URL}/profile`);
      set({ user: response.data, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  // Update Personal Info
  updatePersonalInfo: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL.replace('users', 'kyc')}/info`, data);
      set({ user: response.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error.response?.data?.message || 'Update failed' 
      });
      throw error;
    }
  },

  // Upload Documents
  uploadDocuments: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post(`${API_URL.replace('users', 'kyc')}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // We need to merge the response data carefully, as it might not be the full user object
      set((state) => ({ 
        user: { ...state.user, ...response.data }, 
        isLoading: false 
      }));
      return response.data;
    } catch (error) {
      set({ 
        isLoading: false, 
        error: error.response?.data?.message || 'Upload failed' 
      });
      throw error;
    }
  }
}));

export default useAuthStore;
