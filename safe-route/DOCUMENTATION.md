# Safe Route Application Documentation

## Project Overview

Safe Route is a full-stack web application designed to help users find safer travel routes in India. The application allows users to:

1. Find routes between locations using real road networks
2. Rate road segments based on their safety and quality
3. Calculate routes that prioritize both safety and speed
4. View detailed information about routes including distance, time, and safety scores

## Architecture

### Client-Server Architecture

- **Frontend**: React.js application with Leaflet for map rendering
- **Backend**: Node.js/Express server with routing and rating APIs
- **Data Storage**: Mock data with future MongoDB integration planned

## Core Features

### 1. Location Search and Geocoding

- Users can search for locations using the Nominatim API (OpenStreetMap)
- Autocomplete suggestions are provided as users type
- Selected locations are converted to coordinates for routing

### 2. Route Calculation

The application supports multiple routing methods:

- **GraphHopper Routing**: Primary routing service that provides detailed road-following routes
- **OSRM Routing**: Backup routing service used when GraphHopper fails
- **Safety-Prioritized Routing**: Custom algorithm that evaluates multiple routes based on safety ratings

Routes are calculated based on:
- Start and destination coordinates
- Road network data from routing services
- User-provided road ratings stored in the database

### 3. Road Rating System

Users can rate road segments directly by:
- Clicking on route segments displayed on the map
- Rating roads as "Good" or "Bad"
- Providing feedback that helps other users find safer routes

The rating system features:
- 2 km route segments for granular ratings
- Visual indicators for segment boundaries
- Popup interface for quick and easy rating

### 4. Safety-Prioritized Routing

The application calculates routes with both safety and speed in mind:

- **Algorithm**: Routes are scored using a weighted combination of safety (70%) and speed (30%)
- **Alternative Routes**: Multiple possible routes are evaluated to find the optimal path
- **User Control**: Toggle between safety-prioritized and fastest routes

## Technical Implementation

### Frontend Components

#### Main Components

1. **App.js**: Core application component that manages state and coordinates other components
2. **MapView.js**: Renders the map, routes, and handles user interactions with the map
3. **Sidebar.js**: Contains location inputs, route information, and controls
4. **PlaceSearch.js**: Provides location search functionality with autocomplete

#### Map Features

- **Leaflet Integration**: Uses React-Leaflet for map rendering
- **Interactive Elements**: Clickable route segments, markers, and popups
- **Visual Styling**: Color-coded safety indicators and route styling

### Backend Services

#### API Endpoints

1. **Route Calculation**:
   - `POST /api/routes/calculate`: Calculates routes between two points
   - Parameters: start coordinates, destination coordinates, prioritizeSafety flag

2. **Road Ratings**:
   - `POST /api/ratings`: Submits a new road rating
   - `GET /api/ratings/bounds`: Retrieves ratings within map bounds

#### Utility Services

1. **safeRouteCalculator.js**: Implements the safety-prioritized routing algorithm
2. **graphHopperService.js**: Handles GraphHopper API requests
3. **osrmService.js**: Handles OSRM API requests
4. **geocodingService.js**: Manages location search and geocoding

### Data Models

#### Road Rating Model

```javascript
{
  id: String,
  coordinates: {
    start: { lat: Number, lng: Number },
    end: { lat: Number, lng: Number }
  },
  points: Array, // All points in the segment
  rating: String, // "Good" or "Bad"
  timestamp: Date,
  distanceKm: Number // Approximate segment length
}
```

#### Route Model

```javascript
{
  route: Array, // Array of coordinate points
  distance: Number, // Distance in kilometers
  estimatedTime: Number, // Time in minutes
  safetyScore: Number, // 0-100 score
  routeType: String // "safe-route", "graphhopper", or "osrm"
}
```

## Key Algorithms

### Route Segmentation

Routes are divided into approximately 2 km segments using the following approach:

1. Calculate the total distance of the route
2. Iterate through route points, accumulating distance
3. Create a new segment when the accumulated distance reaches 2 km
4. Store all points within each segment to maintain the actual road path

### Safety Score Calculation

Safety scores (0-100) are calculated based on:

1. Proportion of road segments rated as "Bad"
2. Weighted importance of different road types
3. Normalized to a 0-100 scale where 100 is safest

### Route Optimization

The safety-prioritized routing algorithm:

1. Requests multiple alternative routes from routing services
2. Evaluates each route against known road ratings
3. Calculates a combined score using the formula: `(safetyScore * 0.7) + (speedScore * 0.3)`
4. Returns the route with the highest combined score

## Future Enhancements

Planned features for future development:

1. **User Authentication**: Allow users to create accounts and track their contributions
2. **Detailed Ratings**: Expand rating options to include specific issues (potholes, traffic, etc.)
3. **Historical Data**: Incorporate time-based data to account for changing conditions
4. **Mobile Application**: Develop a native mobile version for on-the-go use
5. **MongoDB Integration**: Replace mock data with persistent database storage

## Usage Instructions

### Finding a Route

1. Enter or select a start location
2. Enter or select a destination
3. Toggle "Prioritize Safety" based on preference
4. Click "Calculate Route" to see the result

### Rating a Road Segment

1. Calculate a route between two locations
2. Click on any segment of the displayed route
3. In the popup, rate the road as "Good" or "Bad"
4. The rating is saved and will influence future route calculations

## Technical Dependencies

- **Frontend**: React, Leaflet, Axios
- **Backend**: Node.js, Express
- **APIs**: GraphHopper, OSRM, Nominatim
- **Development**: Nodemon, Concurrently

## Project Structure

```
safe-route/
├── client/                  # Frontend React application
│   ├── public/              # Static files
│   └── src/                 # React source code
│       ├── components/      # React components
│       ├── services/        # API service functions
│       └── styles/          # CSS styles
├── server/                  # Backend Node.js application
│   ├── controllers/         # API route handlers
│   ├── models/              # Data models
│   ├── routes/              # API route definitions
│   └── utils/               # Utility functions
└── package.json             # Project dependencies and scripts
```

## Running the Application

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run start
   ```

3. Access the application at:
   ```
   http://localhost:3000
   ```

## API Keys

The application requires API keys for external services:

- GraphHopper API key (for routing)
- OSRM (no key required, uses public API)
- Nominatim (no key required, uses public API)

For development purposes, the application uses demo keys or public APIs.
