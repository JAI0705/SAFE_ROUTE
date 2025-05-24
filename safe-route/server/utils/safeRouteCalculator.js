/**
 * Safe Route Calculator - Firebase Version
 * Utility to calculate routes prioritizing both safety and speed
 */
const axios = require('axios');
const RoadRatingModel = require('../models/RoadRating');
const { db } = require('../firebase');
const { safeApiRequest } = require('./apiHelper');

// GraphHopper API configuration
const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY || 'fc4e0d67-e86e-4e8a-a142-e0c403914f5f';
const GRAPHHOPPER_BASE_URL = 'https://graphhopper.com/api/1';

// OSRM API configuration
const OSRM_BASE_URL = 'https://router.project-osrm.org';

// Collection name for caching routes in Firestore
const ROUTES_CACHE_COLLECTION = 'routes_cache';

/**
 * Calculate the distance between two points using the Haversine formula
 * @param {Number} lat1 - Latitude of point 1
 * @param {Number} lng1 - Longitude of point 1
 * @param {Number} lat2 - Latitude of point 2
 * @param {Number} lng2 - Longitude of point 2
 * @returns {Number} - Distance in kilometers
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  // Earth's radius in kilometers
  const R = 6371;
  
  // Convert latitude and longitude from degrees to radians
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  // Haversine formula
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  // Distance in kilometers
  return R * c;
}

/**
 * Calculate a route that prioritizes safety based on road ratings
 * @param {Object} startPoint - Starting coordinates {lat, lng}
 * @param {Object} destPoint - Destination coordinates {lat, lng}
 * @returns {Object} - Route details with coordinates, distance, duration, etc.
 */
async function calculateSafeRoute(startPoint, destPoint) {
  console.log('Calculating safe route with road ratings consideration');
  
  try {
    // Get road ratings from Firebase for the area
    const bounds = getBoundingBox(startPoint, destPoint);
    const roadRatings = await getRoadRatings(bounds);
    
    console.log(`Found ${roadRatings.length} road ratings in the area`);
    
    // First try to get multiple alternative routes from GraphHopper
    const alternativeRoutes = await getAlternativeRoutes(startPoint, destPoint);
    
    if (alternativeRoutes && alternativeRoutes.length > 0) {
      console.log(`Found ${alternativeRoutes.length} alternative routes to evaluate for safety`);
      
      // Evaluate each route for safety and speed
      const evaluatedRoutes = evaluateRoutes(alternativeRoutes, roadRatings);
      
      // Return the best route based on safety and speed
      return evaluatedRoutes[0]; // The first route is the best one after sorting
    }
    
    // If GraphHopper fails, try OSRM as fallback
    console.log('GraphHopper alternatives failed, trying OSRM');
    const osrmRoute = await getOSRMRoute(startPoint, destPoint);
    
    if (osrmRoute) {
      // Since OSRM doesn't provide alternatives easily, we'll just evaluate this one route
      const safetyScore = calculateSafetyScore(osrmRoute.coordinates, roadRatings);
      return {
        ...osrmRoute,
        safetyScore,
        routeType: 'osrm-safe'
      };
    }
    
    throw new Error('Failed to calculate a safe route');
  } catch (error) {
    console.error('Error calculating safe route:', error.message);
    throw error;
  }
}

/**
 * Get road ratings from Firebase for a specific area
 * @param {Object} bounds - Geographic bounds {north, south, east, west}
 * @returns {Array} - Array of road ratings
 */
