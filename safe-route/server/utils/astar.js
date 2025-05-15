/**
 * A* (A-star) algorithm implementation for finding the safest and fastest route
 * This implementation prioritizes both safety (avoiding "Bad" roads) and estimated time
 */

// Calculate the Haversine distance between two points (in kilometers)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate the heuristic (estimated distance to goal)
function heuristic(node, goal) {
  return haversineDistance(node.lat, node.lng, goal.lat, goal.lng);
}

// Get the safety weight of a road segment based on its rating
function getSafetyWeight(roadSegment) {
  // Higher weight means the algorithm will try to avoid this road
  if (!roadSegment) return 1; // Default weight if no rating exists
  
  switch(roadSegment.rating) {
    case 'Bad': return 3;    // Bad roads are heavily penalized
    case 'Good': return 0.8; // Good roads are preferred
    default: return 1;       // Default weight
  }
}

// Get the traffic weight of a road segment based on its traffic status
function getTrafficWeight(roadSegment) {
  if (!roadSegment) return 1; // Default weight if no traffic data exists
  
  switch(roadSegment.trafficStatus) {
    case 'Congested': return 2.5;  // Congested roads are heavily penalized
    case 'Moderate': return 1.5;   // Moderate traffic has some penalty
    case 'Smooth': return 1;       // Smooth traffic has no penalty
    default: return 1;             // Default weight
  }
}

// Find the road segment that contains the given coordinates
function findRoadSegment(roadRatings, lat1, lng1, lat2, lng2, threshold = 0.0001) {
  // Find a road segment that approximately matches the given coordinates
  return roadRatings.find(segment => {
    const startMatch = 
      Math.abs(segment.coordinates.start.lat - lat1) < threshold &&
      Math.abs(segment.coordinates.start.lng - lng1) < threshold;
    
    const endMatch = 
      Math.abs(segment.coordinates.end.lat - lat2) < threshold &&
      Math.abs(segment.coordinates.end.lng - lng2) < threshold;
    
    return (startMatch && endMatch) || 
           (startMatch && Math.abs(segment.coordinates.end.lat - lat2) < threshold * 10 && 
            Math.abs(segment.coordinates.end.lng - lng2) < threshold * 10) ||
           (endMatch && Math.abs(segment.coordinates.start.lat - lat1) < threshold * 10 && 
            Math.abs(segment.coordinates.start.lng - lng1) < threshold * 10);
  });
}

// Check if the coordinates are within India's boundaries
function isWithinIndia(lat, lng) {
  // Approximate boundaries of India
  const northBound = 37.0;  // Northern boundary
  const southBound = 6.0;   // Southern boundary
  const westBound = 68.0;   // Western boundary
  const eastBound = 97.5;   // Eastern boundary
  
  return lat >= southBound && lat <= northBound && lng >= westBound && lng <= eastBound;
}

// A* algorithm implementation
function findRoute(start, goal, graph, roadRatings) {
  // Check if start and goal are within India
  if (!isWithinIndia(start.lat, start.lng) || !isWithinIndia(goal.lat, goal.lng)) {
    throw new Error('Route must be within Indian geographical boundaries');
  }
  
  const openSet = [start];
  const closedSet = new Set();
  
  // Initialize the gScore and fScore maps
  const gScore = new Map();
  const fScore = new Map();
  
  // For reconstructing the path
  const cameFrom = new Map();
  
  // Set the initial scores
  gScore.set(start.id, 0);
  fScore.set(start.id, heuristic(start, goal));
  
  while (openSet.length > 0) {
    // Find the node with the lowest fScore
    let current = openSet.reduce((lowest, node) => 
      (fScore.get(node.id) < fScore.get(lowest.id)) ? node : lowest, openSet[0]);
    
    // If we've reached the goal, reconstruct and return the path
    if (current.id === goal.id) {
      const path = [];
      while (current) {
        path.unshift(current);
        current = cameFrom.get(current.id);
      }
      return path;
    }
    
    // Remove current from openSet and add to closedSet
    openSet.splice(openSet.indexOf(current), 1);
    closedSet.add(current.id);
    
    // Check each neighbor of the current node
    for (const neighbor of graph[current.id] || []) {
      // Skip if this neighbor is already evaluated
      if (closedSet.has(neighbor.id)) continue;
      
      // Find the road segment between current and neighbor
      const roadSegment = findRoadSegment(
        roadRatings, 
        current.lat, current.lng, 
        neighbor.lat, neighbor.lng
      );
      
      // Calculate the safety and traffic weights
      const safetyWeight = getSafetyWeight(roadSegment);
      const trafficWeight = getTrafficWeight(roadSegment);
      
      // Calculate the distance between current and neighbor
      const distance = haversineDistance(current.lat, current.lng, neighbor.lat, neighbor.lng);
      
      // Apply weights to the distance
      const weightedDistance = distance * safetyWeight * trafficWeight;
      
      // Calculate tentative gScore
      const tentativeGScore = (gScore.get(current.id) || Infinity) + weightedDistance;
      
      // Add neighbor to openSet if it's not there
      if (!openSet.some(node => node.id === neighbor.id)) {
        openSet.push(neighbor);
      } else if (tentativeGScore >= (gScore.get(neighbor.id) || Infinity)) {
        // This is not a better path
        continue;
      }
      
      // This path is the best so far, record it
      cameFrom.set(neighbor.id, current);
      gScore.set(neighbor.id, tentativeGScore);
      fScore.set(neighbor.id, tentativeGScore + heuristic(neighbor, goal));
    }
  }
  
  // No path found
  return null;
}

module.exports = {
  findRoute,
  haversineDistance,
  isWithinIndia
};
