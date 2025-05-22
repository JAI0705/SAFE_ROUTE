/**
 * Safe Route Calculator
 * Utility to calculate routes prioritizing both safety and speed
 */
const axios = require('axios');

// GraphHopper API configuration
const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY || 'demo-key';
const GRAPHHOPPER_BASE_URL = 'https://graphhopper.com/api/1';

// OSRM API configuration
const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

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
 * @param {Array} roadRatings - Array of road ratings from the database
 * @returns {Object} - Route details with coordinates, distance, duration, etc.
 */
async function calculateSafeRoute(startPoint, destPoint, roadRatings) {
  console.log('Calculating safe route with road ratings consideration');
  
  try {
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
 * Get multiple alternative routes from GraphHopper
 * @param {Object} startPoint - Starting coordinates {lat, lng}
 * @param {Object} destPoint - Destination coordinates {lat, lng}
 * @returns {Array} - Array of alternative routes
 */
async function getAlternativeRoutes(startPoint, destPoint) {
  try {
    // Request multiple alternative routes from GraphHopper
    const url = `${GRAPHHOPPER_BASE_URL}/route?point=${startPoint.lat},${startPoint.lng}&point=${destPoint.lat},${destPoint.lng}&vehicle=car&alternative_route.max_paths=3&key=${GRAPHHOPPER_API_KEY}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (response.status === 200 && response.data && response.data.paths) {
      // Transform GraphHopper response to our format
      return response.data.paths.map(path => {
        // Extract coordinates from the encoded polyline
        const coordinates = decodePolyline(path.points).map(point => ({
          lat: point[0],
          lng: point[1]
        }));
        
        return {
          coordinates,
          distance: path.distance / 1000, // Convert to km
          duration: path.time / 60000, // Convert to minutes
          routeType: 'graphhopper'
        };
      });
    }
    
    return [];
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
    const url = `${OSRM_BASE_URL}/${startPoint.lng},${startPoint.lat};${destPoint.lng},${destPoint.lat}?overview=full&geometries=geojson`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (response.status === 200 && response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      
      // Transform coordinates from GeoJSON format [lng, lat] to our format {lat, lng}
      const coordinates = route.geometry.coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));
      
      return {
        coordinates,
        distance: route.distance / 1000, // Convert to km
        duration: route.duration / 60, // Convert to minutes
        routeType: 'osrm'
      };
    }
    
    return null;
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
  // Calculate safety score for each route
  const evaluatedRoutes = routes.map(route => {
    const safetyScore = calculateSafetyScore(route.coordinates, roadRatings);
    
    // Calculate a combined score that considers both safety and speed
    // Weight: 70% safety, 30% speed (inverse of duration)
    const speedScore = 100 - Math.min(100, (route.duration / 10)); // Normalize duration
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
