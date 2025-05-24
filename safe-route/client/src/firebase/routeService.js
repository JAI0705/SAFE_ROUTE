/**
 * Route Service - Handles route calculation using OSRM or GraphHopper APIs
 */
import axios from 'axios';

// OSRM API configuration
const OSRM_BASE_URL = 'https://router.project-osrm.org';

// GraphHopper API configuration
const GRAPHHOPPER_API_KEY = 'fc4e0d67-e86e-4e8a-a142-e0c403914f5f';
const GRAPHHOPPER_BASE_URL = 'https://graphhopper.com/api/1';

/**
 * Calculate a route using OSRM API
 * @param {Object} startPoint - Start location {lat, lng}
 * @param {Object} endPoint - Destination {lat, lng}
 * @returns {Object} - Route data with GeoJSON geometry
 */
export const getOsrmRoute = async (startPoint, endPoint) => {
  try {
    // Format coordinates for OSRM (lng,lat format)
    const coordinates = `${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`;
    
    // Build URL with detailed parameters to ensure accurate road following
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=false&annotations=true`;
    
    console.log('OSRM route API request URL:', url);
    
    // Make request to OSRM API
    const response = await axios.get(url, {
      timeout: 15000, // 15 second timeout
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status !== 200 || !response.data || !response.data.routes || response.data.routes.length === 0) {
      console.error('Invalid OSRM response:', response.data);
      return null;
    }
    
    const route = response.data.routes[0];
    
    // Return the route with GeoJSON geometry
    return {
      geometry: route.geometry,
      coordinates: route.geometry.coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      })),
      distance: route.distance / 1000, // Convert to kilometers
      duration: route.duration / 60, // Convert to minutes
      source: 'osrm'
    };
  } catch (error) {
    console.error('OSRM API error:', error);
    return null;
  }
};

/**
 * Calculate a route using GraphHopper API
 * @param {Object} startPoint - Start location {lat, lng}
 * @param {Object} endPoint - Destination {lat, lng}
 * @returns {Object} - Route data with GeoJSON geometry
 */
export const getGraphHopperRoute = async (startPoint, endPoint) => {
  try {
    // Build URL with detailed parameters
    const url = `${GRAPHHOPPER_BASE_URL}/route?point=${startPoint.lat},${startPoint.lng}&point=${endPoint.lat},${endPoint.lng}&vehicle=car&debug=true&key=${GRAPHHOPPER_API_KEY}&type=json&points_encoded=false`;
    
    console.log('GraphHopper route API request URL:', url);
    
    // Make request to GraphHopper API
    const response = await axios.get(url, {
      timeout: 15000, // 15 second timeout
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status !== 200 || !response.data || !response.data.paths || response.data.paths.length === 0) {
      console.error('Invalid GraphHopper response:', response.data);
      return null;
    }
    
    const route = response.data.paths[0];
    const points = route.points.coordinates;
    
    // Create a GeoJSON geometry from the points
    const geoJsonGeometry = {
      type: 'LineString',
      coordinates: points // GraphHopper already provides coordinates in [lng, lat] format
    };
    
    // Return the route with GeoJSON geometry
    return {
      geometry: geoJsonGeometry,
      coordinates: points.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      })),
      distance: route.distance / 1000, // Convert to kilometers
      duration: route.time / 60000, // Convert to minutes
      source: 'graphhopper'
    };
  } catch (error) {
    console.error('GraphHopper API error:', error);
    return null;
  }
};

/**
 * Calculate a route using either OSRM or GraphHopper API
 * @param {Object} startPoint - Start location {lat, lng}
 * @param {Object} endPoint - Destination {lat, lng}
 * @returns {Object} - Route data with GeoJSON geometry
 */
export const calculateRoute = async (startPoint, endPoint) => {
  // Try OSRM first
  const osrmRoute = await getOsrmRoute(startPoint, endPoint);
  if (osrmRoute) {
    console.log('Successfully retrieved route from OSRM');
    return osrmRoute;
  }
  
  // If OSRM fails, try GraphHopper
  console.log('OSRM failed, trying GraphHopper');
  const graphHopperRoute = await getGraphHopperRoute(startPoint, endPoint);
  if (graphHopperRoute) {
    console.log('Successfully retrieved route from GraphHopper');
    return graphHopperRoute;
  }
  
  // If both fail, return null
  console.error('Failed to get route from both OSRM and GraphHopper');
  return null;
};
