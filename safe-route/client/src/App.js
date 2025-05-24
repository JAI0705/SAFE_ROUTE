import React, { useState, useEffect } from 'react';
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

  // Calculate route using Firebase service
  const calculateRoute = async () => {
    if (!startLocation || !destination) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Calculating route from', startLocation, 'to', destination);
      console.log('Safety prioritization:', prioritizeSafety ? 'Enabled' : 'Disabled');
      
      // Calculate route using Firebase service
      let data = await firebaseCalculateRoute(startLocation, destination, prioritizeSafety);
      
      // If the calculation failed, use mock data
      if (!data) {
        console.log('Error calculating route, using mock data instead');
        // Use mock data as fallback
        data = { ...mockRouteData };
        
        // Adjust mock data to use the actual start and destination
        if (data.route && data.route.length > 1) {
          data.route[0] = { ...startLocation };
          data.route[data.route.length - 1] = { ...destination };
        }
      }
      
      console.log('Route data:', data);
      
      // Set the route and route info
      setRoute(data.route);
      setRouteInfo({
        distance: data.distance,
        estimatedTime: data.estimatedTime,
        safetyScore: data.safetyScore || 75,
        routeType: data.routeType || 'standard',
        isSafeRoute: data.routeType === 'safe-route'
      });
      
      // Create route segments for rating
      if (data.route.length > 1) {
        console.log('Creating route segments from route with', data.route.length, 'points');
        const segments = createRouteSegments(data.route);
        console.log('Created segments:', segments);
        setRouteSegments(segments);
      } else {
        console.warn('Not enough route points to create segments');
        setRouteSegments([]);
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      setError(error.message);
      setRoute(null);
      setRouteInfo(null);
      setRouteSegments([]);
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

export default App;
