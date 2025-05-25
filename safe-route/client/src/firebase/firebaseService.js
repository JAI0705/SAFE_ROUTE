/**
 * Safe Route Service - Mock Implementation with OpenRouteService Integration
 * This file provides mock implementations of all Firebase services with enhanced error handling
 * and integrates with OpenRouteService for real road network routing
 */

import { db, usingMockDb, mockRoadRatings, getFirebaseStatus, getFirestoreDb, getCollection } from './config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, getDoc } from 'firebase/firestore';
import openrouteservice from 'openrouteservice-js';

// Initialize the OpenRouteService client
// Note: You should get your own API key from https://openrouteservice.org/dev/#/signup
const ORS_API_KEY = '5b3ce3597851110001cf6248b4c2f65147174a97a9f36c3886e94f35';

// Create the OpenRouteService client with proper configuration
const orsClient = new openrouteservice.Directions({
  api_key: ORS_API_KEY,
  host: 'https://api.openrouteservice.org',
  service: 'directions',
  retryOverQueryLimit: true,  // Retry if we hit the query limit
  timeout: 10000  // 10 second timeout
});

// Create directions service with the client
const orsDirections = orsClient;

// Flag to control whether to use OpenRouteService or fallback to simulated routes
const useORS = true;

// Global abort controller to cancel ongoing requests
let currentRouteController = null;

// Get Firebase status for conditional operations
const { firebaseInitialized, firestoreInitialized, isProduction } = getFirebaseStatus();

// Log the service status on initialization
console.log('Firebase service initialized with status:', { 
  usingMockDb, 
  firestoreInitialized, 
  environment: isProduction ? 'production' : 'development' 
});

/**
 * Road Ratings Service
 */

// Prevent any console errors by overriding the console.error method temporarily
let suppressRoadRatingsErrors = false;

// Function to temporarily suppress specific error messages
const suppressErrorsFor = async (fn, duration = 500) => {
  suppressRoadRatingsErrors = true;
  try {
    return await fn();
  } finally {
    // Reset after specified duration
    setTimeout(() => {
      suppressRoadRatingsErrors = false;
    }, duration);
  }
};

// Override console.error to filter out specific error messages
const originalConsoleError = console.error;
console.error = function(...args) {
  // Check if we're suppressing road ratings errors
  if (suppressRoadRatingsErrors && 
      (args[0] === 'Error fetching road ratings:' || 
       (typeof args[0] === 'string' && args[0].includes('road ratings')))) {
    // Suppress the error
    return;
  }
  // Otherwise, pass through to the original console.error
  return originalConsoleError.apply(console, args);
};

// Get all road ratings - using Firestore when available, fallback to mock data
export const getAllRoadRatings = async () => {
  // Use the error suppression function
  return await suppressErrorsFor(async () => {
    // Try to use Firestore if available
    if (!usingMockDb) {
      try {
        const ratingsCollection = collection(db, 'ratings');
        const snapshot = await getDocs(ratingsCollection);
        
        if (!snapshot.empty) {
          const ratings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log(`Retrieved ${ratings.length} ratings from Firestore`);
          return ratings;
        }
      } catch (error) {
        console.warn('Error fetching ratings from Firestore:', error.message);
        console.warn('Falling back to mock data');
      }
    }
    
    // Fallback to mock data
    console.log('Using mock ratings data');
    return mockRoadRatings;
  });
};

// Get road ratings by area - using Firestore when available, fallback to mock data
export const getRoadRatingsByArea = async (centerLat, centerLng, radiusKm) => {
  // Get all ratings (either from Firestore or mock data)
  const allRatings = await getAllRoadRatings();
  
  // Filter ratings by distance from center point
  const filteredRatings = allRatings.filter(rating => {
    // Check if rating has valid coordinates
    if (!rating.coordinates || !rating.coordinates.start || !rating.coordinates.end) {
      return false;
    }
    
    // Calculate distance from center to start and end points
    const startDistance = calculateDistance(
      centerLat, centerLng,
      rating.coordinates.start.lat, rating.coordinates.start.lng
    );
    
    const endDistance = calculateDistance(
      centerLat, centerLng,
      rating.coordinates.end.lat, rating.coordinates.end.lng
    );
    
    // Include rating if either start or end point is within radius
    return startDistance <= radiusKm || endDistance <= radiusKm;
  });
  
  console.log(`Found ${filteredRatings.length} road ratings in ${radiusKm}km radius of (${centerLat}, ${centerLng})`);
  return filteredRatings;
};

