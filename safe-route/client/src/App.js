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

function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [startLocation, setStartLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [roadRatings, setRoadRatings] = useState([]);
  const [trafficData, setTrafficData] = useState([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Default center of India if location permission is denied
  const defaultCenter = [20.5937, 78.9629];
  const defaultZoom = 5;

  // Get user's location on component mount
  useEffect(() => {
    if (navigator.geolocation && !userLocation) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(permissionStatus => {
          if (permissionStatus.state === 'granted') {
            setPermissionGranted(true);
            getUserLocation();
          } else if (permissionStatus.state === 'prompt') {
            // We'll show the permission prompt component
          } else {
            // Permission denied
            setError('Location permission denied. Using default location.');
          }
        });
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

  // Calculate route
  const calculateRoute = async () => {
    if (!startLocation || !destination) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: startLocation,
          destination: destination,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to calculate route');
      }
      
      const data = await response.json();
      setRoute(data.route);
      setRouteInfo({
        distance: data.distance,
        estimatedTime: data.estimatedTime,
        safetyScore: data.safetyScore,
      });
    } catch (error) {
      console.error('Error calculating route:', error);
      setError('Failed to calculate route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle road rating
  const handleRoadRating = async (roadId, coordinates, rating) => {
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roadId,
          coordinates,
          rating,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit road rating');
      }
      
      // Recalculate route if one exists
      if (destination) {
        calculateRoute(destination);
      }
      
      // Update road ratings
      fetchRoadRatings();
    } catch (error) {
      console.error('Error submitting road rating:', error);
      setError('Failed to submit road rating. Please try again.');
    }
  };

  // Fetch road ratings
  const fetchRoadRatings = async (bounds) => {
    if (!bounds) return;
    
    try {
      const { north, south, east, west } = bounds;
      const response = await fetch(`/api/ratings/bounds?north=${north}&south=${south}&east=${east}&west=${west}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch road ratings');
      }
      
      const data = await response.json();
      setRoadRatings(data);
    } catch (error) {
      console.error('Error fetching road ratings:', error);
    }
  };

  // Fetch traffic data
  const fetchTrafficData = async (bounds) => {
    if (!bounds) return;
    
    try {
      const { north, south, east, west } = bounds;
      const response = await fetch(`/api/routes/traffic?north=${north}&south=${south}&east=${east}&west=${west}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch traffic data');
      }
      
      const data = await response.json();
      setTrafficData(data);
    } catch (error) {
      console.error('Error fetching traffic data:', error);
    }
  };

  // Handle map bounds change
  const handleBoundsChange = (bounds) => {
    fetchRoadRatings(bounds);
    fetchTrafficData(bounds);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {!permissionGranted ? (
          <LocationPermission onGrant={handlePermissionGrant} />
        ) : (
          <>
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
            
            <div className="flex-1">
              <MapView 
                userLocation={userLocation}
                startLocation={startLocation}
                destination={destination}
                route={route}
                roadRatings={roadRatings}
                trafficData={trafficData}
                onBoundsChange={handleBoundsChange}
                onRoadRating={handleRoadRating}
              />
            </div>
            
            {routeInfo && (
              <RouteInfo 
                distance={routeInfo.distance}
                estimatedTime={routeInfo.estimatedTime}
                safetyScore={routeInfo.safetyScore}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