async function getRoadRatings(bounds) {
  try {
    console.log('Fetching road ratings from Firebase for bounds:', bounds);
    
    // Check if we have a cache entry for this area
    const cacheKey = `${bounds.north.toFixed(3)}_${bounds.south.toFixed(3)}_${bounds.east.toFixed(3)}_${bounds.west.toFixed(3)}`;
    const cacheRef = db.collection(ROUTES_CACHE_COLLECTION).doc(cacheKey);
    const cacheDoc = await cacheRef.get();
    
    // If we have a recent cache (less than 1 hour old), use it
    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();
      const cacheTime = cacheData.timestamp.toDate();
      const now = new Date();
      const cacheAgeMs = now - cacheTime;
      
      // Cache is valid for 1 hour (3600000 ms)
      if (cacheAgeMs < 3600000) {
        console.log('Using cached road ratings, cache age:', Math.round(cacheAgeMs / 1000), 'seconds');
        return cacheData.ratings;
      }
      console.log('Cache expired, fetching fresh data');
    }
    
    // Use the Firebase-based RoadRating model to get fresh data
    const ratings = await RoadRatingModel.findByBounds(bounds);
    
    // Cache the results for future use
    if (ratings && ratings.length > 0) {
      await cacheRef.set({
        ratings,
        timestamp: new Date(),
        bounds
      });
      console.log(`Cached ${ratings.length} road ratings for future use`);
    }
    
    return ratings;
  } catch (error) {
    console.error('Error getting road ratings from Firebase:', error);
    
    // Try to get fallback data from the mockRoadRatings if available
    try {
      const { mockRoadRatings } = require('../controllers/ratingsController');
      console.log('Using mock road ratings as fallback');
      return mockRoadRatings || [];
    } catch (fallbackError) {
      console.error('Failed to get fallback ratings:', fallbackError);
      return []; // Return empty array if all else fails
    }
  }
}

/**
 * Calculate bounding box for an area between two points
 * @param {Object} point1 - First point {lat, lng}
 * @param {Object} point2 - Second point {lat, lng}
 * @returns {Object} - Bounding box {north, south, east, west}
 */
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

/**
 * Get multiple alternative routes from GraphHopper
 * @param {Object} startPoint - Starting coordinates {lat, lng}
 * @param {Object} destPoint - Destination coordinates {lat, lng}
 * @returns {Array} - Array of alternative routes
 */
