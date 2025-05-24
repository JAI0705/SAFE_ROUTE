# Firebase Authentication Setup for Safe Route

This document explains how to set up Firebase Authentication for the Safe Route application.

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click on "Add project" and follow the setup steps
3. Give your project a name (e.g., "safe-route")
4. Enable Google Analytics if desired
5. Click "Create project"

## Step 2: Register Your Web App

1. In the Firebase project dashboard, click on the web icon (</>) to add a web app
2. Register your app with a nickname (e.g., "safe-route-web")
3. Check the box for "Also set up Firebase Hosting" if you plan to deploy
4. Click "Register app"

## Step 3: Copy Your Firebase Configuration

After registering your app, you'll see a configuration object like this:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Copy this configuration and replace the placeholder values in `src/firebase/config.js`.

## Step 4: Enable Email/Password Authentication

1. In the Firebase Console, go to "Authentication" in the left sidebar
2. Click on the "Sign-in method" tab
3. Click on "Email/Password" and enable it
4. Save your changes

## Step 5: Set Up Firestore Database

1. In the Firebase Console, go to "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in production mode" or "Start in test mode" (for development)
4. Select a location for your database
5. Wait for the database to be provisioned

## Step 6: Set Up Firestore Security Rules

For development, you can use these basic rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

For production, you'll want to implement more specific security rules.

## Troubleshooting

- If you encounter CORS issues, make sure your Firebase project has the correct domains whitelisted
- For authentication errors, check the browser console for specific error messages
- Ensure your Firebase project billing plan supports the features you're using
