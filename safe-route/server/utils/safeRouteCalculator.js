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
 * Calculate route between two points using OSRM API and user ratings
 * @param {Object} startLocation - Start location {lat, lng}
 * @param {Object} destination - Destination {lat, lng}
 * @param {Boolean} prioritizeSafety - Whether to prioritize safety over speed
 * @returns {Object} - Route information
 */
async function calculateRoute(startLocation, destination, prioritizeSafety = true) {
  try {
    console.log(`Calculating route from ${JSON.stringify(startLocation)} to ${JSON.stringify(destination)}`);
    console.log(`Prioritizing safety: ${prioritizeSafety}`);
    
    // Get road ratings from database for the area between start and destination
    const bounds = getBoundingBox(startLocation, destination);
    const roadRatings = await getRoadRatings(bounds);
    console.log(`Found ${roadRatings.length} road ratings in the area`);
    
    // Use OSRM API to get road-following routes
    const osrmRoutes = await getOsrmRoutes(startLocation, destination);
    
    if (osrmRoutes && osrmRoutes.length > 0) {
      console.log(`Found ${osrmRoutes.length} routes from OSRM API`);
      
      // Create 2km segments for each route
      const routesWithSegments = osrmRoutes.map(route => {
        // Create segments for this route
        const segments = createRouteSegments(route.route);
        console.log(`Created ${segments.length} segments for route ${route.id}`);
        
        // Apply road ratings to segments
        const ratedSegments = applyRoadRatingsToSegments(segments, roadRatings);
        
        // Calculate safety score based on segment ratings
        const safetyScore = calculateSegmentBasedSafetyScore(ratedSegments);
        
        return {
          ...route,
          segments: ratedSegments,
          safetyScore: safetyScore
        };
      });
      
      // Evaluate routes for safety using user ratings
      const evaluatedRoutes = evaluateRoutes(routesWithSegments, roadRatings, prioritizeSafety);
      
      // Return the best route
      return evaluatedRoutes[0];
    } else {
      console.log('No OSRM routes found, trying GraphHopper');
      
      // Try GraphHopper as a fallback
      try {
        const alternativeRoutes = await getAlternativeRoutes(startLocation, destination);
        
        if (alternativeRoutes && alternativeRoutes.length > 0) {
          console.log(`Found ${alternativeRoutes.length} routes from GraphHopper`);
          
          // Create 2km segments for each route
          const routesWithSegments = alternativeRoutes.map(route => {
            // Create segments for this route
            const segments = createRouteSegments(route.route);
            console.log(`Created ${segments.length} segments for route ${route.id}`);
            
            // Apply road ratings to segments
            const ratedSegments = applyRoadRatingsToSegments(segments, roadRatings);
            
            // Calculate safety score based on segment ratings
            const safetyScore = calculateSegmentBasedSafetyScore(ratedSegments);
            
            return {
              ...route,
              segments: ratedSegments,
              safetyScore: safetyScore
            };
          });
          
          // Evaluate routes for safety using user ratings
          const evaluatedRoutes = evaluateRoutes(routesWithSegments, roadRatings, prioritizeSafety);
          
          // Return the best route
          return evaluatedRoutes[0];
        }
      } catch (graphHopperError) {
        console.error('GraphHopper route fetching failed:', graphHopperError);
      }
      
      console.log('No routes found from external APIs, falling back to simple route');
      return createSimpleRoute(startLocation, destination, roadRatings);
    }
  } catch (error) {
    console.error('Error calculating route:', error);
    // Fallback to simple route in case of error
    return createSimpleRoute(startLocation, destination, []);
  }
}

/**
 * Get routes from OSRM API
 * @param {Object} startLocation - Start location {lat, lng}
 * @param {Object} destination - Destination {lat, lng}
 * @returns {Array} - Array of possible routes
 */
