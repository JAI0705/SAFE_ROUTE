// const RoadRating = require('../models/RoadRating');

// Mock data for road ratings
const mockRoadRatings = [
  {
    roadId: 'road_delhi_jaipur_1',
    coordinates: {
      start: { lat: 28.7041, lng: 77.1025 },
      end: { lat: 28.2, lng: 76.8 }
    },
    rating: 'Good',
    trafficStatus: 'Smooth',
    userId: 'demo_user',
    createdAt: new Date()
  },
  {
    roadId: 'road_delhi_jaipur_2',
    coordinates: {
      start: { lat: 28.2, lng: 76.8 },
      end: { lat: 27.5, lng: 76.2 }
    },
    rating: 'Bad',
    trafficStatus: 'Congested',
    userId: 'demo_user',
    createdAt: new Date()
  },
  {
    roadId: 'road_delhi_mumbai_1',
    coordinates: {
      start: { lat: 28.7041, lng: 77.1025 },
      end: { lat: 28.0, lng: 76.5 }
    },
    rating: 'Good',
    trafficStatus: 'Moderate',
    userId: 'demo_user',
    createdAt: new Date()
  }
];

// In-memory storage for ratings added during the session
let roadRatings = [...mockRoadRatings];

// Export mock data for use in other controllers
module.exports.mockRoadRatings = mockRoadRatings;

// Get all road ratings
exports.getAllRatings = async (req, res) => {
  try {
    // Return mock data instead of querying MongoDB
    res.status(200).json(roadRatings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get ratings within a bounding box (for map view)
exports.getRatingsInBounds = async (req, res) => {
  try {
    const { north, south, east, west } = req.query;
    
    if (!north || !south || !east || !west) {
      return res.status(400).json({ message: 'Missing boundary parameters' });
    }

    // Filter mock data based on bounds
    const ratings = roadRatings.filter(rating => {
      // Check if start point is within bounds
      const startInBounds = 
        rating.coordinates.start.lat <= parseFloat(north) && 
        rating.coordinates.start.lat >= parseFloat(south) && 
        rating.coordinates.start.lng <= parseFloat(east) && 
        rating.coordinates.start.lng >= parseFloat(west);
      
      // Check if end point is within bounds
      const endInBounds = 
        rating.coordinates.end.lat <= parseFloat(north) && 
        rating.coordinates.end.lat >= parseFloat(south) && 
        rating.coordinates.end.lng <= parseFloat(east) && 
        rating.coordinates.end.lng >= parseFloat(west);
      
      return startInBounds || endInBounds;
    });

    res.status(200).json(ratings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a new road rating
exports.addRating = async (req, res) => {
  try {
    const { roadId, coordinates, rating, trafficStatus, userId } = req.body;
    
    if (!roadId || !coordinates || !rating) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if rating for this road segment already exists in our mock data
    const existingRatingIndex = roadRatings.findIndex(r => r.roadId === roadId);
    
    if (existingRatingIndex !== -1) {
      // Update existing rating
      roadRatings[existingRatingIndex].rating = rating;
      if (trafficStatus) roadRatings[existingRatingIndex].trafficStatus = trafficStatus;
      if (userId) roadRatings[existingRatingIndex].userId = userId;
      
      return res.status(200).json(roadRatings[existingRatingIndex]);
    }

    // Create new rating
    const newRating = {
      roadId,
      coordinates,
      rating,
      trafficStatus: trafficStatus || 'Moderate',
      userId: userId || 'anonymous',
      createdAt: new Date()
    };

    // Add to our in-memory array
    roadRatings.push(newRating);
    res.status(201).json(newRating);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update traffic status for a road
exports.updateTrafficStatus = async (req, res) => {
  try {
    const { roadId } = req.params;
    const { trafficStatus } = req.body;
    
    if (!trafficStatus) {
      return res.status(400).json({ message: 'Missing traffic status' });
    }

    const ratingIndex = roadRatings.findIndex(r => r.roadId === roadId);
    
    if (ratingIndex === -1) {
      return res.status(404).json({ message: 'Road rating not found' });
    }

    roadRatings[ratingIndex].trafficStatus = trafficStatus;
    
    res.status(200).json(roadRatings[ratingIndex]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
