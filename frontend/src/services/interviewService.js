import api from './authService';

let geminiTokenCache = { at: 0, data: null };

export const interviewService = {
  // Start a new interview
  startInterview: async (interviewData) => {
    try {
      const response = await api.post('/interviews/start', interviewData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get interview by ID
  getInterviewById: async (interviewId) => {
    try {
      const response = await api.get(`/interviews/${interviewId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get user interviews with pagination
  getUserInterviews: async (page = 0, size = 10) => {
    try {
      const response = await api.get('/interviews/history', {
        params: { page, size }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get active interviews
  getActiveInterviews: async () => {
    try {
      const response = await api.get('/interviews/active');
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getInterviewStats: async () => {
    const response = await api.get('/interviews/stats');
    return response.data;
  },

  // Update interview status
  updateInterviewStatus: async (interviewId, status) => {
    try {
      const response = await api.put(`/interviews/${interviewId}/status`, {}, {
        params: { status }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Delete interview
  deleteInterview: async (interviewId) => {
    try {
      const response = await api.delete(`/interviews/${interviewId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  getGeminiToken: async ({ force = false } = {}) => {
    const fresh = Date.now() - geminiTokenCache.at < 45000;
    if (!force && fresh && geminiTokenCache.data) return geminiTokenCache.data;
    const response = await api.post('/interviews/gemini-token');
    geminiTokenCache = { at: Date.now(), data: response.data };
    return response.data;
  },

  evaluateSpokenAnswer: async (interviewId, payload, config = {}) => {
    const response = await api.post(`/interviews/${interviewId}/evaluate-spoken`, payload, {
      timeout: 180000,
      ...config,
    });
    return response.data;
  },

  generateNextQuestion: async (interviewId, payload = {}) => {
    const response = await api.post(`/interviews/${interviewId}/next-question`, payload, {
      timeout: 60000,
    });
    return response.data;
  },
  getQuestions: async ({ interviewId, course, category, level, type, count = 5 }) => {
    try {
      const response = await api.get('/questions/generate', {
        params: { interviewId, course, category, level, type, count }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Submit answer
  submitAnswer: async (interviewId, answerData) => {
    try {
      const response = await api.post(`/interviews/${interviewId}/answer`, answerData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Complete interview
  completeInterview: async (interviewId, payload = {}) => {
    try {
      const response = await api.post(`/interviews/${interviewId}/complete`, payload);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  analyzeAnswerCompleteness: async (interviewId, payload) => {
    const response = await api.post(`/interviews/${interviewId}/analyze-completeness`, payload);
    return response.data;
  },

  // Get interview results
  getResults: async (interviewId) => {
    try {
      const response = await api.get(`/results/${interviewId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },

  // Get results history
  getResultsHistory: async (page = 0, size = 10) => {
    try {
      const response = await api.get('/results/history', {
        params: { page, size }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error.message;
    }
  },
};

export default interviewService;
