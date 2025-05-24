# Safe Route Authentication System Documentation

## Overview

The Safe Route application now includes a complete authentication system with the following features:

1. **Beautiful Homepage** - A clean, aesthetic landing page that serves as the entry point to the application
2. **User Registration** - Email/password registration with location permission consent
3. **User Login** - Secure authentication using Firebase
4. **Protected Routes** - Map functionality is only accessible to authenticated users
5. **User Data Storage** - User information is stored in Firebase Firestore

## Architecture

The authentication system follows a modern React architecture:

- **React Router** - For navigation and route protection
- **Context API** - For global authentication state management
- **Firebase Authentication** - For secure user authentication
- **Firebase Firestore** - For user data storage

## Key Components

### Pages
- `HomePage.js` - Landing page with Register and Sign In buttons
- `RegisterPage.js` - User registration with location permission modal
- `LoginPage.js` - User login form
- `MapPage.js` - Protected page that wraps the existing map functionality

### Authentication
- `AuthContext.js` - Provides authentication state across the application
- `PrivateRoute.js` - Protects routes that require authentication
- `authService.js` - Service for Firebase authentication operations

### UI Components
- `AuthNav.js` - Navigation component with logout functionality

## Setup Instructions

### 1. Firebase Configuration

Before using the authentication system, you need to set up a Firebase project:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Add a web app to your project
4. Enable Email/Password authentication
5. Create a Firestore database

Then update the Firebase configuration in `/src/firebase/config.js`:

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

### 2. Firestore Rules

Set up basic security rules for your Firestore database:

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

## User Flow

1. **First Visit**: User sees the homepage with Register and Sign In buttons
2. **Registration**: 
   - User enters email and password
   - User accepts location permission terms
   - Account is created in Firebase
   - User data is stored in Firestore
   - User is redirected to the map

3. **Login**:
   - User enters email and password
   - Firebase authenticates the user
   - User is redirected to the map

4. **Map Access**:
   - Map is only accessible to authenticated users
   - Location permission is assumed to be granted during registration
   - User can log out via the navigation bar

## Data Structure

### Firestore Collections

**users**: Collection of user documents
- Document ID: User's Firebase Auth UID
- Fields:
  - `email`: User's email address
  - `createdAt`: Timestamp of account creation
  - `locationPermissionGranted`: Boolean indicating if user granted location permission

## Customization Options

### Styling
- All components use dedicated CSS files in the `/src/styles/` directory
- You can modify these files to match your brand's look and feel
- The design is responsive and works on mobile devices

### Additional Authentication Methods
- The system is set up for email/password authentication
- To add social login (Google, Facebook, etc.), update the Firebase config and add the corresponding authentication methods

## Troubleshooting

### Common Issues

1. **Firebase Configuration**
   - Ensure your Firebase config in `config.js` is correct
   - Check that you've enabled Email/Password authentication in Firebase Console

2. **Route Protection**
   - If users can access the map without logging in, check the `PrivateRoute` component
   - Verify that `AuthContext` is properly providing authentication state

3. **Location Permission**
   - If location isn't working, check that the browser permissions are granted
   - The application now assumes location permission is granted during registration

## Next Steps

Consider these enhancements to further improve the authentication system:

1. **Password Reset** - Add functionality for users to reset forgotten passwords
2. **Email Verification** - Require email verification before allowing access
3. **Profile Management** - Allow users to update their profile information
4. **Social Login** - Add options for Google, Facebook, or other social login methods
5. **Remember Me** - Add a "Remember Me" option for persistent login
