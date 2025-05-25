/**
 * Road Ratings Controller - Firebase Version
 * Handles CRUD operations for road ratings stored in Firestore
 */

// Import the Firebase-based RoadRating model
const RoadRatingModel = require('../models/RoadRating');

// Fallback mock data for development/testing when Firebase is unavailable
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

// Export mock data for use in other controllers when Firebase is unavailable
module.exports.mockRoadRatings = mockRoadRatings;

// Get all road ratings
exports.getAllRatings = async (req, res) => {
  try {
    // Fetch all road ratings from Firebase
    const ratings = await RoadRatingModel.findAll();
    
    // If no ratings found or error, return mock data in development
    if (!ratings || ratings.length === 0) {
      console.log('No ratings found in Firebase, using mock data');
      return res.status(200).json(mockRoadRatings);
    }
    
    res.status(200).json(ratings);
  } catch (error) {
    console.error('Error fetching ratings from Firebase:', error);
    // Return mock data as fallback in case of error
    res.status(200).json(mockRoadRatings);
  }
};

// Get ratings within a bounding box (for map view)
exports.getRatingsInBounds = async (req, res) => {
  try {
    const { north, south, east, west } = req.query;
    
    if (!north || !south || !east || !west) {
      return res.status(400).json({ message: 'Missing boundary parameters' });
    }

    // Create bounds object for Firebase query
    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    // Get ratings from Firebase within bounds
    const ratings = await RoadRatingModel.findByBounds(bounds);
    
    // If no ratings found or error, filter mock data as fallback
    if (!ratings || ratings.length === 0) {
      console.log('No ratings found in Firebase for bounds, using filtered mock data');
      
      // Filter mock data based on bounds
      const mockRatingsInBounds = mockRoadRatings.filter(rating => {
        // Check if start point is within bounds
        const startInBounds = 
          rating.coordinates.start.lat <= bounds.north && 
          rating.coordinates.start.lat >= bounds.south && 
          rating.coordinates.start.lng <= bounds.east && 
          rating.coordinates.start.lng >= bounds.west;
        
        // Check if end point is within bounds
        const endInBounds = 
          rating.coordinates.end.lat <= bounds.north && 
          rating.coordinates.end.lat >= bounds.south && 
          rating.coordinates.end.lng <= bounds.east && 
          rating.coordinates.end.lng >= bounds.west;
        
        return startInBounds || endInBounds;
      });
      
      return res.status(200).json(mockRatingsInBounds);
    }

    res.status(200).json(ratings);
  } catch (error) {
    console.error('Error fetching ratings by bounds from Firebase:', error);
    res.status(500).json({ message: error.message });
  }
};

// Add a new road rating for a route segment
exports.addRating = async (req, res) => {
  try {
    const { id, coordinates, rating, distance, points, ratingCount, goodRatingCount, badRatingCount, area } = req.body;
    
    if (!id || !coordinates || !rating) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify this is a 2km segment (or close to it)
    if (distance && Math.abs(distance - 2.0) > 0.5 && !id.includes('segment-')) {
      console.warn(`Warning: Segment ${id} has distance ${distance}km, which is not close to the expected 2km`);
    }

    // Check if rating for this segment already exists
    const existingRating = await RoadRatingModel.findByRoadId(id);
    
    if (existingRating) {
      // Update existing rating with new counts
      const newRatingCount = (existingRating.ratingCount || 0) + 1;
      const newGoodRatingCount = rating === 'Good' 
        ? (existingRating.goodRatingCount || 0) + 1 
        : (existingRating.goodRatingCount || 0);
      const newBadRatingCount = rating === 'Bad' 
        ? (existingRating.badRatingCount || 0) + 1 
        : (existingRating.badRatingCount || 0);
      
      // Calculate the majority rating
      const majorityRating = newBadRatingCount > newGoodRatingCount ? 'Bad' : 'Good';
      
      const updatedRating = {
        ...existingRating,
        rating: majorityRating,
        ratingCount: newRatingCount,
        goodRatingCount: newGoodRatingCount,
        badRatingCount: newBadRatingCount,
        updatedAt: new Date()
      };
      
      // If area is provided, update it
      if (area) {
        updatedRating.area = area;
      }
      
      console.log(`Updating existing rating for 2km segment ${id}:`, updatedRating);
      
      await RoadRatingModel.update(existingRating.id, updatedRating);
      return res.status(200).json(updatedRating);
    }

    // Create new rating data
    const newRatingData = {
      id,
      coordinates,
      rating,
      distance: distance || 2.0, // Default to 2km if not specified
      points: points || [], // Store the actual points if provided
      ratingCount: ratingCount || 1,
      goodRatingCount: rating === 'Good' ? 1 : 0,
      badRatingCount: rating === 'Bad' ? 1 : 0,
      area: area || {
        // Calculate area from coordinates if not provided
        north: Math.max(coordinates.start.lat, coordinates.end.lat) + 0.01,
        south: Math.min(coordinates.start.lat, coordinates.end.lat) - 0.01,
        east: Math.max(coordinates.start.lng, coordinates.end.lng) + 0.01,
        west: Math.min(coordinates.start.lng, coordinates.end.lng) - 0.01
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`Adding new rating for 2km segment ${id}:`, newRatingData);
    
    // Add to database
    const newRating = await RoadRatingModel.create(newRatingData);
    res.status(201).json(newRating);
  } catch (error) {
    console.error('Error adding/updating 2km segment rating:', error);
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

    // Find the rating in Firebase
    const existingRating = await RoadRatingModel.findByRoadId(roadId);
    
    if (!existingRating) {
      return res.status(404).json({ message: 'Road rating not found' });
    }

    // Update the traffic status
    const updatedRating = {
      ...existingRating,
      trafficStatus: trafficStatus,
      updatedAt: new Date()
    };
    
    // Save to Firebase
    await RoadRatingModel.update(existingRating.id, updatedRating);
    
    res.status(200).json(updatedRating);
  } catch (error) {
    console.error('Error updating traffic status in Firebase:', error);
    res.status(500).json({ message: error.message });
  }
};