async function getOsrmRoutes(startLocation, destination) {
  try {
    // Use node-fetch for HTTP requests
    const fetch = require('node-fetch');
    
    // Format coordinates for OSRM API
    const coordinates = `${startLocation.lng},${startLocation.lat};${destination.lng},${destination.lat}`;
    
    // OSRM API endpoint (using public demo server)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&alternatives=true&steps=true&geometries=geojson`;
    
    console.log(`Fetching route from OSRM API: ${osrmUrl}`);
    
    const response = await fetch(osrmUrl);
    
    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      console.warn('No routes returned from OSRM API');
      return [];
    }
    
    // Transform OSRM routes to our format
    const routes = data.routes.map((route, index) => {
      // Extract coordinates from the route geometry
      const coordinates = route.geometry.coordinates.map(coord => ({
        lng: coord[0],
        lat: coord[1]
      }));
      
      return {
        id: `osrm-route-${index}`,
        route: coordinates,
        distance: route.distance / 1000, // Convert to km
        duration: route.duration / 60, // Convert to minutes
        source: 'osrm'
      };
    });
    
    console.log(`Transformed ${routes.length} OSRM routes`);
    return routes;
  } catch (error) {
    console.error('Error fetching OSRM routes:', error);
    return [];
  }
}

/**
 * Create a fallback route between two points with safety ratings
 * This attempts to follow roads when possible, but falls back to a simple route if needed
 * @param {Object} startPoint - Starting point {lat, lng}
 * @param {Object} endPoint - Ending point {lat, lng}
 * @param {Array} roadRatings - Array of road ratings to consider
 * @returns {Object} - Route with safety information
 */
