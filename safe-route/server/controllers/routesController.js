// const RoadRating = require('../models/RoadRating');

// Traffic data removed

// Get mock road ratings from the ratings controller
const { mockRoadRatings } = require('./ratingsController');
const { findRoute, isWithinIndia } = require('../utils/astar');
const osrmService = require('../utils/osrmService');
const graphHopperService = require('../utils/graphHopperService');

// Mock road network graph for India
// In a production environment, this would be fetched from a database or external API
const roadNetworkGraph = require('../utils/mockRoadNetwork');

// Calculate route using OpenRouteService for realistic road routing
exports.calculateRoute = async (req, res) => {
  try {
    console.log('Route calculation request received:', req.body);
    const { start, destination } = req.body;
    
    if (!start || !destination || !start.lat || !start.lng || !destination.lat || !destination.lng) {
      console.error('Invalid route request - missing coordinates:', { start, destination });
      return res.status(400).json({ message: 'Start and destination coordinates are required' });
    }
    
    // Validate that coordinates are within India
    if (!isWithinIndia(start.lat, start.lng) || !isWithinIndia(destination.lat, destination.lng)) {
      console.error('Coordinates outside India boundaries:', { start, destination });
      return res.status(400).json({ message: 'Route must be within Indian geographical boundaries' });
    }
    
    // Use mock road ratings for demo
    const roadRatings = mockRoadRatings || [];
    
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
    console.log('Attempting to get route from GraphHopper...');
    
    // Try to get route from GraphHopper first
    const ghRoute = await graphHopperService.getRoute(startPoint, destPoint);
    
    if (ghRoute && ghRoute.coordinates && ghRoute.coordinates.length > 0) {
      console.log('GraphHopper route found successfully with', ghRoute.coordinates.length, 'points');
      // Calculate safety score for the route
      const safetyScore = calculateSafetyScoreForOSRMRoute(ghRoute.coordinates, roadRatings);
      
      // Prepare response with GraphHopper route details
      const routeResponse = {
        route: ghRoute.coordinates,
        distance: ghRoute.distance,
        estimatedTime: ghRoute.duration,
        safetyScore: safetyScore,
        routeType: 'graphhopper', // Indicate this is a GraphHopper calculated route
        // Include detailed steps if available
        steps: ghRoute.legs && ghRoute.legs.length > 0 ? 
          ghRoute.legs.flatMap(leg => leg.steps) : []
      };
      
      return res.status(200).json(routeResponse);
    }
    
    console.log('GraphHopper route calculation failed, trying OSRM service...');
    
    // Fall back to OSRM if OpenRouteService fails
    const osrmRoute = await osrmService.getRoute(startPoint, destPoint);
    
    if (osrmRoute && osrmRoute.coordinates && osrmRoute.coordinates.length > 0) {
      console.log('OSRM route found successfully with', osrmRoute.coordinates.length, 'points');
      // Calculate safety score for the OSRM route
      const safetyScore = calculateSafetyScoreForOSRMRoute(osrmRoute.coordinates, roadRatings);
      
      // Prepare response with OSRM route details
      const routeResponse = {
        route: osrmRoute.coordinates,
        distance: osrmRoute.distance,
        estimatedTime: osrmRoute.duration,
        safetyScore: safetyScore,
        routeType: 'osrm', // Indicate this is an OSRM calculated route
        // Include detailed steps if available
        steps: osrmRoute.legs && osrmRoute.legs.length > 0 ? 
          osrmRoute.legs.flatMap(leg => leg.steps) : []
      };
      
      return res.status(200).json(routeResponse);
    }
    
    console.log('Both routing services failed, falling back to A* algorithm');
    
    // Fall back to A* algorithm if both services fail
    const startNode = {
      id: `node_${start.lat}_${start.lng}`,
      lat: start.lat,
      lng: start.lng
    };
    
    const destinationNode = {
      id: `node_${destination.lat}_${destination.lng}`,
      lat: destination.lat,
      lng: destination.lng
    };
    
    // Find the route using A* algorithm
    console.log('Attempting A* route finding...');
    const route = findRoute(startNode, destinationNode, roadNetworkGraph, roadRatings);
    
    if (route) {
      console.log('A* algorithm found a route with', route.length, 'points');
      // Prepare response with route details from A*
      const routeResponse = {
        route: route.map(node => ({
          lat: node.lat,
          lng: node.lng
        })),
        distance: calculateTotalDistance(route),
        estimatedTime: calculateEstimatedTime(route, roadRatings),
        safetyScore: calculateSafetyScore(route, roadRatings),
        routeType: 'astar' // Indicate this is an A* calculated route
      };
      
      return res.status(200).json(routeResponse);
    }
    
    console.log('All routing methods failed');
    
    // Return an error instead of creating a simple direct route
    return res.status(404).json({
      message: 'Could not find a route between the specified locations. Please try different locations.'
    });
  } catch (error) {
    console.error('Route calculation error:', error);
    // Provide a more detailed error message
    const errorMessage = error.message || 'Unknown error occurred during route calculation';
    res.status(500).json({
      message: 'Failed to calculate route', 
      details: errorMessage
      // No fallback route - we don't want straight lines
    });
  }
};

// Function removed to prevent straight line routes

// Calculate simple distance between two points
function calculateSimpleDistance(start, destination) {
  return haversineDistance(start.lat, start.lng, destination.lat, destination.lng);
}

// Calculate simple time estimate
function calculateSimpleTime(start, destination) {
  const distance = calculateSimpleDistance(start, destination);
  const averageSpeed = 40; // km/h
  return (distance / averageSpeed) * 60; // Convert to minutes
}

