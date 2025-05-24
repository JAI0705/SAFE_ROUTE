import { db, auth } from './config';
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { mockRouteData } from '../mockData';

/**
 * Road Ratings Service
 */

// Get all road ratings
export const getAllRoadRatings = async () => {
  try {
    const ratingsRef = collection(db, 'roadRatings');
    const snapshot = await getDocs(ratingsRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching road ratings:', error);
    return [];
  }
};

// Get road ratings by area
export const getRoadRatingsByArea = async (area) => {
  try {
    const ratingsRef = collection(db, 'roadRatings');
    const q = query(ratingsRef, where('area', '==', area));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching road ratings by area:', error);
    return [];
  }
};

// Add a new road rating
export const addRoadRating = async (ratingData) => {
  try {
    const ratingsRef = collection(db, 'roadRatings');
    const newRating = {
      ...ratingData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(ratingsRef, newRating);
    return {
      id: docRef.id,
      ...newRating
    };
  } catch (error) {
    console.error('Error adding road rating:', error);
    throw error;
  }
};

// Update a road rating
export const updateRoadRating = async (id, ratingData) => {
  try {
    const ratingRef = doc(db, 'roadRatings', id);
    const updatedRating = {
      ...ratingData,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(ratingRef, updatedRating);
    return {
      id,
      ...updatedRating
    };
  } catch (error) {
    console.error('Error updating road rating:', error);
    throw error;
  }
};

// Delete a road rating
export const deleteRoadRating = async (id) => {
  try {
    const ratingRef = doc(db, 'roadRatings', id);
    await deleteDoc(ratingRef);
    return { id };
  } catch (error) {
    console.error('Error deleting road rating:', error);
    throw error;
  }
};

/**
 * Route Calculation Service
 */

// Cache for road ratings to reduce Firestore reads
let roadRatingsCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get road ratings with caching
const getCachedRoadRatings = async () => {
  const now = Date.now();
  
  // If cache is valid, use it
  if (roadRatingsCache && (now - lastCacheTime < CACHE_DURATION)) {
    return roadRatingsCache;
  }
  
  // Otherwise fetch from Firestore
  try {
    const ratings = await getAllRoadRatings();
    roadRatingsCache = ratings;
    lastCacheTime = now;
    return ratings;
  } catch (error) {
    console.error('Error fetching road ratings for cache:', error);
    return [];
  }
};

// Calculate route using external APIs and Firestore data
export const calculateRoute = async (startLocation, destination, prioritizeSafety = true) => {
  try {
    console.log('Calculating route from', startLocation, 'to', destination);
    console.log('Safety prioritization:', prioritizeSafety ? 'Enabled' : 'Disabled');
    
    // Get road ratings from Firestore (cached)
    let roadRatings = [];
    try {
      roadRatings = await getCachedRoadRatings();
    } catch (ratingError) {
      console.warn('Failed to get road ratings, continuing without them:', ratingError);
      // Continue without ratings
    }
    
    // For the free plan, we'll use the external APIs directly from the client
    // This is a simplified version that uses mock data for now
    // In a real implementation, you would call the OSRM or GraphHopper APIs directly
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Use mock data for now
    const data = { ...mockRouteData };
    
    // Adjust mock data to use the actual start and destination
    if (data.route && data.route.length > 1) {
      data.route[0] = { ...startLocation };
      data.route[data.route.length - 1] = { ...destination };
      
      // Create intermediate points between start and destination
      if (data.route.length < 3) {
        // If there are only start and end points, add some intermediate points
        const newRoute = [data.route[0]];
        const numPoints = 5; // Number of intermediate points
        
        for (let i = 1; i <= numPoints; i++) {
          const ratio = i / (numPoints + 1);
          newRoute.push({
            lat: startLocation.lat + (destination.lat - startLocation.lat) * ratio,
            lng: startLocation.lng + (destination.lng - startLocation.lng) * ratio
          });
        }
        
        newRoute.push(data.route[data.route.length - 1]);
        data.route = newRoute;
      }
    }
    
    // Apply safety ratings if available
    if (roadRatings.length > 0 && data.segments) {
      data.segments = data.segments.map(segment => {
        // Find matching road rating if any
        const matchingRating = roadRatings.find(rating => 
          rating.roadId === segment.roadId || 
          (rating.area && segment.area && rating.area === segment.area)
        );
        
        if (matchingRating) {
          return {
            ...segment,
            safetyRating: matchingRating.safetyRating || segment.safetyRating,
            trafficStatus: matchingRating.trafficStatus || segment.trafficStatus
          };
        }
        
        return segment;
      });
    }
    
    // Calculate distance based on the route points
    let totalDistance = 0;
    for (let i = 0; i < data.route.length - 1; i++) {
      const p1 = data.route[i];
      const p2 = data.route[i + 1];
      
      // Simple distance calculation using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLon = (p2.lng - p1.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      totalDistance += distance;
    }
    
    // Update the distance in the data
    data.distance = totalDistance;
    data.estimatedTime = totalDistance * 2; // Rough estimate: 30 km/h average speed
    
    // Adjust safety score based on prioritization
    if (prioritizeSafety) {
      data.safetyScore = Math.min(100, data.safetyScore + 10);
    }
    
    // Store the calculation in Firestore for history (non-critical)
    try {
      const routeHistoryRef = collection(db, 'routeHistory');
      await addDoc(routeHistoryRef, {
        userId: auth.currentUser?.uid || 'anonymous',
        startLocation,
        destination,
        prioritizeSafety,
        timestamp: serverTimestamp()
      });
    } catch (historyError) {
      console.error('Error saving route history:', historyError);
      // Non-critical error, continue without failing
    }
    
    return data;
  } catch (error) {
    console.error('Error calculating route:', error);
    
    // Always return a fallback route instead of null
    const fallbackData = { ...mockRouteData };
    
    // Adjust fallback data to use the actual start and destination
    if (fallbackData.route && fallbackData.route.length > 1) {
      fallbackData.route[0] = { ...startLocation };
      fallbackData.route[fallbackData.route.length - 1] = { ...destination };
    }
    
    // Mark as fallback route
    fallbackData.routeType = 'fallback';
    fallbackData.safetyScore = 70; // Lower safety score for fallback routes
    
    return fallbackData;
  }
};

/**
 * User Profile Service
 */

// Get current user profile
export const getUserProfile = async () => {
  if (!auth.currentUser) return null;
  
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    } else {
      // Create profile if it doesn't exist
      const newProfile = {
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName || '',
        createdAt: serverTimestamp()
      };
      
      await updateDoc(userRef, newProfile);
      return {
        id: auth.currentUser.uid,
        ...newProfile
      };
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

// Update user profile
export const updateUserProfile = async (profileData) => {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const updatedProfile = {
      ...profileData,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(userRef, updatedProfile);
    return {
      id: auth.currentUser.uid,
      ...updatedProfile
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Save user favorite route
export const saveFavoriteRoute = async (routeData) => {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  try {
    const favoritesRef = collection(db, 'users', auth.currentUser.uid, 'favorites');
    const newFavorite = {
      ...routeData,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(favoritesRef, newFavorite);
    return {
      id: docRef.id,
      ...newFavorite
    };
  } catch (error) {
    console.error('Error saving favorite route:', error);
    throw error;
  }
};

// Get user favorite routes
export const getFavoriteRoutes = async () => {
  if (!auth.currentUser) return [];
  
  try {
    const favoritesRef = collection(db, 'users', auth.currentUser.uid, 'favorites');
    const q = query(favoritesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching favorite routes:', error);
    return [];
  }
};
