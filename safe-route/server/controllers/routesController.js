// const RoadRating = require('../models/RoadRating');

// Mock traffic data
const mockTrafficData = [
  {
    id: 'traffic_delhi_1',
    coordinates: {
      start: { lat: 28.7041, lng: 77.1025 },
      end: { lat: 28.5, lng: 77.3 }
    },
    trafficStatus: 'Moderate'
  },
  {
    id: 'traffic_delhi_2',
    coordinates: {
      start: { lat: 28.5, lng: 77.3 },
      end: { lat: 28.4, lng: 77.5 }
    },
    trafficStatus: 'Congested'
  },
  {
    id: 'traffic_mumbai_1',
    coordinates: {
      start: { lat: 19.0760, lng: 72.8777 },
      end: { lat: 19.2, lng: 72.9 }
    },
    trafficStatus: 'Smooth'
  }
];

// Get mock road ratings from the ratings controller
const { mockRoadRatings } = require('./ratingsController');
const { findRoute, isWithinIndia } = require('../utils/astar');

// Mock road network graph for India
// In a production environment, this would be fetched from a database or external API
const roadNetworkGraph = require('../utils/mockRoadNetwork');

// Calculate route using A* algorithm
exports.calculateRoute = async (req, res) => {
  try {
    const { start, destination } = req.body;
    
    if (!start || !destination || !start.lat || !start.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({ message: 'Start and destination coordinates are required' });
    }
    
    // Validate that coordinates are within India
    if (!isWithinIndia(start.lat, start.lng) || !isWithinIndia(destination.lat, destination.lng)) {
      return res.status(400).json({ message: 'Route must be within Indian geographical boundaries' });
    }
    
    // Use mock road ratings for demo
    const roadRatings = mockRoadRatings || [];
    
    // Prepare start and destination nodes
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
    const route = findRoute(startNode, destinationNode, roadNetworkGraph, roadRatings);
    
    if (!route) {
      // For demo purposes, create a simple route if A* doesn't find one
      const simpleRoute = createSimpleRoute(start, destination);
      
      // Prepare response with route details
      const routeResponse = {
        route: simpleRoute,
        distance: calculateSimpleDistance(start, destination),
        estimatedTime: calculateSimpleTime(start, destination),
        safetyScore: 85 // Default good safety score for demo
      };
      
      return res.status(200).json(routeResponse);
    }
    
    // Prepare response with route details
    const routeResponse = {
      route: route.map(node => ({
        lat: node.lat,
        lng: node.lng
      })),
      distance: calculateTotalDistance(route),
      estimatedTime: calculateEstimatedTime(route, roadRatings),
      safetyScore: calculateSafetyScore(route, roadRatings)
    };
    
    res.status(200).json(routeResponse);
  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create a simple route between two points for demo purposes
function createSimpleRoute(start, destination) {
  // Create a simple route with a few intermediate points
  const latDiff = destination.lat - start.lat;
  const lngDiff = destination.lng - start.lng;
  
  // Create 3 intermediate points
  return [
    { lat: start.lat, lng: start.lng },
    { lat: start.lat + latDiff * 0.25, lng: start.lng + lngDiff * 0.25 },
    { lat: start.lat + latDiff * 0.5, lng: start.lng + lngDiff * 0.5 },
    { lat: start.lat + latDiff * 0.75, lng: start.lng + lngDiff * 0.75 },
    { lat: destination.lat, lng: destination.lng }
  ];
}

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

// Calculate the total distance of the route in kilometers
function calculateTotalDistance(route) {
  let totalDistance = 0;
  
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

// Get traffic data for a specific area
exports.getTrafficData = async (req, res) => {
  try {
    const { north, south, east, west } = req.query;
    
    if (!north || !south || !east || !west) {
      return res.status(400).json({ message: 'Missing boundary parameters' });
    }

    // Filter mock traffic data based on bounds
    const trafficData = mockTrafficData.filter(segment => {
      // Check if start point is within bounds
      const startInBounds = 
        segment.coordinates.start.lat <= parseFloat(north) && 
        segment.coordinates.start.lat >= parseFloat(south) && 
        segment.coordinates.start.lng <= parseFloat(east) && 
        segment.coordinates.start.lng >= parseFloat(west);
      
      // Check if end point is within bounds
      const endInBounds = 
        segment.coordinates.end.lat <= parseFloat(north) && 
        segment.coordinates.end.lat >= parseFloat(south) && 
        segment.coordinates.end.lng <= parseFloat(east) && 
        segment.coordinates.end.lng >= parseFloat(west);
      
      return startInBounds || endInBounds;
    });

    res.status(200).json(trafficData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