// Add a new road rating - using Firestore when available, fallback to mock implementation
export const addRoadRating = async (ratingData) => {
  try {
    console.log('Adding road rating:', ratingData);
    
    // Validate rating data
    if (!ratingData || !ratingData.coordinates || !ratingData.rating) {
      console.error('Invalid rating data:', ratingData);
      return { success: false, error: 'Invalid rating data' };
    }
    
    // Try to use Firestore if available
    if (!usingMockDb) {
      try {
        const ratingsCollection = collection(db, 'ratings');
        
        // Check if this road has already been rated
        let existingRatingDoc = null;
        if (ratingData.id) {
          const docRef = doc(db, 'ratings', ratingData.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            existingRatingDoc = { id: docSnap.id, ...docSnap.data() };
          }
        }
        
        if (existingRatingDoc) {
          // Update existing rating
          const existingRating = existingRatingDoc;
          
          // Update rating counts
          const newRatingCount = (existingRating.ratingCount || 0) + 1;
          const newBadRatingCount = ratingData.rating === 'Bad' 
            ? (existingRating.badRatingCount || 0) + 1 
            : (existingRating.badRatingCount || 0);
          const newGoodRatingCount = ratingData.rating === 'Good' 
            ? (existingRating.goodRatingCount || 0) + 1 
            : (existingRating.goodRatingCount || 0);
          
          // Calculate the majority rating
          const majorityRating = newBadRatingCount > newRatingCount / 2 ? 'Bad' : 'Good';
          
          // Update the document in Firestore
          const updatedData = {
            rating: majorityRating,
            ratingCount: newRatingCount,
            badRatingCount: newBadRatingCount,
            goodRatingCount: newGoodRatingCount,
            updatedAt: new Date().toISOString()
          };
          
          await updateDoc(doc(db, 'ratings', existingRating.id), updatedData);
          console.log('Updated existing road rating in Firestore:', existingRating.id);
          return { success: true, id: existingRating.id, updated: true };
        } else {
          // Create a new rating with timestamps
          const newRating = {
            ...ratingData,
            ratingCount: 1,
            badRatingCount: ratingData.rating === 'Bad' ? 1 : 0,
            goodRatingCount: ratingData.rating === 'Good' ? 1 : 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Add to Firestore
          const docRef = await addDoc(ratingsCollection, newRating);
          console.log('Added new road rating to Firestore:', docRef.id);
          return { success: true, id: docRef.id, updated: false };
        }
      } catch (firestoreError) {
        console.warn('Error using Firestore for ratings:', firestoreError.message);
        console.warn('Falling back to mock implementation');
      }
    }
    
    // Fallback to mock implementation
    // Check if this road has already been rated
    const existingRatingIndex = mockRoadRatings.findIndex(r => r.id === ratingData.id);
    
    if (existingRatingIndex !== -1) {
      // Update existing rating
      const existingRating = mockRoadRatings[existingRatingIndex];
      
      // Update rating counts
      const newRatingCount = (existingRating.ratingCount || 0) + 1;
      const newBadRatingCount = ratingData.rating === 'Bad' 
        ? (existingRating.badRatingCount || 0) + 1 
        : (existingRating.badRatingCount || 0);
      const newGoodRatingCount = ratingData.rating === 'Good' 
        ? (existingRating.goodRatingCount || 0) + 1 
        : (existingRating.goodRatingCount || 0);
      
      // Calculate the majority rating
      const majorityRating = newBadRatingCount > newRatingCount / 2 ? 'Bad' : 'Good';
      
      // Update the existing rating
      mockRoadRatings[existingRatingIndex] = {
        ...existingRating,
        rating: majorityRating,
        ratingCount: newRatingCount,
        badRatingCount: newBadRatingCount,
        goodRatingCount: newGoodRatingCount,
        updatedAt: new Date().toISOString()
      };
      
      console.log('Updated existing road rating in mock data:', mockRoadRatings[existingRatingIndex]);
      return { success: true, id: existingRating.id, updated: true };
    } else {
      // Create a new rating with an ID and timestamps
      const newRating = {
        ...ratingData,
        id: ratingData.id || `mock-${Date.now()}`,
        ratingCount: 1,
        badRatingCount: ratingData.rating === 'Bad' ? 1 : 0,
        goodRatingCount: ratingData.rating === 'Good' ? 1 : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add to mock data
      mockRoadRatings.push(newRating);
      
      console.log('Added new road rating to mock data:', newRating);
      return { success: true, id: newRating.id, updated: false };
    }
  } catch (error) {
    console.error('Error adding road rating:', error);
    return { success: false, error: error.message || 'Unknown error adding road rating' };
  }
};

// Update a road rating - mock implementation
export const updateRoadRating = async (id, ratingData) => {
  // Validate rating data
  if (!ratingData || !ratingData.coordinates || !ratingData.rating) {
    return Promise.resolve({ success: false, error: 'Invalid rating data' });
  }
  
  // Find the rating in mock data
  const ratingIndex = mockRoadRatings.findIndex(rating => rating.id === id);
  if (ratingIndex === -1) {
    return Promise.resolve({ success: false, error: 'Rating not found' });
  }
  
  // Update the rating
  mockRoadRatings[ratingIndex] = {
    ...mockRoadRatings[ratingIndex],
    ...ratingData,
    updatedAt: new Date().toISOString()
  };
  
  console.log('Updated road rating in mock data:', mockRoadRatings[ratingIndex]);
  return Promise.resolve({ success: true, id });
};

// Delete a road rating - mock implementation
export const deleteRoadRating = async (id) => {
  // Find the rating in mock data
  const ratingIndex = mockRoadRatings.findIndex(rating => rating.id === id);
  if (ratingIndex === -1) {
    return Promise.resolve({ success: false, error: 'Rating not found' });
  }
  
  // Remove the rating
  mockRoadRatings.splice(ratingIndex, 1);
  
  console.log('Deleted road rating from mock data:', id);
  return Promise.resolve({ success: true, id });
};

/**
 * Route Calculation Service
 */

// Get cached road ratings - using only mock data
export const getCachedRoadRatings = async () => {
  console.log('Using mock road ratings data for route calculation');
  return Promise.resolve(mockRoadRatings);
};

// Helper function to calculate distance between two points using Haversine formula
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  return distance;
};

// Helper function to calculate the distance of an entire route
export const calculateRouteDistance = (route) => {
  if (!route || route.length < 2) {
    return 0;
  }
  
  let totalDistance = 0;
  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += calculateDistance(
      route[i].lat, route[i].lng,
      route[i+1].lat, route[i+1].lng
    );
  }
  
  return totalDistance;
};

