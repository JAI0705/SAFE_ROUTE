/**
 * Authentication Service
 * This file provides Firebase authentication functions with enhanced error handling
 * and detailed logging for easier debugging in production
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, getFirebaseAuth, getFirebaseStatus, getFirestoreDb } from '../firebase/config';

// Get Firebase status for conditional operations
const { authInitialized, firestoreInitialized, isProduction } = getFirebaseStatus();

// Log authentication service initialization
console.log('Authentication service initialized with status:', {
  authInitialized,
  firestoreInitialized,
  environment: isProduction ? 'production' : 'development'
});

/**
 * Helper function to log detailed error information
 * @param {string} operation - The operation that failed
 * @param {Error} error - The error object
 */
const logAuthError = (operation, error) => {
  const errorDetails = {
    operation,
    message: error?.message || 'Unknown error',
    code: error?.code || 'unknown',
    stack: error?.stack || 'No stack trace available',
    timestamp: new Date().toISOString()
  };
  
  console.error(`Authentication error during ${operation}:`, errorDetails);
  return errorDetails;
};

// Register a new user with enhanced error handling
export const registerUser = async (email, password) => {
  if (!authInitialized) {
    const errorMsg = 'Cannot register user: Firebase Authentication not initialized';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  
  try {
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('User registered successfully:', { uid: user.uid, email: user.email });
    
    // Create a user document in Firestore only if Firestore is initialized
    if (firestoreInitialized) {
      try {
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          createdAt: new Date().toISOString(),
          locationPermissionGranted: true
        });
        console.log('User document created in Firestore');
      } catch (firestoreError) {
        // Log detailed error but continue - the user is still authenticated
        logAuthError('creating user document', firestoreError);
      }
    } else {
      console.warn('Skipping Firestore user document creation: Firestore not initialized');
    }
    
    return { success: true, user };
  } catch (error) {
    const errorDetails = logAuthError('user registration', error);
    return { 
      success: false, 
      error: errorDetails.message,
      code: errorDetails.code
    };
  }
};

// Sign in an existing user with enhanced error handling
export const loginUser = async (email, password) => {
  if (!authInitialized) {
    const errorMsg = 'Cannot login: Firebase Authentication not initialized';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('User logged in successfully:', { uid: userCredential.user.uid });
    return { success: true, user: userCredential.user };
  } catch (error) {
    const errorDetails = logAuthError('user login', error);
    return { 
      success: false, 
      error: errorDetails.message,
      code: errorDetails.code
    };
  }
};

// Sign out the current user with enhanced error handling
export const logoutUser = async () => {
  if (!authInitialized) {
    const errorMsg = 'Cannot logout: Firebase Authentication not initialized';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  
  try {
    await signOut(auth);
    console.log('User logged out successfully');
    return { success: true };
  } catch (error) {
    const errorDetails = logAuthError('user logout', error);
    return { 
      success: false, 
      error: errorDetails.message,
      code: errorDetails.code
    };
  }
};

// Get the current user's profile data with enhanced error handling
export const getUserProfile = async (userId) => {
  if (!userId) {
    const errorMsg = 'Cannot get user profile: No user ID provided';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  
  // If Firestore is not initialized, return a mock profile
  if (!firestoreInitialized) {
    console.warn('Firestore not initialized, returning mock user profile');
    return { 
      success: true, 
      profile: {
        email: 'user@example.com',
        createdAt: new Date().toISOString(),
        locationPermissionGranted: true,
        isMockProfile: true
      },
      isMockData: true
    };
  }
  
  try {
    // Get user document from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      console.log('User profile fetched successfully');
      return { 
        success: true, 
        profile: userDoc.data() 
      };
    } else {
      console.warn(`User profile not found for ID: ${userId}`);
      return { 
        success: false, 
        error: 'User profile not found',
        code: 'profile-not-found'
      };
    }
  } catch (error) {
    const errorDetails = logAuthError('fetching user profile', error);
    return { 
      success: false, 
      error: errorDetails.message,
      code: errorDetails.code
    };
  }
};

// Send password reset email with enhanced error handling
export const resetPassword = async (email) => {
  if (!authInitialized) {
    const errorMsg = 'Cannot reset password: Firebase Authentication not initialized';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  
  if (!email) {
    const errorMsg = 'Cannot reset password: No email provided';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('Password reset email sent successfully');
    return { success: true };
  } catch (error) {
    const errorDetails = logAuthError('password reset', error);
    return { 
      success: false, 
      error: errorDetails.message,
      code: errorDetails.code
    };
  }
};
