/**
 * Routes Controller - Firebase Version
 * Handles route calculation requests
 */

// Import the Firebase-based RoadRating model
const RoadRatingModel = require('../models/RoadRating');

// Import utility functions
const { findRoute, isWithinIndia } = require('../utils/astar');
const osrmService = require('../utils/osrmService');
const graphHopperService = require('../utils/graphHopperService');
const safeRouteCalculator = require('../utils/safeRouteCalculator');

// For fallback purposes
const { mockRoadRatings } = require('./ratingsController');

// Mock road network graph for India
// In a production environment, this would be fetched from Firestore
const roadNetworkGraph = require('../utils/mockRoadNetwork');

// Calculate route using GraphHopper/OSRM for realistic road routing
exports.calculateRoute = async (req, res) => {
  try {
    console.log('Route calculation request received:', req.body);
    const { start, destination, prioritizeSafety = true } = req.body;
    
    if (!start || !destination || !start.lat || !start.lng || !destination.lat || !destination.lng) {
      console.error('Invalid route request - missing coordinates:', { start, destination });
      return res.status(400).json({ message: 'Start and destination coordinates are required' });
    }
    
    // Validate that coordinates are within India
    if (!isWithinIndia(start.lat, start.lng) || !isWithinIndia(destination.lat, destination.lng)) {
      console.error('Coordinates outside India boundaries:', { start, destination });
      return res.status(400).json({ message: 'Route must be within Indian geographical boundaries' });
    }
    
    // Get road ratings from Firebase for the area
    const bounds = getBoundingBox(start, destination);
    let roadRatings = [];
    
    try {
      // Fetch road ratings from Firebase
      roadRatings = await RoadRatingModel.findByBounds(bounds);
      console.log(`Found ${roadRatings.length} road ratings in the area from Firebase`);
    } catch (error) {
      console.error('Error fetching road ratings from Firebase:', error);
      // Continue with empty ratings if there's an error
    }
    
    console.log('Attempting to find nearest road points...');
    // First, try to find the nearest road points using GraphHopper
    let nearestStartRoad, nearestDestRoad;
    
    try {
      nearestStartRoad = await graphHopperService.getNearestRoad(start);
      nearestDestRoad = await graphHopperService.getNearestRoad(destination);
    } catch (error) {
      console.error('Error finding nearest roads with GraphHopper:', error.message);
      // Fall back to OSRM if GraphHopper fails
      nearestStartRoad = await osrmService.getNearestRoad(start);
      nearestDestRoad = await osrmService.getNearestRoad(destination);
    }
    
    // Use the nearest road points if available, otherwise use the original coordinates
    const startPoint = nearestStartRoad ? nearestStartRoad.location : start;
    const destPoint = nearestDestRoad ? nearestDestRoad.location : destination;
    
    console.log('Using points for routing:', { startPoint, destPoint });
    
    // If safety is prioritized, use the safe route calculator
    if (prioritizeSafety) {
      console.log('Calculating safe route that considers both safety and speed...');
      
      try {
        // Calculate a safe route that considers road ratings
        const safeRoute = await safeRouteCalculator.calculateSafeRoute(startPoint, destPoint);
        
        if (safeRoute && safeRoute.coordinates && safeRoute.coordinates.length > 0) {
          console.log('Safe route calculated successfully with', safeRoute.coordinates.length, 'points');
          console.log('Route safety score:', safeRoute.safetyScore);
          
          // Prepare response with safe route details
          const routeResponse = {
            route: safeRoute.coordinates,
            distance: safeRoute.distance,
            estimatedTime: safeRoute.time || safeRoute.distance / 60, // Convert to minutes if time not provided
            safetyScore: safeRoute.safetyScore,
            routeType: 'safe-route', // Indicate this is a safety-optimized route
          };
          
          return res.status(200).json(routeResponse);
        }
      } catch (error) {
        console.log('Safe route calculation failed, falling back to standard routing:', error.message);
      }
    }
    
    // If safety is not prioritized or safe route calculation fails, fall back to standard GraphHopper route
    console.log('Attempting to get route from GraphHopper...');
    
    try {
      const graphHopperRoute = await graphHopperService.getRoute(startPoint, destPoint);
      
      if (graphHopperRoute && graphHopperRoute.coordinates && graphHopperRoute.coordinates.length > 0) {
        console.log('GraphHopper route calculated successfully with', graphHopperRoute.coordinates.length, 'points');
        
        // Calculate safety score for this route
        const safetyScore = calculateSafetyScoreForRoute(graphHopperRoute.coordinates, roadRatings);
        
        // Prepare response with GraphHopper route details
        const routeResponse = {
          route: graphHopperRoute.coordinates,
          distance: graphHopperRoute.distance,
          estimatedTime: graphHopperRoute.time,
          safetyScore: safetyScore,
          routeType: 'standard', // Indicate this is a standard route
        };
        
        return res.status(200).json(routeResponse);
      }
    } catch (error) {
      console.error('GraphHopper routing failed, trying OSRM:', error.message);
    }
    
    // If GraphHopper fails, try OSRM as a last resort
    console.log('Attempting to get route from OSRM...');
    
    try {
      const osrmRoute = await osrmService.getRoute(startPoint, destPoint);
      
      if (osrmRoute && osrmRoute.coordinates && osrmRoute.coordinates.length > 0) {
        console.log('OSRM route calculated successfully with', osrmRoute.coordinates.length, 'points');
        
        // Calculate safety score for this route
        const safetyScore = calculateSafetyScoreForRoute(osrmRoute.coordinates, roadRatings);
        
        // Prepare response with OSRM route details
        const routeResponse = {
          route: osrmRoute.coordinates,
          distance: osrmRoute.distance,
          estimatedTime: osrmRoute.duration,
          safetyScore: safetyScore,
          routeType: 'standard', // Indicate this is a standard route
        };
        
        return res.status(200).json(routeResponse);
      }
    } catch (error) {
      console.error('OSRM routing failed:', error.message);
    }
    
    // If all routing services fail, create a simple straight-line route
    console.log('All routing services failed, creating simple route...');
    
    const simpleRoute = createSimpleRoute(startPoint, destPoint);
    const simpleDistance = calculateSimpleDistance(startPoint, destPoint);
    const simpleTime = calculateSimpleTime(startPoint, destPoint);
    
    // Prepare response with simple route details
    const routeResponse = {
      route: simpleRoute,
      distance: simpleDistance,
      estimatedTime: simpleTime,
      safetyScore: 75, // Default safety score for simple routes
      routeType: 'simple', // Indicate this is a simple straight-line route
    };
    
    return res.status(200).json(routeResponse);
    
  } catch (error) {
    console.error('Route calculation error:', error);
    return res.status(500).json({ message: 'Failed to calculate route', error: error.message });
  }
};

