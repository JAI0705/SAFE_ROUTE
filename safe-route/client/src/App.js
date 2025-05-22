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
  const [routeSegments, setRouteSegments] = useState([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prioritizeSafety, setPrioritizeSafety] = useState(true);

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
      console.log('Safety prioritization:', prioritizeSafety ? 'Enabled' : 'Disabled');
      
      const response = await fetch('/api/routes/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: startLocation,
          destination: destination,
          prioritizeSafety: prioritizeSafety,
        }),
      });
      
      const data = await response.json();
      
      // Check if the response contains an error message
      if (!response.ok) {
        console.error('Server returned error:', data);
        throw new Error(data.message || 'Failed to calculate route');
      }
      
      // Success case - use the calculated route
      console.log('Route calculated successfully:', data);
      
      if (!data.route || !Array.isArray(data.route) || data.route.length === 0) {
        throw new Error('No route points returned from the server');
      }
      
      setRoute(data.route);
      setRouteInfo({
        distance: data.distance,
        estimatedTime: data.estimatedTime,
        safetyScore: data.safetyScore,
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

  // Handle road rating - optimized to reduce lag
  const handleRoadRating = async (roadId, coordinates, rating) => {
    // Show immediate feedback to the user
    const feedbackMessage = `Rating road as ${rating}...`;
    setError(feedbackMessage);
    
    // Use setTimeout to make the rating process non-blocking
    setTimeout(async () => {
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
        
        // Get the current map bounds
        const mapBounds = document.getElementById('mapBounds');
        let bounds = null;
        
        if (mapBounds && mapBounds.dataset) {
          bounds = {
            north: parseFloat(mapBounds.dataset.north || 90),
            south: parseFloat(mapBounds.dataset.south || -90),
            east: parseFloat(mapBounds.dataset.east || 180),
            west: parseFloat(mapBounds.dataset.west || -180)
          };
        }
        
        // Update road ratings with current bounds
        fetchRoadRatings(bounds);
        
        // Clear the feedback message
        setError(null);
        
        // Show a non-blocking success message
        const successElement = document.createElement('div');
        successElement.className = 'success-toast';
        successElement.textContent = `Road rated as ${rating} successfully!`;
        successElement.style.position = 'fixed';
        successElement.style.bottom = '20px';
        successElement.style.right = '20px';
        successElement.style.backgroundColor = '#28a745';
        successElement.style.color = 'white';
        successElement.style.padding = '10px 20px';
        successElement.style.borderRadius = '4px';
        successElement.style.zIndex = '1000';
        document.body.appendChild(successElement);
        
        // Remove the success message after 3 seconds
        setTimeout(() => {
          if (document.body.contains(successElement)) {
            document.body.removeChild(successElement);
          }
        }, 3000);
      } catch (error) {
        console.error('Error submitting road rating:', error);
        setError('Failed to submit road rating. Please try again.');
      }
    }, 0);
  };

  // Fetch road ratings
  const fetchRoadRatings = async (bounds) => {
    if (!bounds) return;
    
    try {
      console.log('Fetching road ratings with bounds:', bounds);
      const { north, south, east, west } = bounds;
      const response = await fetch(`/api/ratings/bounds?north=${north}&south=${south}&east=${east}&west=${west}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch road ratings');
      }
      
      const data = await response.json();
      console.log('Received road ratings:', data);
      setRoadRatings(data);
    } catch (error) {
      console.error('Error fetching road ratings:', error);
    }
  };
  
  // Calculate distance between two points in kilometers using the Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Create route segments of approximately 2 km each
  const createRouteSegments = (routePoints) => {
    if (!routePoints || routePoints.length < 2) {
      console.warn('Not enough points to create segments');
      return [];
    }
    
    const segments = [];
    const TARGET_SEGMENT_LENGTH_KM = 2; // Target segment length in kilometers
    
    let currentSegmentPoints = [];
    let currentSegmentDistance = 0;
    let segmentStartIndex = 0;
    
    // Add the first point to start the first segment
    currentSegmentPoints.push([routePoints[0].lat, routePoints[0].lng]);
    
    // Iterate through points to create segments of ~2km each
    for (let i = 1; i < routePoints.length; i++) {
      // Calculate distance from previous point
      const distance = calculateDistance(
        routePoints[i-1].lat, routePoints[i-1].lng,
        routePoints[i].lat, routePoints[i].lng
      );
      
      // Add point to current segment
      currentSegmentPoints.push([routePoints[i].lat, routePoints[i].lng]);
      currentSegmentDistance += distance;
      
      // If we've reached approximately 2km or the end of the route
      if (currentSegmentDistance >= TARGET_SEGMENT_LENGTH_KM || i === routePoints.length - 1) {
        // Create a segment if we have at least 2 points
        if (currentSegmentPoints.length >= 2) {
          const segmentId = `segment_${segmentStartIndex}_${i}_${Date.now()}`;
          
          segments.push({
            id: segmentId,
            points: [...currentSegmentPoints], // Create a copy of the points array
            coordinates: {
              start: {
                lat: routePoints[segmentStartIndex].lat,
                lng: routePoints[segmentStartIndex].lng
              },
              end: {
                lat: routePoints[i].lat,
                lng: routePoints[i].lng
              }
            },
            distanceKm: currentSegmentDistance.toFixed(1)
          });
          
          // Start a new segment
          segmentStartIndex = i;
          currentSegmentPoints = [[routePoints[i].lat, routePoints[i].lng]];
          currentSegmentDistance = 0;
        }
      }
    }
    
    console.log(`Created ${segments.length} road segments of ~2km each from ${routePoints.length} points`);
    return segments;
  };

  // Traffic data functionality removed

  // Handle map bounds change
  const handleBoundsChange = (bounds) => {
    fetchRoadRatings(bounds);
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {!permissionGranted ? (
          <LocationPermission onGrant={handlePermissionGrant} />
        ) : (
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
        )}
      </div>
    </div>
  );
}

export default App;