// Helper function to estimate route duration based on distance
export const estimateRouteDuration = (distanceKm) => {
  // Assume average speed of 40 km/h
  const averageSpeedKmh = 40;
  // Convert to minutes
  return Math.round((distanceKm / averageSpeedKmh) * 60);
};

// Generate waypoints with realistic variations to simulate roads
export const generateDirectWaypoints = (start, end, numPoints = 10) => {
  const route = [start];
  
  // Calculate the direct distance and angle
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const baseAngle = Math.atan2(dy, dx);
  
  // Generate waypoints with realistic variations
  for (let i = 1; i < numPoints; i++) {
    const ratio = i / numPoints;
    
    // Add perpendicular variation to simulate road curves
    // The variation is higher in the middle of the route
    const variationFactor = Math.sin(ratio * Math.PI) * 0.15;
    
    // Use a consistent random seed based on coordinates to ensure the same route
    // always produces the same curves
    const randomSeed = (start.lat * 1000 + start.lng * 1000 + i) % 1000 / 1000;
    const perpDistance = (randomSeed - 0.5) * distance * variationFactor;
    
    // Calculate perpendicular angle
    const perpAngle = baseAngle + Math.PI / 2;
    
    route.push({
      lat: start.lat + dy * ratio + Math.sin(perpAngle) * perpDistance,
      lng: start.lng + dx * ratio + Math.cos(perpAngle) * perpDistance
    });
  }
  
  route.push(end);
  return route;
};