// Haversine distance calculation function
function haversineDistance(lat1, lon1, lat2, lon2) {
  // Earth's radius in kilometers
  const R = 6371;
  
  // Convert latitude and longitude from degrees to radians
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  // Haversine formula
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  // Distance in kilometers
  return R * c;
}

// Calculate the total distance of the route in kilometers
function calculateTotalDistance(route) {
  let totalDistance = 0;
  
  for (let i = 0; i < route.length - 1; i++) {
    const point1 = route[i];
    const point2 = route[i + 1];
    
    // Calculate distance between consecutive points using haversine formula
    const distance = haversineDistance(
      point1.lat, point1.lng, 
      point2.lat, point2.lng
    );
    
    totalDistance += distance;
  }
  
  return totalDistance;
}

// Calculate estimated time based on distance and traffic conditions
function calculateEstimatedTime(route, roadRatings) {
  let totalTime = 0;
  const averageSpeed = 40; // km/h, base average speed
  
  for (let i = 0; i < route.length - 1; i++) {
    const point1 = route[i];
    const point2 = route[i + 1];
    
    // Calculate distance between consecutive points
    const lat1 = point1.lat;
    const lon1 = point1.lng;
    const lat2 = point2.lat;
    const lon2 = point2.lng;
    
    // Haversine formula to calculate distance
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Find road rating for this segment if it exists
    const roadSegment = roadRatings.find(rating => {
      const startMatch = 
        Math.abs(rating.coordinates.start.lat - lat1) < 0.0001 &&
        Math.abs(rating.coordinates.start.lng - lon1) < 0.0001;
      
      const endMatch = 
        Math.abs(rating.coordinates.end.lat - lat2) < 0.0001 &&
        Math.abs(rating.coordinates.end.lng - lon2) < 0.0001;
      
      return (startMatch && endMatch) || 
             (startMatch && Math.abs(rating.coordinates.end.lat - lat2) < 0.001 && 
              Math.abs(rating.coordinates.end.lng - lon2) < 0.001) ||
             (endMatch && Math.abs(rating.coordinates.start.lat - lat1) < 0.001 && 
              Math.abs(rating.coordinates.start.lng - lon1) < 0.001);
    });
    
    // Adjust speed based on traffic status
    let speedFactor = 1;
    if (roadSegment) {
      switch(roadSegment.trafficStatus) {
        case 'Congested': speedFactor = 0.4; break; // 40% of average speed
        case 'Moderate': speedFactor = 0.7; break;  // 70% of average speed
        case 'Smooth': speedFactor = 1.2; break;    // 120% of average speed
        default: speedFactor = 1;
      }
      
      // Further adjust for road quality
      if (roadSegment.rating === 'Bad') {
        speedFactor *= 0.8; // 80% of adjusted speed for bad roads
      }
    }
    
    const segmentSpeed = averageSpeed * speedFactor;
    const segmentTime = distance / segmentSpeed; // Time in hours
    
    totalTime += segmentTime;
  }
  
  return totalTime * 60; // Convert to minutes
}

// Calculate a safety score for the route (0-100)
function calculateSafetyScore(route, roadRatings) {
  let totalSegments = route.length - 1;
  let badRoadSegments = 0;
  
  for (let i = 0; i < route.length - 1; i++) {
    const point1 = route[i];
    const point2 = route[i + 1];
    
    // Find road rating for this segment if it exists
    const roadSegment = roadRatings.find(rating => {
      const startMatch = 
        Math.abs(rating.coordinates.start.lat - point1.lat) < 0.0001 &&
        Math.abs(rating.coordinates.start.lng - point1.lng) < 0.0001;
      
      const endMatch = 
        Math.abs(rating.coordinates.end.lat - point2.lat) < 0.0001 &&
        Math.abs(rating.coordinates.end.lng - point2.lng) < 0.0001;
      
      return (startMatch && endMatch) || 
             (startMatch && Math.abs(rating.coordinates.end.lat - point2.lat) < 0.001 && 
              Math.abs(rating.coordinates.end.lng - point2.lng) < 0.001) ||
             (endMatch && Math.abs(rating.coordinates.start.lat - point1.lat) < 0.001 && 
              Math.abs(rating.coordinates.start.lng - point1.lng) < 0.001);
    });
    
    if (roadSegment && roadSegment.rating === 'Bad') {
      badRoadSegments++;
    }
  }
  
  // Calculate safety percentage (higher is better)
  const safetyPercentage = 100 - ((badRoadSegments / totalSegments) * 100);
  
  return Math.round(safetyPercentage);
}

// Calculate safety score for OSRM route
function calculateSafetyScoreForOSRMRoute(routeCoordinates, roadRatings) {
  if (!routeCoordinates || routeCoordinates.length < 2) {
    return 85; // Default safety score if no valid route
  }
  
  let totalSegments = routeCoordinates.length - 1;
  let badRoadSegments = 0;
  
  // Sample the route at regular intervals to check for bad road segments
  // This is more efficient than checking every single point in a detailed route
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
  
  // Calculate the midpoint of the segment
  const midpoint = {
    lat: (point1.lat + point2.lat) / 2,
    lng: (point1.lng + point2.lng) / 2
  };
  
  let closestRating = null;
  let minDistance = Infinity;
  
  // Find the closest road rating by checking distance to midpoint
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
  
  // Only return the rating if it's within a reasonable distance (5km)
  return minDistance <= 5 ? closestRating : null;
}

// Traffic data functionality removed
exports.getTrafficData = async (req, res) => {
  // Return empty array since traffic functionality has been removed
  res.status(200).json([]);
};