async function createSimpleRoute(startPoint, endPoint, roadRatings = []) {
  console.log('Creating fallback route');
  
  // First try to get a route from GraphHopper or OSRM
  try {
    console.log('Attempting to get a route from GraphHopper as fallback');
    const graphHopperService = require('./graphHopperService');
    const ghRoute = await graphHopperService.getRoute(startPoint, endPoint);
    
    if (ghRoute && ghRoute.coordinates && ghRoute.coordinates.length > 5) {
      console.log(`Got a GraphHopper route with ${ghRoute.coordinates.length} points`);
      
      // Create 2km segments for the route
      const segments = createRouteSegments(ghRoute.coordinates);
      
      // Apply road ratings to segments
      const ratedSegments = applyRoadRatingsToSegments(segments, roadRatings);
      
      // Calculate safety score
      const safetyScore = calculateSegmentBasedSafetyScore(ratedSegments);
      
      return {
        route: ghRoute.coordinates,
        segments: ratedSegments,
        distance: ghRoute.distance,
        duration: ghRoute.duration,
        safetyScore,
        source: 'graphhopper-fallback'
      };
    }
  } catch (ghError) {
    console.error('Error getting GraphHopper fallback route:', ghError);
  }
  
  // If GraphHopper fails, try OSRM
  try {
    console.log('Attempting to get a route from OSRM as fallback');
    const osrmService = require('./osrmService');
    let routeData = await osrmService.getRoute(startPoint, endPoint);
    
    if (routeData && routeData.geometry && routeData.geometry.coordinates && routeData.geometry.coordinates.length > 0) {
      console.log('Successfully retrieved route with GeoJSON geometry from OSRM');
      return processRouteWithRatings(routeData, roadRatings, prioritizeSafety);
    }
  } catch (osrmError) {
    console.error('Error getting OSRM fallback route:', osrmError);
  }
  
  // If all else fails, create a simple straight-line route
  console.log('Creating simple straight-line route as last resort');
  
  const numPoints = 20; // Increased number of intermediate points for better segmentation
  const route = [];
  
  route.push(startPoint);
  
  // Create intermediate points in a straight line
  for (let i = 1; i < numPoints - 1; i++) {
    const ratio = i / numPoints;
    const lat = startPoint.lat + (endPoint.lat - startPoint.lat) * ratio;
    const lng = startPoint.lng + (endPoint.lng - startPoint.lng) * ratio;
    route.push({ lat, lng });
  }
  
  route.push(endPoint);
  
  // Calculate distance and duration
  const distance = haversineDistance(startPoint.lat, startPoint.lng, endPoint.lat, endPoint.lng);
  const duration = distance / 50 * 60; // Assuming 50 km/h average speed, convert to minutes
  
  // Create 2km segments for the route
  const segments = createRouteSegments(route);
  
  // Apply road ratings to segments
  const ratedSegments = applyRoadRatingsToSegments(segments, roadRatings);
  
  // Calculate safety score
  const safetyScore = calculateSegmentBasedSafetyScore(ratedSegments);
  
  return {
    id: 'simple-route',
    route,
    segments: ratedSegments,
    distance,
    duration,
    safetyScore,
    source: 'straight-line',
    routeType: 'simple-with-ratings'
  };
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
 * @param {Array} roadRatings - Array of road ratings
 * @param {Boolean} prioritizeSafety - Whether to prioritize safety over speed
 * @returns {Array} - Evaluated routes sorted by combined score
 */
function evaluateRoutes(routes, roadRatings, prioritizeSafety = true) {
  if (!routes || routes.length === 0) {
    return [];
  }
  
  console.log(`Evaluating ${routes.length} routes for safety and speed`);
  
  // Calculate safety score for each route
  const evaluatedRoutes = routes.map(route => {
    // Use the pre-calculated safety score if available, otherwise calculate it
    const safetyScore = route.safetyScore || calculateSafetyScore(route.route, roadRatings);
    
    // Calculate speed score (inverse of duration)
    // Normalize to 0-100 scale where 100 is fastest
    const fastestDuration = Math.min(...routes.map(r => r.duration || 0));
    const speedScore = fastestDuration > 0 ? 
      Math.max(0, 100 - ((route.duration - fastestDuration) / fastestDuration * 100)) : 50;
    
    // Apply segment-based penalties for routes with bad segments
    let segmentPenalty = 0;
    if (route.segments && route.segments.length > 0) {
      // Count bad segments
      const badSegments = route.segments.filter(segment => segment.rating === 'Bad');
      const badSegmentRatio = badSegments.length / route.segments.length;
      
      // Apply a penalty proportional to the percentage of bad segments
      segmentPenalty = badSegmentRatio * 25; // Up to 25 points penalty
      
      console.log(`Route ${route.id || 'unknown'}: ${badSegments.length} bad segments out of ${route.segments.length}, penalty: ${segmentPenalty.toFixed(2)}`);
    }
    
    // Calculate combined score based on priority
    // Adjust weights based on safety priority
    const safetyWeight = prioritizeSafety ? 0.8 : 0.2;
    const speedWeight = prioritizeSafety ? 0.2 : 0.8;
    
    // Calculate final combined score with segment penalty
    const combinedScore = (safetyScore * safetyWeight) + (speedScore * speedWeight) - 
      (prioritizeSafety ? segmentPenalty : segmentPenalty * 0.3);
    
    return {
      ...route,
      safetyScore: Math.round(safetyScore),
      speedScore: Math.round(speedScore),
      combinedScore: Math.round(combinedScore),
      segmentPenalty: Math.round(segmentPenalty),
      weights: { safetyWeight, speedWeight }
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
  
  // Create 2km segments for the route
  const routeSegments = createRouteSegments(coordinates);
  
  if (routeSegments.length === 0) {
    return 85; // Default safety score if segmentation failed
  }
  
  let totalSegments = routeSegments.length;
  let badSegmentsCount = 0;
  let badSegmentsWeight = 0; // Weighted count based on rating severity
  
  // Evaluate each segment for safety
  for (const segment of routeSegments) {
    // Find all ratings that might apply to this segment
    const applicableRatings = findApplicableRatings(segment, roadRatings);
    
    if (applicableRatings.length > 0) {
      // Count bad ratings
      const badRatings = applicableRatings.filter(r => r.rating === 'Bad');
      
      // Calculate bad rating percentage
      const badRatingPercentage = (badRatings.length / applicableRatings.length) * 100;
      
      // If more than 30% of ratings are bad, consider this a bad segment
      if (badRatingPercentage > 30) {
        badSegmentsCount++;
        
        // Apply higher weight for segments with more bad ratings
        const severityWeight = Math.min(2.0, 1.0 + (badRatingPercentage - 30) / 70);
        badSegmentsWeight += severityWeight;
        
        // Update the segment with the rating information
        segment.rating = 'Bad';
        segment.badRatingPercentage = badRatingPercentage;
        segment.severityWeight = severityWeight;
      } else {
        segment.rating = 'Good';
        segment.badRatingPercentage = badRatingPercentage;
      }
    }
  }
  
  // Calculate safety percentage (higher is better)
  // Use weighted count to make routes with severely bad segments less desirable
  const safetyPercentage = 100 - ((badSegmentsWeight / totalSegments) * 100);
  
  // Add the segments to the route data for client-side use
  coordinates.segments = routeSegments;
  
  return Math.max(30, Math.round(safetyPercentage)); // Minimum safety score of 30
}

/**
 * Create route segments of exactly 2 km each for user rating
 * @param {Array} routePoints - Array of coordinates for the route
 * @returns {Array} - Array of route segments
 */
function createRouteSegments(routePoints) {
  if (!routePoints || routePoints.length < 2) {
    console.warn('Not enough points to create route segments');
    return [];
  }
  
  // Validate input points
  const validPoints = routePoints.filter(point => 
    point && typeof point.lat === 'number' && typeof point.lng === 'number'
  );
  
  if (validPoints.length < 2) {
    console.warn('Not enough valid points to create route segments');
    return [];
  }
  
  const segments = [];
  let currentSegmentStart = validPoints[0];
  let currentSegmentDistance = 0;
  let segmentPoints = [currentSegmentStart];
  let segmentId = 0;
  
  // Create a unique ID for each segment based on coordinates
  const createSegmentId = (start, end) => {
    return `segment-${segmentId++}-${start.lat.toFixed(4)}-${start.lng.toFixed(4)}-${end.lat.toFixed(4)}-${end.lng.toFixed(4)}`;
  };
  
  // Calculate total route distance for logging
  let totalRouteDistance = 0;
  for (let i = 1; i < validPoints.length; i++) {
    totalRouteDistance += haversineDistance(
      validPoints[i-1].lat, validPoints[i-1].lng,
      validPoints[i].lat, validPoints[i].lng
    );
  }
  console.log(`Total route distance: ${totalRouteDistance.toFixed(2)} km`);
  
  // Create segments of exactly 2 km each
  for (let i = 1; i < validPoints.length; i++) {
    const point = validPoints[i];
    const prevPoint = validPoints[i-1];
    
    // Calculate distance between this point and the previous one
    const pointDistance = haversineDistance(
      prevPoint.lat, prevPoint.lng,
      point.lat, point.lng
    );
    
    // Add this point to the current segment
    segmentPoints.push(point);
    currentSegmentDistance += pointDistance;
    
    // If we've reached the target segment length (2km) or this is the last point
    if (currentSegmentDistance >= 2 || i === validPoints.length - 1) {
      // If we've exceeded 2km by a significant amount and this isn't the last point,
      // we need to create an interpolated point at exactly 2km
      if (currentSegmentDistance > 2.1 && i < validPoints.length - 1) {
        // Calculate how much we've exceeded 2km
        const excess = currentSegmentDistance - 2.0;
        
        // Remove the last point from the segment
        segmentPoints.pop();
        
        // Calculate the ratio of the distance we need to go back
        const ratio = excess / pointDistance;
        
        // Create an interpolated point at exactly 2km from the start
        const interpolatedPoint = {
          lat: point.lat - (point.lat - prevPoint.lat) * ratio,
          lng: point.lng - (point.lng - prevPoint.lng) * ratio
        };
        
        // Add the interpolated point to the segment
        segmentPoints.push(interpolatedPoint);
        
        // Create the segment with exactly 2km distance
        segments.push({
          id: createSegmentId(currentSegmentStart, interpolatedPoint),
          coordinates: {
            start: currentSegmentStart,
            end: interpolatedPoint
          },
          points: [...segmentPoints],
          distanceKm: 2.0,
          rating: null, // Will store user rating (Good/Bad)
          ratingCount: 0, // Count of ratings
          badRatingCount: 0, // Count of bad ratings
          goodRatingCount: 0 // Count of good ratings
        });
        
        // Start a new segment from the interpolated point
        currentSegmentStart = interpolatedPoint;
        currentSegmentDistance = excess;
        segmentPoints = [currentSegmentStart, point];
      } else {
        // Create a segment with the current distance
        segments.push({
          id: createSegmentId(currentSegmentStart, point),
          coordinates: {
            start: currentSegmentStart,
            end: point
          },
          points: [...segmentPoints],
          distanceKm: parseFloat(currentSegmentDistance.toFixed(2)),
          rating: null, // Will store user rating (Good/Bad)
          ratingCount: 0, // Count of ratings
          badRatingCount: 0, // Count of bad ratings
          goodRatingCount: 0 // Count of good ratings
        });
        
        // Start a new segment
        currentSegmentStart = point;
        currentSegmentDistance = 0;
        segmentPoints = [currentSegmentStart];
      }
    }
  }
  
  console.log(`Created ${segments.length} road segments of ~2km each from ${validPoints.length} points`);
  
  // Validate that all segments have valid coordinates
  const validSegments = segments.filter(segment => 
    segment && 
    segment.coordinates && 
    segment.coordinates.start && 
    segment.coordinates.end &&
    typeof segment.coordinates.start.lat === 'number' &&
    typeof segment.coordinates.start.lng === 'number' &&
    typeof segment.coordinates.end.lat === 'number' &&
    typeof segment.coordinates.end.lng === 'number'
  );
  
  if (validSegments.length !== segments.length) {
    console.warn(`Filtered out ${segments.length - validSegments.length} invalid segments`);
  }
  
  return validSegments;
}

/**
 * Find all road ratings that apply to a route segment
 * @param {Object} segment - The route segment
 * @param {Array} roadRatings - Array of road ratings
 * @returns {Array} - Array of applicable road ratings
 */
function findApplicableRatings(segment, roadRatings) {
  if (!roadRatings || roadRatings.length === 0 || !segment || !segment.coordinates) {
    return [];
  }
  
  // Calculate the bounding box of the segment
  const segmentBounds = {
    north: Math.max(segment.coordinates.start.lat, segment.coordinates.end.lat),
    south: Math.min(segment.coordinates.start.lat, segment.coordinates.end.lat),
    east: Math.max(segment.coordinates.start.lng, segment.coordinates.end.lng),
    west: Math.min(segment.coordinates.start.lng, segment.coordinates.end.lng)
  };
  
  // Add a small buffer around the segment (approximately 500m)
  const bufferDegrees = 0.005; // Roughly 500m at the equator
  segmentBounds.north += bufferDegrees;
  segmentBounds.south -= bufferDegrees;
  segmentBounds.east += bufferDegrees;
  segmentBounds.west -= bufferDegrees;
  
  // Find all ratings that overlap with the segment's bounding box
  const applicableRatings = roadRatings.filter(rating => {
    if (!rating.coordinates || !rating.coordinates.start || !rating.coordinates.end) {
      return false;
    }
    
    // Calculate the bounding box of the rating
    const ratingBounds = {
      north: Math.max(rating.coordinates.start.lat, rating.coordinates.end.lat),
      south: Math.min(rating.coordinates.start.lat, rating.coordinates.end.lat),
      east: Math.max(rating.coordinates.start.lng, rating.coordinates.end.lng),
      west: Math.min(rating.coordinates.start.lng, rating.coordinates.end.lng)
    };
    
    // Check if the bounding boxes overlap
    return !(segmentBounds.south > ratingBounds.north || 
             segmentBounds.north < ratingBounds.south || 
             segmentBounds.west > ratingBounds.east || 
             segmentBounds.east < ratingBounds.west);
  });
  
  return applicableRatings;
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
  
  let minDistance = Infinity;
  let closestRating = null;
  
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

/**
 * Apply road ratings to route segments
 * @param {Array} segments - Array of route segments
 * @param {Array} roadRatings - Array of road ratings
 * @returns {Array} - Array of segments with ratings applied
 */
function applyRoadRatingsToSegments(segments, roadRatings) {
  if (!segments || segments.length === 0 || !roadRatings || roadRatings.length === 0) {
    return segments;
  }
  
  console.log(`Applying ${roadRatings.length} road ratings to ${segments.length} segments`);
  
  return segments.map(segment => {
    // Find applicable ratings for this segment
    const applicableRatings = findApplicableRatings(segment, roadRatings);
    
    if (applicableRatings.length > 0) {
      // Count good and bad ratings
      const badRatings = applicableRatings.filter(r => r.rating === 'Bad');
      const goodRatings = applicableRatings.filter(r => r.rating === 'Good');
      
      // Calculate rating counts
      const ratingCount = applicableRatings.length;
      const badRatingCount = badRatings.length;
      const goodRatingCount = goodRatings.length;
      
      // Determine majority rating
      const majorityRating = badRatingCount > goodRatingCount ? 'Bad' : 'Good';
      
      return {
        ...segment,
        rating: majorityRating,
        ratingCount: ratingCount,
        badRatingCount: badRatingCount,
        goodRatingCount: goodRatingCount
      };
    }
    
    return segment;
  });
}

/**
 * Calculate safety score based on segment ratings
 * @param {Array} segments - Array of route segments with ratings
 * @returns {Number} - Safety score (0-100)
 */
function calculateSegmentBasedSafetyScore(segments) {
  if (!segments || segments.length === 0) {
    return 75; // Default safety score
  }
  
  // Count segments with ratings
  const ratedSegments = segments.filter(s => s.rating !== null);
  
  if (ratedSegments.length === 0) {
    return 75; // Default if no segments have ratings
  }
  
  // Count bad segments
  const badSegments = ratedSegments.filter(s => s.rating === 'Bad');
  
  // Calculate safety score based on percentage of bad segments
  const badSegmentPercentage = (badSegments.length / ratedSegments.length) * 100;
  const safetyScore = Math.max(30, 100 - badSegmentPercentage);
  
  console.log(`Calculated safety score: ${safetyScore.toFixed(2)} based on ${badSegments.length} bad segments out of ${ratedSegments.length} rated segments`);
  
  return parseFloat(safetyScore.toFixed(2));
}

/**
 * Calculate a safe route between two points
 * @param {Object} startPoint - Starting point {lat, lng}
 * @param {Object} destPoint - Destination point {lat, lng}
 * @param {Boolean} prioritizeSafety - Whether to prioritize safety over speed
 * @returns {Object} - Route information with safety score
 */
async function calculateSafeRoute(startPoint, destPoint, prioritizeSafety = true) {
  try {
    console.log(`Calculating safe route from ${JSON.stringify(startPoint)} to ${JSON.stringify(destPoint)}`);
    console.log(`Prioritizing safety: ${prioritizeSafety}`);
    
    // Calculate route
    const route = await calculateRoute(startPoint, destPoint, prioritizeSafety);
    
    return {
      coordinates: route.route,
      segments: route.segments || [],
      distance: route.distance,
      time: route.duration,
      safetyScore: route.safetyScore,
      source: route.source
    };
  } catch (error) {
    console.error('Error calculating safe route:', error);
    throw error;
  }
}

module.exports = {
  calculateSafeRoute,
  createRouteSegments,
  applyRoadRatingsToSegments,
  calculateSegmentBasedSafetyScore
};