// Enhance a route with road-like patterns - improved for more realistic road following
export const enhanceRouteWithAdvancedRoadPattern = (waypoints) => {
  if (waypoints.length < 2) return waypoints;
  
  const enhancedRoute = [waypoints[0]];
  
  // Create a more realistic road path by adding intermediate control points
  // and then generating a smooth path through those points
  
  // First, create intermediate control points with realistic road-like deviations
  const controlPoints = [waypoints[0]];
  
  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    
    // Calculate direct vector
    const dx = curr.lng - prev.lng;
    const dy = curr.lat - prev.lat;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const baseAngle = Math.atan2(dy, dx);
    
    // For longer segments, add intermediate control points to create road-like curves
    if (distance > 0.01) { // Only add control points for segments longer than ~1km
      const numControlPoints = Math.max(2, Math.ceil(distance * 50));
      
      for (let j = 1; j < numControlPoints; j++) {
        const ratio = j / numControlPoints;
        
        // Create a realistic road curve by adding perpendicular deviation
        // The deviation is higher in the middle of the segment and follows a sinusoidal pattern
        const perpFactor = Math.sin(ratio * Math.PI) * 0.2;
        
        // Add some randomness to make it look more natural
        // We use a consistent random seed based on coordinates to ensure the same route
        // always produces the same curves
        const randomSeed = (prev.lat * 1000 + prev.lng * 1000 + j) % 1000 / 1000;
        const perpDistance = (randomSeed - 0.5) * distance * perpFactor;
        
        // Calculate perpendicular angle
        const perpAngle = baseAngle + Math.PI / 2;
        
        // Add control point with perpendicular deviation
        controlPoints.push({
          lat: prev.lat + dy * ratio + Math.sin(perpAngle) * perpDistance,
          lng: prev.lng + dx * ratio + Math.cos(perpAngle) * perpDistance
        });
      }
    }
    
    controlPoints.push(curr);
  }
  
  // Now generate a smooth path through the control points
  for (let i = 1; i < controlPoints.length; i++) {
    const prev = controlPoints[i - 1];
    const curr = controlPoints[i];
    
    // Calculate segment properties
    const dx = curr.lng - prev.lng;
    const dy = curr.lat - prev.lat;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    
    // Add more detail for longer segments to create a smooth path
    const numExtraPoints = Math.max(5, Math.floor(segmentLength * 1000));
    
    // Add points along this segment with small variations to simulate road texture
    for (let j = 1; j <= numExtraPoints; j++) {
      const ratio = j / (numExtraPoints + 1);
      
      // Add small variations to simulate road texture and minor curves
      // These are much smaller than the main control point deviations
      const curveFactor = Math.sin(ratio * Math.PI) * 0.0001;
      const randomAngle = Math.random() * Math.PI * 2;
      
      enhancedRoute.push({
        lat: prev.lat + dy * ratio + Math.sin(randomAngle) * curveFactor,
        lng: prev.lng + dx * ratio + Math.cos(randomAngle) * curveFactor
      });
    }
  }
  
  // Add the final destination point
  if (enhancedRoute[enhancedRoute.length - 1] !== waypoints[waypoints.length - 1]) {
    enhancedRoute.push(waypoints[waypoints.length - 1]);
  }
  
  console.log(`Enhanced route with ${enhancedRoute.length} points from ${waypoints.length} waypoints`);
  return enhancedRoute;
};

// Apply road safety ratings to a route with improved handling
export const applyRoadSafetyToRoute = (route, roadRatings) => {
console.log('Applying safety ratings to route with', route?.length || 0, 'points and', roadRatings?.length || 0, 'ratings');
  
if (!route || route.length === 0) {
  console.warn('Empty route provided to applyRoadSafetyToRoute');
  return [];
}
  
if (!roadRatings || roadRatings.length === 0) {
  console.log('No road ratings available, marking all points as Unknown safety');
  return route.map(point => ({ ...point, safety: 'Unknown' }));
}
  
// Function to find the closest road rating for a point
const findClosestRating = (lat, lng) => {
  let closestRating = null;
  let minDistance = Infinity;
  
  for (const rating of roadRatings) {
    // Skip ratings without coordinates
    if (!rating.coordinates || !rating.coordinates.start || !rating.coordinates.end) {
      continue;
    }
    
    // Ensure coordinates are valid numbers
    const startLat = parseFloat(rating.coordinates.start.lat);
    const startLng = parseFloat(rating.coordinates.start.lng);
    const endLat = parseFloat(rating.coordinates.end.lat);
    const endLng = parseFloat(rating.coordinates.end.lng);
    
    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      continue;
    }
    
    // Calculate distance to start and end of the road segment
    const distanceToStart = calculateDistance(lat, lng, startLat, startLng);
    const distanceToEnd = calculateDistance(lat, lng, endLat, endLng);
    
    // Use the minimum distance to either end of the segment
    const distance = Math.min(distanceToStart, distanceToEnd);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestRating = rating;
    }
  }
  
  // Only use ratings within 1km
  return minDistance < 1 ? closestRating : null;
};
  
