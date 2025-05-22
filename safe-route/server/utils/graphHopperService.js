/**
 * Road routing service for the Safe Route application
 * This provides reliable road-based routing using multiple services
 */

const axios = require('axios');

// GraphHopper API base URL - using their demo server which is more reliable than OSRM demo
const GRAPHHOPPER_BASE_URL = 'https://graphhopper.com/api/1';

// GraphHopper API key - this is a demo key with limited usage
// In production, you should register for your own key at https://graphhopper.com/
const GRAPHHOPPER_API_KEY = 'fc4e0d67-e86e-4e8a-a142-e0c403914f5f';

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
    
    // Build the query parameters
    const params = {
      key: GRAPHHOPPER_API_KEY,
      vehicle: 'car',
      locale: 'en',
      instructions: true,
      calc_points: true,
      points_encoded: false
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
    const response = await axios.get(url, {
      timeout: 10000 // 10 second timeout
    });
    
    if (response.status !== 200) {
      console.error(`GraphHopper API returned status ${response.status}`);
      return null;
    }
    
    const routeData = response.data;
    
    if (!routeData.paths || routeData.paths.length === 0) {
      console.error('GraphHopper API returned no routes');
      return null;
    }
    
    const route = routeData.paths[0];
    const points = route.points.coordinates;
    const instructions = route.instructions || [];
    
    // Transform the route to our application's format
    const transformedRoute = {
      // Convert coordinates to our format {lat, lng}
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
          distance: instruction.distance / 1000,
          duration: instruction.time / 60000,
          name: instruction.street_name || '',
          instruction: instruction.text || '',
          maneuver: instruction.sign || 0
        }))
      }]
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

    // For GraphHopper, we'll use a simple approach since there's no direct snap-to-road endpoint
    // in the free tier. We'll return the original coordinates as GraphHopper will snap to road during routing.
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