// Calculate bounding box for an area between two points
function getBoundingBox(point1, point2) {
  // Add a buffer around the points (about 5km in each direction)
  const buffer = 0.05;
  
  return {
    north: Math.max(point1.lat, point2.lat) + buffer,
    south: Math.min(point1.lat, point2.lat) - buffer,
    east: Math.max(point1.lng, point2.lng) + buffer,
    west: Math.min(point1.lng, point2.lng) - buffer
  };
}

// Create a simple route between two points
function createSimpleRoute(start, destination) {
  const numPoints = 10; // Number of intermediate points
  const route = [];
  
  route.push(start);
  
  // Create intermediate points
  for (let i = 1; i < numPoints - 1; i++) {
    const ratio = i / numPoints;
    const lat = start.lat + (destination.lat - start.lat) * ratio;
    const lng = start.lng + (destination.lng - start.lng) * ratio;
    route.push({ lat, lng });
  }
  
  route.push(destination);
  
  return route;
}

// Calculate simple distance between two points
function calculateSimpleDistance(start, destination) {
  return haversineDistance(start.lat, start.lng, destination.lat, destination.lng);
}

// Calculate simple time estimate
function calculateSimpleTime(start, destination) {
  const distance = calculateSimpleDistance(start, destination);
  // Assume average speed of 60 km/h
  return distance / 60 * 60; // Convert to minutes
}

// Haversine distance calculation function
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

// Calculate the total distance of the route in kilometers
function calculateTotalDistance(route) {
  if (!route || route.length < 2) {
    return 0;
  }
  
  let totalDistance = 0;
  
  for (let i = 0; i < route.length - 1; i++) {
    const point1 = route[i];
    const point2 = route[i + 1];
    
    totalDistance += haversineDistance(
      point1.lat, point1.lng,
      point2.lat, point2.lng
    );
  }
  
  return totalDistance;
}

// Calculate safety score for a route
function calculateSafetyScoreForRoute(routeCoordinates, roadRatings) {
  if (!routeCoordinates || routeCoordinates.length < 2) {
    return 85; // Default safety score if no valid route
  }
  
  let totalSegments = routeCoordinates.length - 1;
  let badRoadSegments = 0;
  
  // Sample the route at regular intervals to check for bad road segments
  const sampleInterval = Math.max(1, Math.floor(routeCoordinates.length / 20)); // Check up to 20 segments
  
  for (let i = 0; i < routeCoordinates.length - 1; i += sampleInterval) {
    const point1 = routeCoordinates[i];
    const point2 = routeCoordinates[Math.min(i + sampleInterval, routeCoordinates.length - 1)];
    
    // Find the closest road rating for this segment
    const closestRating = findClosestRoadRating(point1, point2, roadRatings);
    
    if (closestRating && closestRating.rating === 'Bad') {
      badRoadSegments++;
    }
  }
  
  // Adjust the total segments to match the number we actually checked
  const adjustedTotalSegments = Math.ceil(totalSegments / sampleInterval);
  
  // Calculate safety percentage (higher is better)
  const safetyPercentage = 100 - ((badRoadSegments / adjustedTotalSegments) * 100);
  
  return Math.round(safetyPercentage);
}

// Find the closest road rating to a segment
function findClosestRoadRating(point1, point2, roadRatings) {
  if (!roadRatings || roadRatings.length === 0) {
    return null;
  }
  
  // Calculate midpoint of the segment
  const midpoint = {
    lat: (point1.lat + point2.lat) / 2,
    lng: (point1.lng + point2.lng) / 2
  };
  
  let closestRating = null;
  let minDistance = Infinity;
  
  // Find the closest road rating to the midpoint
  for (const rating of roadRatings) {
    // Calculate midpoint of the rating segment
    const ratingMidpoint = {
      lat: (rating.coordinates.start.lat + rating.coordinates.end.lat) / 2,
      lng: (rating.coordinates.start.lng + rating.coordinates.end.lng) / 2
    };
    
    // Calculate distance between midpoints
    const distance = haversineDistance(
      midpoint.lat, midpoint.lng,
      ratingMidpoint.lat, ratingMidpoint.lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestRating = rating;
    }
  }
  
  // Only consider ratings within 1km of the segment
  return minDistance <= 1 ? closestRating : null;
}

// Get traffic data (simplified for Firebase version)
exports.getTrafficData = async (req, res) => {
  try {
    // In a real implementation, you would fetch traffic data from Firebase
    // For now, we return an empty array
    res.status(200).json([]);
  } catch (error) {
    console.error('Error getting traffic data:', error);
    res.status(500).json({ message: 'Failed to get traffic data' });
  }
};
