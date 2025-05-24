const admin = require('firebase-admin');

// Initialize Firebase Admin with the service account
// You'll need to download your service account key from the Firebase console
// and place it in the config/firebase directory
try {
  // Try to initialize with service account file
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  // If service account file is not available, try to initialize with environment variables
  console.warn('Service account file not found, attempting to use environment variables');
  
  try {
    // Initialize with environment variables
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  } catch (envError) {
    console.error('Failed to initialize Firebase Admin:', envError);
    // Initialize with a placeholder for development if needed
    if (process.env.NODE_ENV === 'development') {
      console.warn('Initializing Firebase Admin in development mode without credentials');
      admin.initializeApp();
    } else {
      throw new Error('Firebase Admin initialization failed');
    }
  }
}

// Get Firestore instance
const db = admin.firestore();

module.exports = {
  admin,
  db
};
