/**
 * Road routing service for the Safe Route application
 * This provides reliable road-based routing using multiple services
 * Firebase Version
 */

const axios = require('axios');
const { db } = require('../firebase');

// GraphHopper API base URL - using their demo server which is more reliable than OSRM demo
const GRAPHHOPPER_BASE_URL = 'https://graphhopper.com/api/1';

// GraphHopper API key - this is a demo key with limited usage
// In production, you should register for your own key at https://graphhopper.com/
const GRAPHHOPPER_API_KEY = 'fc4e0d67-e86e-4e8a-a142-e0c403914f5f';

// Collection name for caching routes in Firestore
const ROUTES_CACHE_COLLECTION = 'routes_cache';

/**
 * Get a route between two points using GraphHopper
 * @param {Object} start - Start coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @param {Array} waypoints - Optional intermediate waypoints [{lat, lng}, ...]
 * @returns {Object} - Route information with coordinates, distance, and duration
 */
async function getRoute(start, destination, waypoints = []) {
  try {
    // Validate input coordinates
    if (!start || !destination || !start.lat || !start.lng || !destination.lat || !destination.lng) {
      console.error('Invalid coordinates provided to GraphHopper:', { start, destination });
      return null;
    }

    console.log(`Requesting GraphHopper route from ${start.lat},${start.lng} to ${destination.lat},${destination.lng}`);
    
    // Build the query parameters with enhanced settings for more detailed road following
    const params = {
      key: GRAPHHOPPER_API_KEY,
      vehicle: 'car',
      locale: 'en',
      instructions: true,
      calc_points: true,
      points_encoded: false,
      elevation: false,
      details: 'road_class,road_environment,surface',
      algorithm: 'alternative_route',
      'ch.disable': true, // Disable contraction hierarchies for more precise routing
      'point_hint': '', // Empty point hint to ensure the exact points are used
      'snap_prevention': 'ferry', // Avoid ferries if possible
      max_visited_nodes: 5000 // Allow more nodes to be visited for better precision
    };
    
    // Build the URL with query parameters
    let url = `${GRAPHHOPPER_BASE_URL}/route?${Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')}`;
    
    // Add points parameters
    url += `&point=${start.lat},${start.lng}`;
    waypoints.forEach(wp => {
      url += `&point=${wp.lat},${wp.lng}`;
    });
    url += `&point=${destination.lat},${destination.lng}`;
    
    // Make request to GraphHopper API
    let response;
    try {
      console.log('GraphHopper API request URL:', url);
      response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        validateStatus: status => status < 500 // Only treat 500+ errors as exceptions
      });
      
      // Check if response is valid JSON
      if (response.status !== 200) {
        console.error(`GraphHopper API returned status ${response.status}`);
        return null;
      }
      
      // Verify we have valid JSON data
      if (typeof response.data !== 'object') {
        console.error('GraphHopper API returned non-JSON data:', typeof response.data);
        return null;
      }
      
      // Check specifically for HTML responses (which would cause the JSON parsing error)
      if (typeof response.data === 'string' && response.data.includes('<!doctype')) {
        console.error('GraphHopper API returned HTML instead of JSON');
        return null;
      }
      
      if (!response.data.paths || response.data.paths.length === 0) {
        console.error('GraphHopper API returned no routes');
        return null;
      }
    } catch (apiError) {
      console.error('Error making GraphHopper API request:', apiError.message);
      if (apiError.response) {
        console.error('Response data:', apiError.response.data);
      }
      return null;
    }
    
    // Get route data from response
    const routeData = response.data;
    
    const route = routeData.paths[0];
    const points = route.points.coordinates;
    const instructions = route.instructions || [];
    
    // Convert GraphHopper points to GeoJSON format for consistent handling
    console.log(`GraphHopper route has ${points.length} coordinate points`);
    
    // Create a GeoJSON geometry object from the points
    const geoJsonGeometry = {
      type: 'LineString',
      coordinates: points // GraphHopper already provides coordinates in [lng, lat] format
    };
    
    console.log('Created GeoJSON geometry from GraphHopper response');
    
    // Transform the route to our application's format with GeoJSON geometry
    const transformedRoute = {
      // Include the GeoJSON geometry
      geometry: geoJsonGeometry,
      // Also include coordinates in our app's format for backward compatibility
      coordinates: points.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      })),
      distance: route.distance / 1000, // Convert to kilometers
      duration: route.time / 60000, // Convert to minutes
      legs: [{
        distance: route.distance / 1000,
        duration: route.time / 60000,
        steps: instructions.map(instruction => ({
          // Create a GeoJSON geometry for each step if possible
          geometry: instruction.points ? {
            type: 'LineString',
            coordinates: instruction.points.coordinates || []
          } : null,
          distance: instruction.distance / 1000,
          duration: instruction.time / 60000,
          name: instruction.street_name || '',
          instruction: instruction.text || '',
          maneuver: instruction.sign || 0
        }))
      }],
      routeType: 'graphhopper'
    };
    
    return transformedRoute;
  } catch (error) {
    console.error('Error getting route from GraphHopper:', error.message);
    // Log more details about the error for debugging
    if (error.response) {
      console.error('GraphHopper error response data:', error.response.data);
      console.error('GraphHopper error response status:', error.response.status);
    } else if (error.request) {
      console.error('GraphHopper error - no response received');
    }
    return null;
  }
}

/**
 * Find the nearest road point to given coordinates
 * @param {Object} coordinates - Coordinates {lat, lng}
 * @returns {Object} - Nearest point on road with location and distance
 */
async function getNearestRoad(coordinates) {
  try {
    // Validate input coordinates
    if (!coordinates || !coordinates.lat || !coordinates.lng) {
      console.error('Invalid coordinates provided to getNearestRoad:', coordinates);
      return null;
    }

    // For GraphHopper, we can use the /geocode endpoint to find the nearest road
    // This is a more accurate approach than just returning the original coordinates
    try {
      const url = `${GRAPHHOPPER_BASE_URL}/geocode?point=${coordinates.lat},${coordinates.lng}&reverse=true&key=${GRAPHHOPPER_API_KEY}`;
      console.log('GraphHopper geocode API request URL:', url);
      
      const response = await axios.get(url, {
        timeout: 5000, // 5 second timeout
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        validateStatus: status => status < 500 // Only treat 500+ errors as exceptions
      });
      
      // Check if response is valid
      if (response.status !== 200 || typeof response.data !== 'object') {
        console.log('Falling back to original coordinates due to API response:', response.status);
        // Fall back to original coordinates
        return {
          location: {
            lat: coordinates.lat,
            lng: coordinates.lng
          },
          distance: 0,
          name: ''
        };
      }
      
      // If we have hits, use the first one
      if (response.data.hits && response.data.hits.length > 0) {
        const hit = response.data.hits[0];
        return {
          location: {
            lat: hit.point.lat,
            lng: hit.point.lng
          },
          distance: hit.distance || 0,
          name: hit.name || ''
        };
      }
    } catch (apiError) {
      console.error('Error in GraphHopper geocode API:', apiError.message);
      // Continue with fallback approach
    }
    
    // Fall back to original coordinates if the API call fails
    return {
      location: {
        lat: coordinates.lat,
        lng: coordinates.lng
      },
      distance: 0,
      name: ''
    };
  } catch (error) {
    console.error('Error in getNearestRoad:', error.message);
    return null;
  }
}

module.exports = {
  getRoute,
  getNearestRoad
};