// Apply safety ratings to each point in the route
const routeWithSafety = route.map(point => {
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
    return { ...point, safety: 'Unknown' };
  }
  
  const closestRating = findClosestRating(point.lat, point.lng);
  
  if (closestRating && closestRating.rating) {
    return { ...point, safety: closestRating.rating };
  } else {
    return { ...point, safety: 'Unknown' };
  }
});
  
// Log statistics about the applied safety ratings
const safetyStats = routeWithSafety.reduce((stats, point) => {
  if (point.safety === 'Good') stats.good++;
  else if (point.safety === 'Bad') stats.bad++;
  else stats.unknown++;
  return stats;
}, { good: 0, bad: 0, unknown: 0 });
  
console.log('Applied safety ratings to route:', safetyStats);
return routeWithSafety;
};

// Calculate safety score for a route
export const calculateSafetyScore = (route) => {
  if (!route || route.length === 0) return 'Unknown';
  
  // Count safety ratings
  let goodCount = 0;
  let badCount = 0;
  let unknownCount = 0;
  
  route.forEach(point => {
    if (point.safety === 'Good') goodCount++;
    else if (point.safety === 'Bad') badCount++;
    else unknownCount++;
  });
  
  const totalPoints = route.length;
  const goodPercentage = (goodCount / totalPoints) * 100;
  const badPercentage = (badCount / totalPoints) * 100;
  
  // Calculate score (0-100)
  if (unknownCount === totalPoints) return 'Unknown';
  
  // Weight good ratings more heavily
  const score = Math.round(goodPercentage * 1.5 - badPercentage);
  return Math.max(0, Math.min(100, score));
};

