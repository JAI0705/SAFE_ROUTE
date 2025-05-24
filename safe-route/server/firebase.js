const admin = require('firebase-admin');

// Initialize Firebase Admin
// You'll need to download your service account key from the Firebase console
// and set it as an environment variable or use a .env file
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "safe-route-127fd",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk@safe-route-127fd.iam.gserviceaccount.com",
    // Replace \\n with \n in the private key if it's stored in an environment variable
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? 
      process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : 
      "YOUR_PRIVATE_KEY"
  })
});

// Get Firestore instance
const db = admin.firestore();

module.exports = { admin, db };
