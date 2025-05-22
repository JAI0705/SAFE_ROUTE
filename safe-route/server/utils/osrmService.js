/**
 * OSRM (Open Source Routing Machine) service for the Safe Route application
 * This service integrates with the OSRM API to get realistic road routes
 */

const axios = require('axios');

// Base URL for OSRM API - using the demo server for development
// In production, you should host your own OSRM instance or use a paid service
const OSRM_BASE_URL = 'https://router.project-osrm.org';

/**
 * Get a route between two points using OSRM
 * @param {Object} start - Start coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @param {Array} waypoints - Optional intermediate waypoints [{lat, lng}, ...]
 * @returns {Object} - Route information with coordinates, distance, and duration
 */
async function getRoute(start, destination, waypoints = []) {
  try {
    // Validate input coordinates
    if (!start || !destination || !start.lat || !start.lng || !destination.lat || !destination.lng) {
      console.error('Invalid coordinates provided to OSRM service:', { start, destination });
      return null;
    }

    // Format coordinates for OSRM (lng,lat format)
    const coordinates = [
      `${start.lng},${start.lat}`,
      ...waypoints.map(wp => `${wp.lng},${wp.lat}`),
      `${destination.lng},${destination.lat}`
    ].join(';');
    
    console.log(`Requesting OSRM route from ${start.lat},${start.lng} to ${destination.lat},${destination.lng}`);
    
    // Make request to OSRM API with timeout
    const response = await axios.get(
      `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`,
      { timeout: 10000 } // 10 second timeout
    );
    
    if (response.status !== 200) {
      console.error(`OSRM API returned status ${response.status}`);
      return null;
    }
    
    if (!response.data.routes || response.data.routes.length === 0) {
      console.error('OSRM API returned no routes');
      return null;
    }
    
    const route = response.data.routes[0];
    
    // Transform the route to our application's format
    const transformedRoute = {
      // Convert GeoJSON coordinates [lng, lat] to our format {lat, lng}
      coordinates: route.geometry.coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      })),
      distance: route.distance / 1000, // Convert to kilometers
      duration: route.duration / 60, // Convert to minutes
      legs: route.legs.map(leg => ({
        distance: leg.distance / 1000,
        duration: leg.duration / 60,
        steps: leg.steps.map(step => ({
          distance: step.distance / 1000,
          duration: step.duration / 60,
          name: step.name,
          maneuver: step.maneuver.type,
          instruction: step.maneuver.instruction
        }))
      }))
    };
    
    return transformedRoute;
  } catch (error) {
    console.error('Error getting route from OSRM:', error.message);
    // Log more details about the error for debugging
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      console.error('OSRM error response data:', error.response.data);
      console.error('OSRM error response status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('OSRM error - no response received');
    }
    return null;
  }
}

/**
 * Get a table of distances and durations between multiple points
 * Useful for finding the nearest road segments
 * @param {Array} points - Array of points [{lat, lng}, ...]
 * @returns {Object} - Matrix of distances and durations
 */
async function getDistanceMatrix(points) {
  try {
    if (!points || points.length < 2) {
      throw new Error('At least 2 points are required for distance matrix');
    }
    
    // Format coordinates for OSRM (lng,lat format)
    const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
    
    // Make request to OSRM API
    const response = await axios.get(
      `${OSRM_BASE_URL}/table/v1/driving/${coordinates}`
    );
    
    if (response.status !== 200) {
      throw new Error('Failed to get distance matrix from OSRM');
    }
    
    return {
      distances: response.data.distances, // Matrix of distances in meters
      durations: response.data.durations  // Matrix of durations in seconds
    };
  } catch (error) {
    console.error('Error getting distance matrix from OSRM:', error);
    return null;
  }
}

/**
 * Find the nearest road point to given coordinates
 * @param {Object} coordinates - Coordinates {lat, lng}
 * @returns {Object} - Nearest point on road with waypoint and original indices
 */
async function getNearestRoad(coordinates) {
  try {
    // Validate input coordinates
    if (!coordinates || !coordinates.lat || !coordinates.lng) {
      console.error('Invalid coordinates provided to getNearestRoad:', coordinates);
      return null;
    }

    // Format coordinates for OSRM (lng,lat format)
    const coordString = `${coordinates.lng},${coordinates.lat}`;
    
    // Make request to OSRM API with timeout
    const response = await axios.get(
      `${OSRM_BASE_URL}/nearest/v1/driving/${coordString}?number=1`,
      { timeout: 5000 } // 5 second timeout
    );
    
    if (response.status !== 200) {
      console.error(`OSRM nearest API returned status ${response.status}`);
      return null;
    }
    
    if (!response.data.waypoints || response.data.waypoints.length === 0) {
      console.error('OSRM nearest API returned no waypoints');
      return null;
    }
    
    const waypoint = response.data.waypoints[0];
    
    return {
      location: {
        lat: waypoint.location[1],
        lng: waypoint.location[0]
      },
      distance: waypoint.distance, // Distance to the nearest road in meters
      name: waypoint.name
    };
  } catch (error) {
    console.error('Error getting nearest road from OSRM:', error.message);
    // Log more details about the error for debugging
    if (error.response) {
      console.error('OSRM nearest error response data:', error.response.data);
      console.error('OSRM nearest error response status:', error.response.status);
    } else if (error.request) {
      console.error('OSRM nearest error - no response received');
    }
    return null;
  }
}

module.exports = {
  getRoute,
  getDistanceMatrix,
  getNearestRoad
};