async function getAlternativeRoutes(startPoint, destPoint) {
  try {
    console.log('Getting alternative routes from GraphHopper');
    
    // Build the URL for GraphHopper API
    const url = `${GRAPHHOPPER_BASE_URL}/route?point=${startPoint.lat},${startPoint.lng}&point=${destPoint.lat},${destPoint.lng}&vehicle=car&alternative_route.max_paths=3&key=${GRAPHHOPPER_API_KEY}&points_encoded=false`;
    console.log('GraphHopper alternative routes API URL:', url);
    
    // Use the safe API request utility to handle errors and HTML responses
    const data = await safeApiRequest(url, {
      timeout: 10000,
      method: 'get',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // If no data or no paths, return empty array
    if (!data || !data.paths || data.paths.length === 0) {
      console.error('GraphHopper API returned no valid paths');
      return [];
    }
    
    // Transform the paths to our format
    return data.paths.map(path => {
      // Extract coordinates from the encoded polyline or use the coordinates directly
      let coordinates;
      if (path.points_encoded === false && path.points.coordinates) {
        // If points are not encoded, use the coordinates directly
        coordinates = path.points.coordinates.map(point => ({
          lat: point[1],
          lng: point[0]
        }));
      } else {
        // Otherwise decode the polyline
        coordinates = decodePolyline(path.points).map(point => ({
          lat: point[0],
          lng: point[1]
        }));
      }
      
      return {
        coordinates,
        distance: path.distance / 1000, // Convert to kilometers
        time: path.time / 1000 / 60, // Convert to minutes
        routeType: 'graphhopper'
      };
    });
  } catch (error) {
    console.error('Error getting alternative routes from GraphHopper:', error.message);
    return [];
  }
}

/**
 * Get a route from OSRM
 * @param {Object} startPoint - Starting coordinates {lat, lng}
 * @param {Object} destPoint - Destination coordinates {lat, lng}
 * @returns {Object} - Route details
 */
async function getOSRMRoute(startPoint, destPoint) {
  try {
    // Request route from OSRM
    const url = `${OSRM_BASE_URL}/route/v1/driving/${startPoint.lng},${startPoint.lat};${destPoint.lng},${destPoint.lat}?overview=full&geometries=geojson&steps=true`;
    console.log('OSRM route API request URL:', url);
    
    // Use the safe API request utility to handle errors and HTML responses
    console.log('Making safe API request to OSRM:', url);
    const data = await safeApiRequest(url, {
      timeout: 10000,
      method: 'get',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // If no data or no routes, return null
    if (!data || !data.routes || data.routes.length === 0) {
      console.error('OSRM API returned no valid routes');
      return null;
    }
    
    // Process the valid route data
    const route = data.routes[0];
    
    // Transform OSRM response to our format
    const coordinates = route.geometry.coordinates.map(coord => ({
      lat: coord[1],
      lng: coord[0]
    }));
    
    return {
      coordinates,
      distance: route.distance / 1000, // Convert to kilometers
      time: route.duration / 60, // Convert to minutes
      routeType: 'osrm'
    };
  } catch (error) {
    console.error('Error getting route from OSRM:', error.message);
    return null;
  }
}

/**
 * Evaluate routes for safety and speed
 * @param {Array} routes - Array of routes to evaluate
 * @param {Array} roadRatings - Array of road ratings from the database
 * @returns {Array} - Sorted array of routes with safety scores
 */
function evaluateRoutes(routes, roadRatings) {
  // Calculate safety and speed scores for each route
  const evaluatedRoutes = routes.map(route => {
    // Calculate safety score (0-100, higher is better)
    const safetyScore = calculateSafetyScore(route.coordinates, roadRatings);
    
    // Calculate speed score based on estimated time (0-100, higher is better)
    // Shorter time = higher score
    const speedScore = Math.min(100, 100 * (60 / route.time));
    
    // Combined score with safety weighted more heavily
    const combinedScore = (safetyScore * 0.7) + (speedScore * 0.3);
    
    return {
      ...route,
      safetyScore,
      speedScore,
      combinedScore
    };
  });
  
  // Sort routes by combined score (higher is better)
  return evaluatedRoutes.sort((a, b) => b.combinedScore - a.combinedScore);
}

/**
 * Calculate safety score for a route based on road ratings
 * @param {Array} coordinates - Array of coordinates for the route
 * @param {Array} roadRatings - Array of road ratings from the database
 * @returns {Number} - Safety score (0-100)
 */
function calculateSafetyScore(coordinates, roadRatings) {
  if (!coordinates || coordinates.length < 2) {
    return 85; // Default safety score if no valid route
  }
  
  let totalSegments = coordinates.length - 1;
  let badRoadSegments = 0;
  
  // Sample the route at regular intervals to check for bad road segments
  const sampleInterval = Math.max(1, Math.floor(coordinates.length / 20)); // Check up to 20 segments
  
  for (let i = 0; i < coordinates.length - 1; i += sampleInterval) {
    const point1 = coordinates[i];
    const point2 = coordinates[Math.min(i + sampleInterval, coordinates.length - 1)];
    
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

/**
 * Find the closest road rating to a segment
 * @param {Object} point1 - Start point of the segment
 * @param {Object} point2 - End point of the segment
 * @param {Array} roadRatings - Array of road ratings
 * @returns {Object} - The closest road rating or null
 */
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

/**
 * Decode a polyline string to an array of coordinates
 * @param {String} encoded - Encoded polyline string
 * @returns {Array} - Array of [lat, lng] coordinates
 */
function decodePolyline(encoded) {
  // Implementation of Google's polyline algorithm
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    coordinates.push([lat * 1e-5, lng * 1e-5]);
  }

  return coordinates;
}

module.exports = {
  calculateSafeRoute
};