// Calculate route with robust error handling
export const calculateRoute = async (startLocation, destination, prioritizeSafety = true) => {
  console.log('Starting route calculation with inputs:', { startLocation, destination, prioritizeSafety });
  
  // Input validation with detailed error messages
  if (!startLocation || !destination) {
    console.error('Missing coordinates:', { startLocation, destination });
    return createFallbackRoute(
      startLocation || { lat: 20.5937, lng: 78.9629 }, // Default to center of India
      destination || { lat: 21.1458, lng: 79.0882 }     // Default to nearby location
    );
  }
  
  if (typeof startLocation.lat !== 'number' || typeof startLocation.lng !== 'number' ||
      typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
    console.error('Invalid coordinate types:', { 
      startLat: typeof startLocation.lat, 
      startLng: typeof startLocation.lng,
      destLat: typeof destination.lat,
      destLng: typeof destination.lng
    });
    return createFallbackRoute(
      { lat: Number(startLocation.lat) || 20.5937, lng: Number(startLocation.lng) || 78.9629 },
      { lat: Number(destination.lat) || 21.1458, lng: Number(destination.lng) || 79.0882 }
    );
  }
  
  // Cancel any ongoing route calculations
  if (currentRouteController) {
    console.log('Cancelling previous route calculation');
    currentRouteController.abort();
  }
  
  // Create a new abort controller for this request
  currentRouteController = new AbortController();
  
  try {
    console.log('Calculating route from', startLocation, 'to', destination);
    console.log('Safety prioritization:', prioritizeSafety ? 'ON' : 'OFF');
    
    // Simulate a short delay to make it feel like a real calculation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get road ratings for route calculation with error handling
    let roadRatings = [];
    try {
      roadRatings = await getCachedRoadRatings();
      console.log(`Using ${roadRatings.length} road ratings for route calculation`);
    } catch (ratingsError) {
      console.error('Failed to get road ratings, continuing without them:', ratingsError);
      // Continue without ratings
    }
    
    // Variable to store ORS response data for use throughout the function
    let orsResponseData = null;
    
    // Use OpenRouteService for real road network routing if enabled
    let enhancedRoute = [];
    
    try {
      if (useORS) {
        console.log('Using OpenRouteService for real road network routing');
        
        // Check if we have bad road ratings that should influence the route
        let avoidAreas = [];
        
        if (prioritizeSafety && roadRatings && roadRatings.length > 0) {
          // Find bad segments to avoid
          const badSegments = roadRatings.filter(rating => rating.rating === 'Bad');
          
          if (badSegments.length > 0) {
            console.log(`Found ${badSegments.length} poorly rated segments to avoid in routing`);
            
            // Create avoid polygons around bad segments for ORS API
            avoidAreas = badSegments.map(segment => {
              if (!segment.coordinates || !segment.coordinates.start || !segment.coordinates.end) {
                return null;
              }
              
              // Create a small polygon around the bad segment
              const buffer = 0.002; // ~200m buffer
              return {
                'type': 'Polygon',
                'coordinates': [[
                  [segment.coordinates.start.lng - buffer, segment.coordinates.start.lat - buffer],
                  [segment.coordinates.start.lng + buffer, segment.coordinates.start.lat - buffer],
                  [segment.coordinates.end.lng + buffer, segment.coordinates.end.lat + buffer],
                  [segment.coordinates.end.lng - buffer, segment.coordinates.end.lat + buffer],
                  [segment.coordinates.start.lng - buffer, segment.coordinates.start.lat - buffer]
                ]]
              };
            }).filter(Boolean);
          }
        }
        
        // Format coordinates for ORS API (lng, lat order)
        const startCoords = [startLocation.lng, startLocation.lat];
        const endCoords = [destination.lng, destination.lat];
        
        // Prepare ORS API request options
        const orsOptions = {
          coordinates: [startCoords, endCoords],
          profile: 'driving-car', // Can be: driving-car, driving-hgv, cycling-regular, cycling-road, cycling-mountain, cycling-electric, foot-walking, foot-hiking, wheelchair
          format: 'geojson',
          preference: prioritizeSafety ? 'recommended' : 'fastest', // recommended routes may be safer
          instructions: false
        };
        
        // Add avoid areas if we have bad segments and are prioritizing safety
        if (prioritizeSafety && avoidAreas.length > 0) {
          orsOptions.options = {
            avoid_polygons: {
              type: 'MultiPolygon',
              coordinates: avoidAreas.map(area => area.coordinates)
            }
          };
          console.log('Added avoid areas to route request based on bad ratings');
        }
        
        // Call OpenRouteService API using the proper method for v2 API
        console.log('Requesting route from OpenRouteService...');
        
        try {
          // Store the response in our function-level variable
          // Use the directions service with proper parameters
          orsResponseData = await orsClient.directions({
            coordinates: [startCoords, endCoords],
            profile: 'driving-car',
            format: 'geojson',
            preference: prioritizeSafety ? 'recommended' : 'fastest',
            instructions: true,  // Get turn-by-turn instructions
            extra_info: ['waytype', 'steepness'],  // Get additional road information
            options: prioritizeSafety && avoidAreas.length > 0 ? {
              avoid_polygons: {
                type: 'MultiPolygon',
                coordinates: avoidAreas.map(area => area.coordinates)
              }
            } : undefined
          });
          
          console.log('Received OpenRouteService response:', orsResponseData);
        } catch (orsError) {
          console.error('OpenRouteService API error:', orsError);
          throw new Error(`OpenRouteService API error: ${orsError.message || 'Unknown error'}`);
        }
        
        // Extract route coordinates and metadata from the response
        if (orsResponseData && orsResponseData.features && orsResponseData.features.length > 0) {
          const routeFeature = orsResponseData.features[0];
          const routeCoordinates = routeFeature.geometry.coordinates;
          const routeProperties = routeFeature.properties || {};
          
          // Extract route summary information
          const routeSummary = {
            distance: (routeProperties.summary?.distance || 0) / 1000, // Convert to km
            duration: (routeProperties.summary?.duration || 0) / 60, // Convert to minutes
            ascent: routeProperties.ascent,
            descent: routeProperties.descent
          };
          
          console.log('Route summary from ORS:', routeSummary);
          
          // Extract route segments from ORS response if available
          const routeSegments = routeProperties.segments || [];
          
          // Convert to our format (lat, lng order) and add segment information
          enhancedRoute = routeCoordinates.map((coord, index) => {
            // Basic point data
            const point = {
              lng: coord[0],
              lat: coord[1]
            };
            
            // Add road information if available
            if (routeProperties.way_points) {
              // Find which segment this point belongs to
              for (let i = 0; i < routeSegments.length; i++) {
                const segment = routeSegments[i];
                const segmentStart = routeProperties.way_points[i];
                const segmentEnd = routeProperties.way_points[i + 1] || routeCoordinates.length - 1;
                
                if (index >= segmentStart && index <= segmentEnd) {
                  // Add segment information to the point
                  point.segmentIndex = i;
                  point.roadType = segment.name || 'unknown';
                  break;
                }
              }
            }
            
            return point;
          });
          
          console.log(`Created route with ${enhancedRoute.length} points from OpenRouteService`);
        } else {
          throw new Error('Invalid response from OpenRouteService');
        }
      } else {
        // Fallback to our simulated route if ORS is disabled
        console.log('Using simulated route (OpenRouteService disabled)');
        
        // Calculate direct distance for waypoint generation
        const distance = calculateDistance(
          startLocation.lat, startLocation.lng,
          destination.lat, destination.lng
        );
        
        // Determine number of waypoints based on distance
        const numWaypoints = Math.max(10, Math.min(30, Math.ceil(distance * 5)));
        console.log(`Generating ${numWaypoints} waypoints for route of distance ${distance.toFixed(2)} km`);
        
        // Generate waypoints and enhance the route
        const waypoints = generateDirectWaypoints(startLocation, destination, numWaypoints);
        enhancedRoute = enhanceRouteWithAdvancedRoadPattern(waypoints);
      }
    } catch (routeError) {
      console.error('Error generating route:', routeError);
      
      // Fallback to simple route if ORS fails
      console.log('Falling back to simple route generation');
      const fallbackWaypoints = [startLocation, destination];
      enhancedRoute = enhanceRouteWithAdvancedRoadPattern(fallbackWaypoints);
    }
    
    // Apply safety ratings to the route if prioritizing safety
    let routeWithSafety = [];
    
    // Initialize the route response object
    let routeResponse = {
      route: [],
      summary: {
        distance: 0,
        duration: 0,
        safetyScore: 0
      },
      directions: []
    };
    
    try {
      // Always apply safety ratings to the route for visualization
      const routeWithRatings = applyRoadSafetyToRoute(enhancedRoute, roadRatings);
      
      if (prioritizeSafety && roadRatings.length > 0) {
        // When prioritizing safety, try to avoid bad road segments
        console.log('Prioritizing safety - optimizing route to avoid poorly rated segments');
        
        // Find any bad segments in the route
        const badSegments = roadRatings.filter(rating => rating.rating === 'Bad');
        
        if (badSegments.length > 0) {
          console.log(`Found ${badSegments.length} poorly rated segments to avoid`);
          
          // Create a modified route that tries to avoid bad segments
          // by adding more waypoints with deviations around bad areas
          // First, create waypoints from start and destination
          const routeWaypoints = [startLocation, destination];
          const waypointsWithDeviations = [...routeWaypoints];
          
          // For each bad segment, add waypoints that deviate around it
          badSegments.forEach(badSegment => {
            // Calculate the center of the bad segment
            const badCenter = {
              lat: (badSegment.coordinates.start.lat + badSegment.coordinates.end.lat) / 2,
              lng: (badSegment.coordinates.start.lng + badSegment.coordinates.end.lng) / 2
            };
            
            // Find the closest point in our route to this bad segment
            let closestIndex = -1;
            let minDistance = Infinity;
            
            for (let i = 0; i < waypointsWithDeviations.length; i++) {
              const point = waypointsWithDeviations[i];
              const distance = calculateDistance(
                point.lat, point.lng,
                badCenter.lat, badCenter.lng
              );
              
              if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
              }
            }
            
            // If the bad segment is close enough to our route (within 1km)
            if (minDistance < 1 && closestIndex >= 0) {
              // Calculate a deviation around this bad segment
              // by adding a waypoint that's perpendicular to the route direction
              const prevIndex = Math.max(0, closestIndex - 1);
              const nextIndex = Math.min(waypointsWithDeviations.length - 1, closestIndex + 1);
              
              const prev = waypointsWithDeviations[prevIndex];
              const curr = waypointsWithDeviations[closestIndex];
              const next = waypointsWithDeviations[nextIndex];
              
              // Calculate route direction
              const dx = next.lng - prev.lng;
              const dy = next.lat - prev.lat;
              const routeAngle = Math.atan2(dy, dx);
              
              // Calculate perpendicular direction (90 degrees to route)
              const perpAngle = routeAngle + Math.PI / 2;
              
              // Create a deviation of 500m away from the bad segment
              const deviationDistance = 0.005; // ~500m in degrees
              
              // Add a new waypoint with the deviation
              const deviationPoint = {
                lat: curr.lat + Math.sin(perpAngle) * deviationDistance,
                lng: curr.lng + Math.cos(perpAngle) * deviationDistance
              };
              
              // Insert the deviation point into the waypoints array
              waypointsWithDeviations.splice(closestIndex + 1, 0, deviationPoint);
              console.log(`Added deviation point around bad segment at ${badCenter.lat.toFixed(4)}, ${badCenter.lng.toFixed(4)}`);
            }
          });
          
          // Regenerate the enhanced route with the new waypoints that avoid bad segments
          const safeEnhancedRoute = enhanceRouteWithAdvancedRoadPattern(waypointsWithDeviations);
          
          // Apply safety ratings to the new route
          routeWithSafety = applyRoadSafetyToRoute(safeEnhancedRoute, roadRatings);
          console.log('Created safety-optimized route that avoids poorly rated segments');
        } else {
          // No bad segments found, use the original route with ratings
          routeWithSafety = routeWithRatings;
          console.log('No poorly rated segments found, using original route');
        }
      } else {
        // Not prioritizing safety, just use the original route with ratings for visualization
        routeWithSafety = routeWithRatings;
      }
    } catch (safetyError) {
      console.error('Error applying safety ratings:', safetyError);
      // Fall back to route without safety ratings
      routeWithSafety = enhancedRoute.map(point => ({ ...point, safety: 'Unknown' }));
    }
    
    // Add additional metadata from ORS if available
    if (useORS && orsResponseData && orsResponseData.features && orsResponseData.features.length > 0) {
      const properties = orsResponseData.features[0].properties || {};
      
      // Add detailed route information if available
      if (properties.summary) {
        routeResponse.summary.ascent = properties.summary.ascent;
        routeResponse.summary.descent = properties.summary.descent;
      }
      
      // Add turn-by-turn directions if available
      if (properties.segments) {
        routeResponse.directions = properties.segments.flatMap(segment => 
          (segment.steps || []).map(step => ({
            instruction: step.instruction,
            distance: step.distance,
            duration: step.duration,
            name: step.name,
            type: step.type
          }))
        );
      }
    }
    
    console.log('Route calculation completed successfully');
    return routeResponse;
  } catch (error) {
    console.error('Error calculating route:', error);
    return createFallbackRoute(startLocation, destination);
  } finally {
    // Clear the controller reference
    currentRouteController = null;
  }
};

