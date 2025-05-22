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
      console.log('Calculating route from', startLocation, 'to', destination);
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
      
      const data = await response.json();
      
      // Check if the response contains an error message
      if (!response.ok) {
        console.error('Server returned error:', data);
        
        // If the server provided a fallback route, use it
        if (data.fallbackRoute && Array.isArray(data.fallbackRoute)) {
          console.log('Using fallback route provided by server');
          setRoute(data.fallbackRoute);
          setRouteInfo({
            distance: calculateSimpleDistance(startLocation, destination),
            estimatedTime: calculateSimpleTime(startLocation, destination),
            safetyScore: 70, // Default safety score for fallback routes
            isFallback: true
          });
          setError('Using simplified route due to calculation error.');
        } else {
          throw new Error(data.message || 'Failed to calculate route');
        }
      } else {
        // Success case - use the calculated route
        console.log('Route calculated successfully:', data);
        setRoute(data.route);
        setRouteInfo({
          distance: data.distance,
          estimatedTime: data.estimatedTime,
          safetyScore: data.safetyScore,
          routeType: data.routeType || 'standard'
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      
      // Create a simple direct route as fallback
      const simpleRoute = createSimpleRoute(startLocation, destination);
      setRoute(simpleRoute);
      setRouteInfo({
        distance: calculateSimpleDistance(startLocation, destination),
        estimatedTime: calculateSimpleTime(startLocation, destination),
        safetyScore: 70, // Default safety score for fallback routes
        isFallback: true
      });
      
      setError('Failed to calculate optimal route. Using simplified route instead.');
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate simple distance between two points using Haversine formula
  const calculateSimpleDistance = (start, destination) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (destination.lat - start.lat) * Math.PI / 180;
    const dLon = (destination.lng - start.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(start.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };
  
  // Calculate simple time estimate based on distance
  const calculateSimpleTime = (start, destination) => {
    const distance = calculateSimpleDistance(start, destination);
    const averageSpeed = 40; // km/h
    return (distance / averageSpeed) * 60; // Convert to minutes
  };
  
  // Create a simple route between two points
  const createSimpleRoute = (start, destination) => {
    if (!start || !destination) return [];
    
    // Create a simple route with a few intermediate points
    const latDiff = destination.lat - start.lat;
    const lngDiff = destination.lng - start.lng;
    
    // Create 3 intermediate points
    return [
      { lat: start.lat, lng: start.lng },
      { lat: start.lat + latDiff * 0.25, lng: start.lng + lngDiff * 0.25 },
      { lat: start.lat + latDiff * 0.5, lng: start.lng + lngDiff * 0.5 },
      { lat: start.lat + latDiff * 0.75, lng: start.lng + lngDiff * 0.75 },
      { lat: destination.lat, lng: destination.lng }
    ];
  };

  // Road rating functionality removed

  // Road ratings functionality removed

  // Traffic data functionality removed

  // Handle map bounds change
  const handleBoundsChange = (bounds) => {
    // No longer fetching road ratings
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
                roadRatings={[]}
                trafficData={[]}
                onBoundsChange={handleBoundsChange}
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
