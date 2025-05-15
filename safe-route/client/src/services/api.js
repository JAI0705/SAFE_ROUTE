import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// API services for routes
export const routesService = {
  // Calculate route
  calculateRoute: async (start, destination) => {
    try {
      const response = await api.post('/routes/calculate', { start, destination });
      return response.data;
    } catch (error) {
      console.error('Error calculating route:', error);
      throw error;
    }
  },
  
  // Get traffic data
  getTrafficData: async (bounds) => {
    try {
      const { north, south, east, west } = bounds;
      const response = await api.get(`/routes/traffic?north=${north}&south=${south}&east=${east}&west=${west}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching traffic data:', error);
      throw error;
    }
  }
};

// API services for road ratings
export const ratingsService = {
  // Get all ratings
  getAllRatings: async () => {
    try {
      const response = await api.get('/ratings');
      return response.data;
    } catch (error) {
      console.error('Error fetching ratings:', error);
      throw error;
    }
  },
  
  // Get ratings within bounds
  getRatingsInBounds: async (bounds) => {
    try {
      const { north, south, east, west } = bounds;
      const response = await api.get(`/ratings/bounds?north=${north}&south=${south}&east=${east}&west=${west}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching ratings in bounds:', error);
      throw error;
    }
  },
  
  // Add a new rating
  addRating: async (roadId, coordinates, rating, trafficStatus = 'Moderate') => {
    try {
      const response = await api.post('/ratings', {
        roadId,
        coordinates,
        rating,
        trafficStatus
      });
      return response.data;
    } catch (error) {
      console.error('Error adding rating:', error);
      throw error;
    }
  },
  
  // Update traffic status
  updateTrafficStatus: async (roadId, trafficStatus) => {
    try {
      const response = await api.patch(`/ratings/${roadId}/traffic`, { trafficStatus });
      return response.data;
    } catch (error) {
      console.error('Error updating traffic status:', error);
      throw error;
    }
  }
};

export default {
  routesService,
  ratingsService
};