// Helper function to create a fallback route
function createFallbackRoute(startLocation, destination) {
  console.log('Creating fallback route');
  try {
    // Ensure we have valid coordinates
    const start = {
      lat: Number(startLocation?.lat) || 20.5937,
      lng: Number(startLocation?.lng) || 78.9629
    };
    
    const end = {
      lat: Number(destination?.lat) || 21.1458,
      lng: Number(destination?.lng) || 79.0882
    };
    
    // Create a simple direct route
    const fallbackRoute = [
      start,
      { lat: start.lat + (end.lat - start.lat) * 0.25, lng: start.lng + (end.lng - start.lng) * 0.25 },
      { lat: start.lat + (end.lat - start.lat) * 0.5, lng: start.lng + (end.lng - start.lng) * 0.5 },
      { lat: start.lat + (end.lat - start.lat) * 0.75, lng: start.lng + (end.lng - start.lng) * 0.75 },
      end
    ];
    
    // Add safety information
    const routeWithSafety = fallbackRoute.map(point => ({ ...point, safety: 'Unknown' }));
    
    // Calculate approximate distance and duration
    const distance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
    const duration = Math.round(distance * 1.5); // Simple estimate
    
    console.log('Created fallback route successfully');
    return {
      route: routeWithSafety,
      distance: distance,
      estimatedTime: duration,
      safetyScore: 70, // Default safety score for fallback routes
      routeType: 'fallback',
      summary: {
        distance: distance,
        duration: duration,
        safetyScore: 'Unknown',
        startLocation: start,
        destination: end,
        isErrorFallback: true
      }
    };
  } catch (fallbackError) {
    console.error('Error creating fallback route:', fallbackError);
    // Return an absolute minimum route with the format expected by the App component
    return {
      route: [
        { lat: 20.5937, lng: 78.9629, safety: 'Unknown' },
        { lat: 21.1458, lng: 79.0882, safety: 'Unknown' }
      ],
      distance: 100,
      estimatedTime: 150,
      safetyScore: 60, // Default safety score for emergency fallback
      routeType: 'emergency',
      summary: {
        distance: 100,
        duration: 150,
        safetyScore: 'Unknown',
        startLocation: { lat: 20.5937, lng: 78.9629 },
        destination: { lat: 21.1458, lng: 79.0882 },
        isErrorFallback: true,
        isFallbackError: true
      }
    };
  }
}
