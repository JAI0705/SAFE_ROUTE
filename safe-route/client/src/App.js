import React, { useState, useEffect, Component } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './styles/App.css';

// Components
import Header from './components/Header';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import RouteInfo from './components/RouteInfo';
import LocationPermission from './components/LocationPermission';

// Import mock data for fallback
import { mockRouteData } from './mockData';

// Import Firebase services
import { calculateRoute as firebaseCalculateRoute } from './firebase/firebaseService';

// Error Boundary component to prevent the entire app from crashing
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('Error caught by error boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when an error occurs
      return (
        <div className="error-boundary" style={{ padding: '20px', textAlign: 'center', color: '#721c24', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '5px', margin: '20px' }}>
          <h2>Something went wrong</h2>
          <p>We're sorry, but there was an error loading this page. Please try refreshing the page or try again later.</p>
          <details style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: '10px' }}>
            <summary>Show error details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '15px', padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [roadRatings, setRoadRatings] = useState([]);
  const [routeSegments, setRouteSegments] = useState([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prioritizeSafety, setPrioritizeSafety] = useState(true);

  // Default center of India if location permission is denied
  const defaultCenter = [20.5937, 78.9629];
  const defaultZoom = 5;

  // Get user's location on component mount - now we assume permission is granted via registration
  useEffect(() => {
    if (navigator.geolocation && !userLocation) {
      // Since we've already obtained permission during registration,
      // we can directly request the location
      setPermissionGranted(true);
      getUserLocation();
    }
  }, [userLocation]);

  // Function to get user's location
  const getUserLocation = () => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        
        // Check if coordinates are within India's boundaries
        if (isWithinIndia(latitude, longitude)) {
          setUserLocation({ lat: latitude, lng: longitude });
          setPermissionGranted(true);
        } else {
          setError('Location is outside India. Using default location.');
          setUserLocation({ lat: defaultCenter[0], lng: defaultCenter[1] });
        }
      },
      error => {
        console.error('Error getting location:', error);
        setError('Could not get your location. Using default location.');
        setUserLocation({ lat: defaultCenter[0], lng: defaultCenter[1] });
      }
    );
  };

  // Check if coordinates are within India's boundaries
  const isWithinIndia = (lat, lng) => {
    // Approximate boundaries of India
    const northBound = 37.0;  // Northern boundary
    const southBound = 6.0;   // Southern boundary
    const westBound = 68.0;   // Western boundary
    const eastBound = 97.5;   // Eastern boundary
    
    return lat >= southBound && lat <= northBound && lng >= westBound && lng <= eastBound;
  };

  // Handle location permission
  const handlePermissionGrant = () => {
    getUserLocation();
    setPermissionGranted(true);
  };

  // Handle start location selection
  const handleStartSelect = (coords) => {
    setStartLocation(coords);
    // If we already have a destination, don't automatically calculate the route
    // Let the user click the calculate button instead
    setRoute(null);
    setRouteInfo(null);
  };

  // Handle destination selection
  const handleDestinationSelect = (coords) => {
    setDestination(coords);
    // Don't automatically calculate the route
    // Let the user click the calculate button instead
    setRoute(null);
    setRouteInfo(null);
  };

  // Calculate route using Firebase service with enhanced error handling
  const calculateRoute = async () => {
    if (!startLocation || !destination) {
      console.log('Missing start or destination, cannot calculate route');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Calculating route from', startLocation, 'to', destination);
      console.log('Safety prioritization:', prioritizeSafety ? 'Enabled' : 'Disabled');
      
      // Defensive programming - ensure we have valid coordinates
      if (!startLocation.lat || !startLocation.lng || !destination.lat || !destination.lng) {
        throw new Error('Invalid coordinates in start or destination');
      }
      
      // Calculate route using Firebase service
      console.log('Calling firebaseCalculateRoute with:', startLocation, destination, prioritizeSafety);
      let routeData = null;
      
      try {
        routeData = await firebaseCalculateRoute(startLocation, destination, prioritizeSafety);
        console.log('Route data returned:', routeData);
      } catch (serviceError) {
        console.error('Firebase route calculation failed:', serviceError);
        throw new Error(`Firebase route calculation failed: ${serviceError.message}`);
      }
      
      if (routeData && routeData.route && routeData.route.length > 0) {
        console.log('Valid route data received with', routeData.route.length, 'points');
        
        // Validate route data before using it
        const validRoute = routeData.route.every(point => 
          point && typeof point.lat === 'number' && typeof point.lng === 'number'
        );
        
        if (!validRoute) {
          console.error('Invalid route data received:', routeData.route);
          throw new Error('Invalid route data: contains invalid coordinates');
        }
        
        // Set route data
        setRoute(routeData.route);
        
        // Create route segments for road rating
        console.log('Creating route segments');
        try {
          const segments = createRouteSegments(routeData.route);
          console.log('Created segments:', segments.length);
          setRouteSegments(segments);
        } catch (segmentError) {
          console.error('Error creating route segments:', segmentError);
          // Continue without segments
          setRouteSegments([]);
        }
        
        // Set route info
        setRouteInfo({
          distance: routeData.distance || 0,
          estimatedTime: routeData.estimatedTime || 0,
          safetyScore: routeData.safetyScore || 80,
          isSafeRoute: prioritizeSafety,
          routeType: routeData.routeType || 'standard'
        });
      } else {
        console.log('No valid route data received, creating simple route');
        
        // Create a simple route if no route data is received
        try {
          const simpleRoute = createSimpleRoute(startLocation, destination);
          console.log('Created simple route with', simpleRoute.length, 'points');
          setRoute(simpleRoute);
          
          // Create route segments for the simple route
          const segments = createRouteSegments(simpleRoute);
          setRouteSegments(segments);
          
          // Calculate simple distance and time
          const distance = calculateSimpleDistance(startLocation, destination);
          const estimatedTime = calculateSimpleTime(startLocation, destination);
          
          // Set route info for simple route
          setRouteInfo({
            distance,
            estimatedTime,
            safetyScore: 75, // Default safety score for simple routes
            isSafeRoute: false,
            routeType: 'simple'
          });
        } catch (simpleRouteError) {
          console.error('Error creating simple route:', simpleRouteError);
          throw new Error(`Failed to create simple route: ${simpleRouteError.message}`);
        }
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      
      // Show error message but don't blank the screen
      setError(`Error calculating route: ${error.message}`);
      
      // Create a fallback route instead of blanking the screen
      try {
        console.log('Creating emergency fallback route due to error');
        
        // Super simple fallback - just a straight line between points
        const emergencyRoute = [
          { lat: startLocation.lat, lng: startLocation.lng },
          { lat: destination.lat, lng: destination.lng }
        ];
        
        console.log('Emergency route created:', emergencyRoute);
        setRoute(emergencyRoute);
        
        // Don't try to create segments for the emergency route
        setRouteSegments([]);
        
        // Calculate very basic distance and time
        const distance = calculateSimpleDistance(startLocation, destination);
        const estimatedTime = calculateSimpleTime(startLocation, destination);
        
        setRouteInfo({
          distance,
          estimatedTime,
          safetyScore: 50, // Lower safety score for emergency fallback routes
          isSafeRoute: false,
          routeType: 'emergency-fallback'
        });
      } catch (fallbackError) {
        console.error('Even emergency fallback route calculation failed:', fallbackError);
        // Clear all route data as last resort
        setRoute([]);
        setRouteSegments([]);
        setRouteInfo(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate simple distance between two points using Haversine formula
  const calculateSimpleDistance = (start, destination) => {
    const lat1 = start.lat;
    const lon1 = start.lng;
    const lat2 = destination.lat;
    const lon2 = destination.lng;
    
    return calculateDistance(lat1, lon1, lat2, lon2);
  };

  // Calculate simple time estimate based on distance
  const calculateSimpleTime = (start, destination) => {
    const distance = calculateSimpleDistance(start, destination);
    // Assume average speed of 60 km/h
    return distance / 60 * 60; // Convert to minutes
  };

  // Create a simple route between two points
  const createSimpleRoute = (start, destination) => {
    const numPoints = 10; // Number of intermediate points
    const route = [];
    
    route.push(start);
    
    // Create intermediate points
    for (let i = 1; i < numPoints - 1; i++) {
      const ratio = i / numPoints;
      const lat = start.lat + (destination.lat - start.lat) * ratio;
      const lng = start.lng + (destination.lng - start.lng) * ratio;
      route.push({ lat, lng });
    }
    
    route.push(destination);
    
    return route;
  };

  // Handle road rating - optimized to reduce lag
  const handleRoadRating = async (roadId, coordinates, rating) => {
    try {
      console.log(`Rating road ${roadId} at coordinates ${JSON.stringify(coordinates)} with rating ${rating}`);
      
      // Find the road segment
      const segment = routeSegments.find(seg => seg.id === roadId);
      
      if (!segment) {
        console.error(`Road segment with ID ${roadId} not found`);
        return;
      }
      
      // Create a copy of the current road ratings
      const updatedRoadRatings = [...roadRatings];
      
      // Check if this road has already been rated
      const existingRatingIndex = updatedRoadRatings.findIndex(r => r.id === roadId);
      
      if (existingRatingIndex !== -1) {
        // Update existing rating
        updatedRoadRatings[existingRatingIndex] = {
          ...updatedRoadRatings[existingRatingIndex],
          rating,
          timestamp: new Date().toISOString()
        };
      } else {
        // Add new rating
        updatedRoadRatings.push({
          id: roadId,
          coordinates: {
            start: segment.start,
            end: segment.end
          },
          rating,
          timestamp: new Date().toISOString()
        });
      }
      
      // Update state
      setRoadRatings(updatedRoadRatings);
      
      // Send rating to server
      try {
        const response = await fetch('/api/roads/rate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roadId,
            coordinates,
            rating
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error submitting road rating:', errorData);
        }
      } catch (error) {
        console.error('Failed to submit road rating:', error);
        // Continue anyway - we've already updated the UI
      }
    } catch (error) {
      console.error('Error handling road rating:', error);
    }
  };

  // Fetch road ratings
  const fetchRoadRatings = async (bounds) => {
    try {
      const response = await fetch(`/api/roads/ratings?bounds=${JSON.stringify(bounds)}`);
      
      if (response.ok) {
        const data = await response.json();
        setRoadRatings(data);
      } else {
        console.error('Failed to fetch road ratings');
      }
    } catch (error) {
      console.error('Error fetching road ratings:', error);
      // Silently fail - this is not critical functionality
    }
  };

  // Calculate distance between two points in kilometers using the Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  // Create route segments of approximately 2 km each
  const createRouteSegments = (routePoints) => {
    const segments = [];
    const segmentLength = 2; // km
    
    if (routePoints.length < 2) {
      return segments;
    }
    
    let currentSegmentStart = routePoints[0];
    let currentSegmentDistance = 0;
    let segmentPoints = [currentSegmentStart];
    
    for (let i = 1; i < routePoints.length; i++) {
      const point = routePoints[i];
      const prevPoint = routePoints[i-1];
      
      // Calculate distance between this point and the previous one
      const pointDistance = calculateDistance(
        prevPoint.lat, prevPoint.lng,
        point.lat, point.lng
      );
      
      // Add this point to the current segment
      segmentPoints.push(point);
      currentSegmentDistance += pointDistance;
      
      // If we've reached the target segment length or this is the last point
      if (currentSegmentDistance >= segmentLength || i === routePoints.length - 1) {
        // Create a segment
        segments.push({
          id: `segment-${segments.length}`,
          start: currentSegmentStart,
          end: point,
          points: [...segmentPoints],
          distance: currentSegmentDistance,
          // Assign a random safety score for demonstration
          safetyScore: Math.floor(Math.random() * 100)
        });
        
        // Start a new segment
        currentSegmentStart = point;
        currentSegmentDistance = 0;
        segmentPoints = [currentSegmentStart];
      }
    }
    
    console.log(`Created ${segments.length} road segments of ~2km each from ${routePoints.length} points`);
    return segments;
  };

  // Handle map bounds change
  const handleBoundsChange = (bounds) => {
    fetchRoadRatings(bounds);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* We now assume permission is always granted for authenticated users */}
        <>
          <div className="sidebar">
              <h1>Safe Route</h1>
              
              <div className="safety-toggle" style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '5px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={prioritizeSafety} 
                    onChange={() => setPrioritizeSafety(!prioritizeSafety)}
                    style={{ marginRight: '10px' }}
                  />
                  <span>Prioritize Safety</span>
                </label>
                <p style={{ fontSize: '12px', margin: '5px 0 0 0', color: '#666' }}>
                  {prioritizeSafety ? 
                    'Finding routes that avoid poorly rated roads' : 
                    'Calculating fastest route without safety consideration'}
                </p>
              </div>
              
              <Sidebar 
                userLocation={userLocation}
                startLocation={startLocation}
                destination={destination}
                routeInfo={routeInfo}
                loading={loading}
                error={error}
                onStartSelect={handleStartSelect}
                onDestinationSelect={handleDestinationSelect}
                onCalculateRoute={calculateRoute}
              />
              
              {routeInfo && (
                <div className="route-info">
                  <h3>Route Information</h3>
                  <p><strong>Distance:</strong> {routeInfo.distance.toFixed(2)} km</p>
                  <p><strong>Estimated Time:</strong> {routeInfo.estimatedTime.toFixed(0)} minutes</p>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    backgroundColor: routeInfo.safetyScore > 80 ? '#d4edda' : routeInfo.safetyScore > 60 ? '#fff3cd' : '#f8d7da',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    marginBottom: '10px'
                  }}>
                    <strong style={{ marginRight: '5px' }}>Safety Score:</strong> 
                    <span>{routeInfo.safetyScore}/100</span>
                    {routeInfo.isSafeRoute && (
                      <span style={{ 
                        marginLeft: '10px', 
                        backgroundColor: '#28a745', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '3px',
                        fontSize: '12px'
                      }}>
                        Safety Optimized
                      </span>
                    )}
                  </div>
                  <p><strong>Route Type:</strong> {routeInfo.routeType}</p>
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <MapView 
                userLocation={userLocation}
                startLocation={startLocation}
                destination={destination}
                route={route}
                roadRatings={roadRatings}
                routeSegments={routeSegments}
                trafficData={[]}
                onBoundsChange={handleBoundsChange}
                onRoadRating={handleRoadRating}
              />
            </div>
          </>
      </div>
    </div>
  );
}

// Wrap the App component with the ErrorBoundary
const SafeApp = () => {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
};

export default SafeApp;
