const admin = require('firebase-admin');
require('dotenv').config();

let db;
let firebaseInitialized = false;

try {
  // Check if we have the required Firebase credentials
  const projectId = process.env.FIREBASE_PROJECT_ID || "safe-route-127fd";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = process.env.FIREBASE_PRIVATE_KEY ? 
    process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : "";

  // Only initialize Firebase if we have valid credentials
  if (clientEmail && privateKey && privateKey !== "YOUR_PRIVATE_KEY") {
    // Initialize Firebase Admin with credentials
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });

    // Get Firestore instance
    db = admin.firestore();
    firebaseInitialized = true;
    console.log('Firebase initialized successfully with provided credentials');
  } else {
    // If using service account JSON file instead of environment variables
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      db = admin.firestore();
      firebaseInitialized = true;
      console.log('Firebase initialized with application default credentials');
    } catch (fileError) {
      console.warn('Could not initialize Firebase with application default credentials:', fileError.message);
      console.warn('Using mock implementation for Firestore');
      
      // Create a mock implementation
      db = createMockFirestore();
    }
  }
} catch (error) {
  console.error('Error initializing Firebase:', error.message);
  console.warn('Using mock implementation for Firestore');
  
  // Create a mock implementation
  db = createMockFirestore();
}

// Function to create a mock Firestore implementation
function createMockFirestore() {
  console.log('Creating mock Firestore implementation');
  const mockData = {
    'ratings': {}
  };
  
  return {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          const data = mockData[name]?.[id];
          return {
            exists: !!data,
            data: () => data || {}
          };
        },
        set: async (data) => {
          if (!mockData[name]) mockData[name] = {};
          mockData[name][id] = data;
          console.log(`Mock save to ${name}/${id}:`, data);
        },
        update: async (data) => {
          if (!mockData[name]) mockData[name] = {};
          mockData[name][id] = { ...mockData[name][id], ...data };
          console.log(`Mock update to ${name}/${id}:`, data);
        }
      }),
      where: () => ({
        get: async () => ({
          empty: true,
          docs: []
        })
      }),
      add: async (data) => {
        const id = `mock-${Date.now()}`;
        if (!mockData[name]) mockData[name] = {};
        mockData[name][id] = data;
        console.log(`Mock add to ${name}:`, data);
        return { id };
      }
    })
  };
}

module.exports = { admin, db, firebaseInitialized };
