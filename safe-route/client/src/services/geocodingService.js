/**
 * Geocoding service for the Safe Route application
 * Uses OpenStreetMap Nominatim API for geocoding
 */

// Base URL for Nominatim API
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Search for locations in India by query
export const searchLocations = async (query) => {
  try {
    // Add viewbox parameter to limit search to India's boundaries
    // India's approximate boundaries: 6.0,68.0,37.0,97.5
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=10&viewbox=68.0,37.0,97.5,6.0&bounded=1`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch locations');
    }
    
    const data = await response.json();
    
    // Transform the response to match our application's format
    return data.map(item => ({
      name: item.display_name,
      shortName: item.name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      importance: item.importance,
      osmId: item.osm_id
    }));
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
};

// Get location details by coordinates (reverse geocoding)
export const getLocationByCoordinates = async (lat, lng) => {
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=json`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch location details');
    }
    
    const data = await response.json();
    
    return {
      name: data.display_name,
      shortName: data.name,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lon),
      type: data.type,
      osmId: data.osm_id
    };
  } catch (error) {
    console.error('Error getting location by coordinates:', error);
    return null;
  }
};

// Get detailed information about a place by its OSM ID
export const getPlaceDetails = async (osmId, osmType) => {
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/details?osmtype=${osmType}&osmid=${osmId}&format=json`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch place details');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
};
