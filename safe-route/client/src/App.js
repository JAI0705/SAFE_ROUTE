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
import { mockCities } from './firebase/config';

// Import Firebase services
import { calculateRoute as firebaseCalculateRoute } from './firebase/firebaseService';
// Import route service for accurate road-following routes
import { calculateRoute as apiCalculateRoute } from './firebase/routeService';

// Error Boundary component to prevent the entire app from crashing
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorType: 'general' // Can be 'general', 'route', 'map', etc.
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    let errorType = 'general';
    
    // Try to identify the type of error
    if (error.message && error.message.includes('route')) {
      errorType = 'route';
    } else if (error.message && error.message.includes('map')) {
      errorType = 'map';
    } else if (error.message && error.message.includes('network')) {
      errorType = 'network';
    }
    
    return { hasError: true, errorType };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('Error caught by error boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }
  
  // Method to reset the error state
  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      // Get appropriate error message based on error type
      let errorTitle = 'Something went wrong';
      let errorMessage = 'We\'re sorry, but there was an error loading this page.';
      
      if (this.state.errorType === 'route') {
        errorTitle = 'Route Calculation Error';
        errorMessage = 'There was a problem calculating the route. This could be due to network issues or unavailable routing services.';
      } else if (this.state.errorType === 'map') {
        errorTitle = 'Map Loading Error';
        errorMessage = 'There was a problem loading the map. Please check your internet connection and try again.';
      } else if (this.state.errorType === 'network') {
        errorTitle = 'Network Error';
        errorMessage = 'There was a problem connecting to our services. Please check your internet connection and try again.';
      }
      
      // Fallback UI when an error occurs
      return (
        <div className="error-boundary" style={{ padding: '20px', textAlign: 'center', color: '#721c24', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '5px', margin: '20px' }}>
          <h2>{errorTitle}</h2>
          <p>{errorMessage}</p>
          <p>Please try refreshing the page or try again later.</p>
          <details style={{ whiteSpace: 'pre-wrap', textAlign: 'left', marginTop: '10px' }}>
            <summary>Show error details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <div style={{ marginTop: '15px' }}>
            <button 
              onClick={this.resetError} 
              style={{ marginRight: '10px', padding: '8px 16px', backgroundColor: '#0275d8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Try Again
            </button>
            <button 
              onClick={() => window.location.reload()} 
              style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Refresh Page
            </button>
          </div>
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
    // Show loading state immediately to provide feedback
    setLoading(true);
    
    // Use setTimeout to ensure the UI updates before starting the heavy operation
    setTimeout(() => {
      setDestination(coords);
      // Don't automatically calculate the route
      // Let the user click the calculate button instead
      setRoute(null);
      setRouteInfo(null);
      setLoading(false);
    }, 10);
  };

  // Calculate route using Firebase service with simplified error handling
  const calculateRoute = async () => {
    if (!startLocation || !destination) {
      console.log('Missing start or destination, cannot calculate route');
      setError('Please select both start and destination locations');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Create a local variable to track if this calculation is still relevant
    const calculationId = Date.now();
    // Store this ID to check if a newer calculation has started
    window.latestCalculationId = calculationId;
    
    try {
      console.log('Calculating route from', startLocation, 'to', destination);
      console.log('Safety prioritization:', prioritizeSafety ? 'Enabled' : 'Disabled');
      
      // Show initial loading state
      setRouteInfo({ 
        status: 'Preparing route calculation...', 
        phase: 'init',
        progress: 10
      });
      
      // Defensive programming - ensure we have valid coordinates
      if (!startLocation.lat || !startLocation.lng || !destination.lat || !destination.lng) {
        setLoading(false);
        setError('Invalid coordinates in start or destination');
        return;
      }
      
      // Update loading message
      setRouteInfo({ 
        status: 'Calculating route...', 
        phase: 'processing',
        progress: 50
      });
      
      // Use the new routeService for accurate road-following routes
      let routeData = null;
      try {
        // First try the direct API route calculation for accurate road following
        setRouteInfo({ 
          status: 'Fetching route from routing API...', 
          phase: 'api',
          progress: 40
        });
        
        routeData = await apiCalculateRoute(startLocation, destination);
        
        // Check if this calculation is still the most recent one
        if (window.latestCalculationId !== calculationId) {
          console.log('A newer route calculation has started, discarding results');
          setLoading(false);
          return;
        }
        
        if (routeData) {
          console.log('Route data returned from API:', routeData);
        } else {
          // If API route calculation fails, fall back to Firebase route
          setRouteInfo({ 
            status: 'API route failed, using fallback...', 
            phase: 'fallback',
            progress: 60
          });
          
          routeData = await firebaseCalculateRoute(startLocation, destination, prioritizeSafety);
          
          // Check if this calculation is still the most recent one
          if (window.latestCalculationId !== calculationId) {
            console.log('A newer route calculation has started, discarding results');
            setLoading(false);
            return;
          }
          
          console.log('Fallback route data returned:', routeData);
        }
      } catch (error) {
        console.error('Route calculation error:', error);
        
        // Check if this calculation is still the most recent one
        if (window.latestCalculationId !== calculationId) {
          console.log('A newer route calculation has started, discarding error');
          setLoading(false);
          return;
        }
        
        setLoading(false);
        setError(`Route calculation failed: ${error.message}`);
        return;
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
        
        // Process route segments - use server-provided segments if available
        console.log('Processing route segments');
        try {
          // Use the processRouteSegments function to handle server or client segments
          const segments = processRouteSegments(routeData);
          console.log('Processed segments:', segments.length);
          setRouteSegments(segments);
          
          // If we have a safety score from the server, use it
          if (routeData.safetyScore) {
            console.log(`Using server-provided safety score: ${routeData.safetyScore}`);
          } else {
            // Otherwise calculate a safety score based on segments
            const safetyScore = calculateSafetyScoreFromSegments(segments);
            console.log(`Calculated client-side safety score: ${safetyScore}`);
            routeData.safetyScore = safetyScore;
          }
        } catch (segmentError) {
          console.error('Error processing route segments:', segmentError);
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

  // Handle road rating - enhanced to store ratings on server and use them for future route calculations
  const handleRoadRating = async (roadId, coordinates, rating) => {
    try {
      console.log(`Rating road ${roadId} at coordinates ${JSON.stringify(coordinates)} with rating ${rating}`);
      
      // Find the road segment
      const segment = routeSegments.find(seg => seg.id === roadId);
      
      if (!segment) {
        console.error(`Road segment with ID ${roadId} not found`);
        return;
      }
      
      // Create a road rating object
      const ratingData = {
        id: roadId,
        coordinates,
        rating,
        ratingCount: 1,
        badRatingCount: rating === 'Bad' ? 1 : 0,
        goodRatingCount: rating === 'Good' ? 1 : 0,
        updatedAt: new Date().toISOString(),
        // Store geographic area for easier querying
        area: {
          north: Math.max(coordinates.start.lat, coordinates.end.lat) + 0.01,
          south: Math.min(coordinates.start.lat, coordinates.end.lat) - 0.01,
          east: Math.max(coordinates.start.lng, coordinates.end.lng) + 0.01,
          west: Math.min(coordinates.start.lng, coordinates.end.lng) - 0.01
        }
      };
      
      const updatedRoadRatings = [...roadRatings];
      
      // Check if this road has already been rated
      const existingRatingIndex = updatedRoadRatings.findIndex(r => r.id === roadId);
      
      if (existingRatingIndex !== -1) {
        // Update existing rating
        const existingRating = updatedRoadRatings[existingRatingIndex];
        
        // Update rating counts
        const newRatingCount = (existingRating.ratingCount || 0) + 1;
        const newBadRatingCount = rating === 'Bad' 
          ? (existingRating.badRatingCount || 0) + 1 
          : (existingRating.badRatingCount || 0);
        const newGoodRatingCount = rating === 'Good' 
          ? (existingRating.goodRatingCount || 0) + 1 
          : (existingRating.goodRatingCount || 0);
        
        // Calculate the majority rating
        const majorityRating = newBadRatingCount > newRatingCount / 2 ? 'Bad' : 'Good';
        
        updatedRoadRatings[existingRatingIndex] = {
          ...existingRating,
          rating: majorityRating, // Set to majority rating
          ratingCount: newRatingCount,
          badRatingCount: newBadRatingCount,
          goodRatingCount: newGoodRatingCount,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Add new rating
        updatedRoadRatings.push(ratingData);
      }
      
      // Update state
      setRoadRatings(updatedRoadRatings);
      
      // Update the segment in the route segments array
      const updatedSegments = routeSegments.map(seg => {
        if (seg.id === roadId) {
          const newRatingCount = (seg.ratingCount || 0) + 1;
          const newBadRatingCount = rating === 'Bad' ? (seg.badRatingCount || 0) + 1 : (seg.badRatingCount || 0);
          const newGoodRatingCount = rating === 'Good' ? (seg.goodRatingCount || 0) + 1 : (seg.goodRatingCount || 0);
          
          // Calculate majority rating
          const majorityRating = newBadRatingCount > newRatingCount / 2 ? 'Bad' : 'Good';
          
          return {
            ...seg,
            rating: majorityRating,
            ratingCount: newRatingCount,
            badRatingCount: newBadRatingCount,
            goodRatingCount: newGoodRatingCount
          };
        } else {
          return seg;
        }
      });
      
      setRouteSegments(updatedSegments);
      
      // Save rating using Firebase service
      try {
        // Import the addRoadRating function
        const { addRoadRating } = await import('./firebase/firebaseService');
        
        // Send the rating data to Firebase
        const result = await addRoadRating(ratingData);
        
        if (result && result.success) {
          console.log('Rating saved successfully to Firebase');
        } else {
          throw new Error(`Firebase error: ${result?.error || 'Unknown error'}`);
        }
      } catch (apiError) {
        console.error('Error saving rating to Firebase:', apiError);
        // Continue even if Firebase save fails - we've already updated the local state
      }
    } catch (error) {
      console.error('Error handling road rating:', error);
    }
  };

  // Fetch road ratings
  const fetchRoadRatings = async (bounds) => {
    try {
      console.log('Fetching road ratings for bounds:', bounds);
      
      // Import the getAllRoadRatings function
      const { getAllRoadRatings } = await import('./firebase/firebaseService');
      
      // Use the Firebase service to get road ratings
      const ratings = await getAllRoadRatings();
      console.log('Received road ratings:', ratings.length);
      
      if (ratings && Array.isArray(ratings)) {
        setRoadRatings(ratings);
      } else {
        console.error('Invalid road ratings data format:', ratings);
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
  
  // Use server-provided segments if available, otherwise create them client-side
  const processRouteSegments = (routeData) => {
    // If the server has already provided segments, use those
    if (routeData.segments && Array.isArray(routeData.segments) && routeData.segments.length > 0) {
      console.log(`Using ${routeData.segments.length} segments provided by the server`);
      
      // Apply any existing ratings from our local state
      const enhancedSegments = routeData.segments.map(segment => {
        // Look for existing rating for this segment ID
        const existingRating = roadRatings.find(r => r.id === segment.id);
        
        if (existingRating) {
          return {
            ...segment,
            rating: existingRating.rating,
            ratingCount: existingRating.ratingCount || 0,
            badRatingCount: existingRating.badRatingCount || 0,
            goodRatingCount: existingRating.goodRatingCount || 0
          };
        }
        
        return segment;
      });
      
      return enhancedSegments;
    }
    
    // Otherwise, create segments on the client side
    return createRouteSegments(routeData.route);
  };
  
  // Create route segments of exactly 2 km each for user rating
  const createRouteSegments = (routePoints) => {
    if (!routePoints || routePoints.length < 2) {
      console.warn('Not enough points to create route segments');
      return [];
    }
    
    console.log('Creating route segments from', routePoints.length, 'points');
    
    const segments = [];
    let currentSegmentStart = routePoints[0];
    let currentSegmentDistance = 0;
    let segmentPoints = [currentSegmentStart];
    let segmentId = 0;
    
    // Create a unique ID for each segment based on coordinates
    const createSegmentId = (start, end) => {
      return `segment-${segmentId++}-${start.lat.toFixed(4)}-${start.lng.toFixed(4)}-${end.lat.toFixed(4)}-${end.lng.toFixed(4)}`;
    };
    
    // Ensure we have valid coordinates
    const validPoints = routePoints.filter(point => 
      point && typeof point.lat === 'number' && typeof point.lng === 'number'
    );
    
    if (validPoints.length < 2) {
      console.warn('Not enough valid points to create route segments');
      return [];
    }
    
    // Calculate total route distance for logging
    let totalRouteDistance = 0;
    for (let i = 1; i < validPoints.length; i++) {
      totalRouteDistance += calculateDistance(
        validPoints[i-1].lat, validPoints[i-1].lng,
        validPoints[i].lat, validPoints[i].lng
      );
    }
    console.log(`Total route distance: ${totalRouteDistance.toFixed(2)} km`);
    
    // Reset with first valid point
    currentSegmentStart = validPoints[0];
    segmentPoints = [currentSegmentStart];
    
    for (let i = 1; i < validPoints.length; i++) {
      const point = validPoints[i];
      const prevPoint = validPoints[i-1];
      
      // Calculate distance between this point and the previous one
      const pointDistance = calculateDistance(
        prevPoint.lat, prevPoint.lng,
        point.lat, point.lng
      );
      
      // Add this point to the current segment
      segmentPoints.push(point);
      currentSegmentDistance += pointDistance;
      
      // If we've reached the target segment length (2km) or this is the last point
      if (currentSegmentDistance >= 2 || i === validPoints.length - 1) {
        // If we've exceeded 2km by a significant amount and this isn't the last point,
        // we need to create an interpolated point at exactly 2km
        if (currentSegmentDistance > 2.1 && i < validPoints.length - 1) {
          // Calculate how much we've exceeded 2km
          const excess = currentSegmentDistance - 2.0;
          
          // Remove the last point from the segment
          segmentPoints.pop();
          
          // Calculate the ratio of the distance we need to go back
          const ratio = excess / pointDistance;
          
          // Create an interpolated point at exactly 2km from the start
          const interpolatedPoint = {
            lat: point.lat - (point.lat - prevPoint.lat) * ratio,
            lng: point.lng - (point.lng - prevPoint.lng) * ratio
          };
          
          // Add the interpolated point to the segment
          segmentPoints.push(interpolatedPoint);
          
          // Create the segment with exactly 2km distance
          segments.push({
            id: createSegmentId(currentSegmentStart, interpolatedPoint),
            coordinates: {
              start: currentSegmentStart,
              end: interpolatedPoint
            },
            points: [...segmentPoints],
            distanceKm: 2.0,
            rating: null, // Will store user rating (Good/Bad)
            ratingCount: 0, // Count of ratings
            badRatingCount: 0, // Count of bad ratings
            goodRatingCount: 0 // Count of good ratings
          });
          
          // Start a new segment from the interpolated point
          currentSegmentStart = interpolatedPoint;
          currentSegmentDistance = excess;
          segmentPoints = [currentSegmentStart, point];
        } else {
          // Create a segment with the current distance
          segments.push({
            id: createSegmentId(currentSegmentStart, point),
            coordinates: {
              start: currentSegmentStart,
              end: point
            },
            points: [...segmentPoints],
            distanceKm: parseFloat(currentSegmentDistance.toFixed(2)),
            rating: null, // Will store user rating (Good/Bad)
            ratingCount: 0, // Count of ratings
            badRatingCount: 0, // Count of bad ratings
            goodRatingCount: 0 // Count of good ratings
          });
          
          // Start a new segment
          currentSegmentStart = point;
          currentSegmentDistance = 0;
          segmentPoints = [currentSegmentStart];
        }
      }
    }
    
    console.log(`Created ${segments.length} road segments of ~2km each from ${validPoints.length} points`);
    return segments;
  };
  
  // Calculate safety score based on segment ratings
  const calculateSafetyScoreFromSegments = (segments) => {
    if (!segments || segments.length === 0) {
      return 75; // Default safety score if no segments
    }
    
    // Count segments with ratings
    const ratedSegments = segments.filter(s => s.rating !== null);
    
    if (ratedSegments.length === 0) {
      return 75; // Default if no segments have ratings
    }
    
    // Count bad segments
    const badSegments = ratedSegments.filter(s => s.rating === 'Bad');
    
    // Calculate safety score based on percentage of bad segments
    const badSegmentPercentage = (badSegments.length / ratedSegments.length) * 100;
    const safetyScore = Math.max(30, 100 - badSegmentPercentage);
    
    console.log(`Calculated safety score: ${safetyScore.toFixed(2)} based on ${badSegments.length} bad segments out of ${ratedSegments.length} rated segments`);
    
    return parseFloat(safetyScore.toFixed(2));
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
                  <p><strong>Distance:</strong> {routeInfo.distance !== undefined && typeof routeInfo.distance === 'number' ? routeInfo.distance.toFixed(2) : '0.00'} km</p>
                  <p><strong>Estimated Time:</strong> {routeInfo.estimatedTime !== undefined && typeof routeInfo.estimatedTime === 'number' ? routeInfo.estimatedTime.toFixed(0) : '0'} minutes</p>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    backgroundColor: routeInfo.safetyScore !== undefined && routeInfo.safetyScore > 80 ? '#d4edda' : routeInfo.safetyScore !== undefined && routeInfo.safetyScore > 60 ? '#fff3cd' : '#f8d7da',
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
