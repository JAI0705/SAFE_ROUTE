/**
 * Firebase configuration for Safe Route application
 * This file provides both Firebase services and fallback mock data
 * with enhanced error handling and environment detection
 */

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Environment detection
const isProduction = window.location.hostname !== 'localhost' && 
                   !window.location.hostname.includes('127.0.0.1');

// Configuration flag to disable Firestore in production for debugging
const DISABLE_FIRESTORE_IN_PRODUCTION = false; // Set to true to disable Firestore in production

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBK49ENdI873Fz4LbJjSrUUGWP4VcrjPzw",
  authDomain: "safe-route-127fd.firebaseapp.com",
  projectId: "safe-route-127fd",
  storageBucket: "safe-route-127fd.appspot.com",
  messagingSenderId: "846278661816",
  appId: "1:846278661816:web:7ffb7511b84cd95ed6464d",
  measurementId: "G-NMD0018HQP"
};

// Firebase service state variables
let app = null;
let auth = null;
let db = null;
let firebaseInitialized = false;
let authInitialized = false;
let firestoreInitialized = false;
let usingMockDb = true; // Default to using mock data

// Initialize Firebase with comprehensive error handling
function initializeFirebaseServices() {
  // Skip Firestore initialization in production if configured to do so
  const shouldSkipFirestore = isProduction && DISABLE_FIRESTORE_IN_PRODUCTION;
  
  if (shouldSkipFirestore) {
    console.log('Firestore initialization skipped in production environment');
  }
  
  try {
    // Step 1: Initialize Firebase app
    try {
      app = initializeApp(firebaseConfig);
      firebaseInitialized = true;
      console.log('Firebase app initialized successfully');
    } catch (appError) {
      console.error('Firebase app initialization failed:', {
        message: appError.message || 'Unknown error',
        code: appError.code || 'unknown',
        stack: appError.stack || 'No stack trace available'
      });
      throw new Error('Firebase app initialization failed');
    }
    
    // Step 2: Initialize Firebase Authentication
    try {
      auth = getAuth(app);
      authInitialized = true;
      console.log('Firebase auth initialized successfully');
    } catch (authError) {
      console.error('Firebase auth initialization failed:', {
        message: authError.message || 'Unknown error',
        code: authError.code || 'unknown',
        stack: authError.stack || 'No stack trace available'
      });
      // Continue with mock auth, but log the error
      auth = createMockAuth();
    }
    
    // Step 3: Initialize Firestore (skip in production if configured)
    if (!shouldSkipFirestore) {
      try {
        db = getFirestore(app);
        firestoreInitialized = true;
        console.log('Firestore initialized successfully');
        
        // We'll still use mock data by default for reliability
        usingMockDb = true;
      } catch (dbError) {
        console.error('Firestore initialization failed:', {
          message: dbError.message || 'Unknown error',
          code: dbError.code || 'unknown',
          stack: dbError.stack || 'No stack trace available'
        });
        usingMockDb = true;
      }
    } else {
      usingMockDb = true;
      console.log('Using mock database in production as configured');
    }
    
    return true;
  } catch (error) {
    // Catch-all for any other errors
    console.error('Firebase services initialization failed:', {
      message: error.message || 'Unknown error',
      code: error.code || 'unknown',
      stack: error.stack || 'No stack trace available'
    });
    
    // Ensure we have at least a mock auth
    if (!authInitialized) {
      auth = createMockAuth();
    }
    
    usingMockDb = true;
    return false;
  }
}

// Initialize Firebase services
const servicesInitialized = initializeFirebaseServices();

// Log the initialization status for debugging
console.log('Firebase services status:', {
  firebaseInitialized,
  authInitialized,
  firestoreInitialized,
  usingMockDb,
  environment: isProduction ? 'production' : 'development'
});

// Create a mock auth implementation for fallback
function createMockAuth() {
  console.log('Using mock auth implementation');
  const mockAuth = {
    currentUser: null,
    onAuthStateChanged: (callback) => {
      // Initial callback with null user
      callback(null);
      return () => {}; // Return unsubscribe function
    },
    signInWithEmailAndPassword: async (email, password) => {
      // Find user in mock data
      const user = mockUsers.find(u => u.email === email && u.password === password);
      if (!user) {
        throw new Error('Invalid email or password');
      }
      mockAuth.currentUser = user;
      return { user };
    },
    createUserWithEmailAndPassword: async (email, password) => {
      // Check if user already exists
      if (mockUsers.some(u => u.email === email)) {
        throw new Error('Email already in use');
      }
      const newUser = {
        uid: `mock-${Date.now()}`,
        email,
        password,
        emailVerified: false
      };
      mockUsers.push(newUser);
      mockAuth.currentUser = newUser;
      return { user: newUser };
    },
    signOut: async () => {
      mockAuth.currentUser = null;
      return Promise.resolve();
    }
  };
  return mockAuth;
}

// Mock road ratings data for India
const mockRoadRatings = [
  {
    id: 'rating1',
    coordinates: {
      start: { lat: 28.6139, lng: 77.2090 }, // Delhi
      end: { lat: 28.5355, lng: 77.3910 }    // Noida
    },
    rating: 'Good',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rating2',
    coordinates: {
      start: { lat: 19.0760, lng: 72.8777 }, // Mumbai
      end: { lat: 19.1136, lng: 72.9050 }    // Powai
    },
    rating: 'Bad',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rating3',
    coordinates: {
      start: { lat: 12.9716, lng: 77.5946 }, // Bangalore
      end: { lat: 13.0298, lng: 77.5968 }    // Hebbal
    },
    rating: 'Good',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rating4',
    coordinates: {
      start: { lat: 22.5726, lng: 88.3639 }, // Kolkata
      end: { lat: 22.6757, lng: 88.4588 }    // Salt Lake
    },
    rating: 'Bad',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rating5',
    coordinates: {
      start: { lat: 17.3850, lng: 78.4867 }, // Hyderabad
      end: { lat: 17.4156, lng: 78.3392 }    // Hitech City
    },
    rating: 'Good',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Mock cities data for India
const mockCities = [
  { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { name: 'Lucknow', lat: 26.8467, lng: 80.9462 }
];

// Mock user data
const mockUsers = [
  {
    uid: 'user1',
    email: 'test@example.com',
    password: 'password123', // In a real app, passwords would be hashed and not stored directly
    emailVerified: true,
    createdAt: new Date().toISOString()
  }
];

/**
* Safe Firebase service access functions
* These functions provide safe access to Firebase services with proper error handling
*/

// Safe auth access function
export const getFirebaseAuth = () => {
if (!authInitialized) {
console.warn('Attempting to use Firebase auth when not properly initialized');
}
return auth;
};

// Safe Firestore access function
export const getFirestoreDb = () => {
  if (!firestoreInitialized) {
    console.warn('Attempting to use Firestore when not properly initialized');
  }
  return db;
};

// Safe Firestore collection access function
export const getCollection = (collectionName) => {
  if (!firestoreInitialized || usingMockDb) {
    console.warn(`Attempting to access Firestore collection '${collectionName}' when using mock data`);
    return null;
  }
  return db ? db.collection(collectionName) : null;
};

// Firebase status information
export const getFirebaseStatus = () => ({
  firebaseInitialized,
  authInitialized,
  firestoreInitialized,
  usingMockDb,
  isProduction
});

// Export Firebase services, status flags, and mock data
export { auth, db, usingMockDb, mockRoadRatings, mockUsers, isProduction };
export default app;
