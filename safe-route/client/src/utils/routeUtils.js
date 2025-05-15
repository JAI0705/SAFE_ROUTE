/**
 * Utility functions for route calculations and visualizations
 */

// Calculate the Haversine distance between two points (in kilometers)
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Check if coordinates are within India's boundaries
export const isWithinIndia = (lat, lng) => {
  // Approximate boundaries of India
  const northBound = 37.0;  // Northern boundary
  const southBound = 6.0;   // Southern boundary
  const westBound = 68.0;   // Western boundary
  const eastBound = 97.5;   // Eastern boundary
  
  return lat >= southBound && lat <= northBound && lng >= westBound && lng <= eastBound;
};

// Format distance for display
export const formatDistance = (distance) => {
  if (!distance) return '';
  
  return distance < 1 
    ? `${Math.round(distance * 1000)} m` 
    : `${distance.toFixed(1)} km`;
};

// Format time for display
export const formatTime = (minutes) => {
  if (!minutes) return '';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours === 0) {
    return `${mins} min`;
  } else if (mins === 0) {
    return `${hours} hr`;
  } else {
    return `${hours} hr ${mins} min`;
  }
};

// Get color for traffic status
export const getTrafficStatusColor = (status) => {
  switch (status) {
    case 'Smooth': return '#28a745';  // Green
    case 'Moderate': return '#ffc107'; // Yellow
    case 'Congested': return '#dc3545'; // Red
    default: return '#ffc107';
  }
};

// Get color for safety score
export const getSafetyScoreColor = (score) => {
  if (score >= 80) return '#28a745';  // Green
  if (score >= 50) return '#ffc107';  // Yellow
  return '#dc3545';  // Red
};

// Calculate estimated arrival time
export const calculateETA = (minutes) => {
  if (!minutes) return '';
  
  const now = new Date();
  const arrivalTime = new Date(now.getTime() + minutes * 60000);
  
  return arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Generate a unique ID for road segments
export const generateRoadId = (startLat, startLng, endLat, endLng) => {
  return `road_${startLat.toFixed(4)}_${startLng.toFixed(4)}_${endLat.toFixed(4)}_${endLng.toFixed(4)}`;
};

// Find the closest road segment to a point
export const findClosestRoadSegment = (point, roadSegments, threshold = 0.01) => {
  if (!roadSegments || roadSegments.length === 0) return null;
  
  let closestSegment = null;
  let minDistance = Infinity;
  
  roadSegments.forEach(segment => {
    // Calculate distance to start point
    const distToStart = haversineDistance(
      point.lat, 
      point.lng, 
      segment.coordinates.start.lat, 
      segment.coordinates.start.lng
    );
    
    // Calculate distance to end point
    const distToEnd = haversineDistance(
      point.lat, 
      point.lng, 
      segment.coordinates.end.lat, 
      segment.coordinates.end.lng
    );
    
    // Take the minimum distance
    const distance = Math.min(distToStart, distToEnd);
    
    if (distance < minDistance && distance <= threshold) {
      minDistance = distance;
      closestSegment = segment;
    }
  });
  
  return closestSegment;
};

// Calculate the center point of a road segment
export const calculateSegmentCenter = (segment) => {
  if (!segment || !segment.coordinates) return null;
  
  return {
    lat: (segment.coordinates.start.lat + segment.coordinates.end.lat) / 2,
    lng: (segment.coordinates.start.lng + segment.coordinates.end.lng) / 2
  };
};
