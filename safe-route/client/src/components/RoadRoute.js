import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Polyline, useMap } from 'react-leaflet';

// Component for creating road-following routes
const RoadRoute = ({ startLocation, destination, onRouteCreated }) => {
  const [routePoints, setRoutePoints] = useState([]);
  const map = useMap();

  // Memoize the distance calculation to avoid recalculating unnecessarily
  const calculateDistanceMemo = useCallback((point1, point2) => {
    if (!point1 || !point2) return 0;
    return calculateDistance(point1, point2);
  }, []);
  
  // Create a simple route - memoized to prevent unnecessary recalculations
  const createSimpleRouteMemo = useCallback((start, end) => {
    if (!start || !end) return [];
    
    // Use fewer points for better performance
    const numPoints = 5; // Reduced from 10 for better performance
    const route = [];
    
    route.push(start);
    
    for (let i = 1; i < numPoints - 1; i++) {
      const ratio = i / numPoints;
      const lat = start.lat + (end.lat - start.lat) * ratio;
      const lng = start.lng + (end.lng - start.lng) * ratio;
      route.push({ lat, lng });
    }
    
    route.push(end);
    return route;
  }, []);
  
  // Use useMemo to only recalculate the route when inputs change
  const routeData = useMemo(() => {
    if (!startLocation || !destination) {
      return { points: [], distance: 0, duration: 0 };
    }
    
    try {
      // For performance, just use a simple route instead of complex calculations
      const simpleRoute = createSimpleRouteMemo(startLocation, destination);
      const distance = calculateDistanceMemo(startLocation, destination);
      
      return {
        points: simpleRoute,
        distance,
        duration: Math.round(distance * 2),
        routeType: 'simple'
      };
    } catch (error) {
      console.error('Error creating route:', error);
      return { points: [], distance: 0, duration: 0 };
    }
  }, [startLocation, destination, calculateDistanceMemo, createSimpleRouteMemo]);
  
  // Update state and notify parent when route data changes
  useEffect(() => {
    if (!startLocation || !destination) {
      return;
    }
    
    // Update state with the route points
    setRoutePoints(routeData.points);
    
    // Notify parent component about the route
    if (onRouteCreated) {
      onRouteCreated({
        route: routeData.points,
        distance: routeData.distance,
        duration: routeData.duration,
        routeType: routeData.routeType
      });
    }
  }, [routeData, startLocation, destination, onRouteCreated]);
  
  // Generate waypoints along a direct path between start and end
  const generateDirectWaypoints = (start, end) => {
    // Calculate the direct distance between start and end
    const distance = calculateDistance(start, end);
    
    // Determine the number of waypoints based on distance
    // More waypoints for longer distances to create a smoother route
    const numWaypoints = Math.max(10, Math.ceil(distance * 5));
    
    const waypoints = [start];
    
    // Calculate the direct vector from start to end
    const dx = end.lng - start.lng;
    const dy = end.lat - start.lat;
    const baseAngle = Math.atan2(dy, dx);
    
    // Generate waypoints with slight variations to simulate roads
    for (let i = 1; i < numWaypoints; i++) {
      const ratio = i / numWaypoints;
      
      // Add perpendicular variation to simulate road curves
      // The variation is higher in the middle of the route
      const variationFactor = Math.sin(ratio * Math.PI) * 0.2;
      const perpDistance = (Math.random() - 0.5) * distance * variationFactor;
      const perpAngle = baseAngle + Math.PI / 2;
      
      waypoints.push({
        lat: start.lat + dy * ratio + Math.sin(perpAngle) * perpDistance,
        lng: start.lng + dx * ratio + Math.cos(perpAngle) * perpDistance
      });
    }
    
    waypoints.push(end);
    return waypoints;
  };
  
  // Enhance a route with road-like patterns
  const enhanceRouteWithRoadPatterns = (waypoints) => {
    if (waypoints.length < 2) return waypoints;
    
    const enhancedRoute = [waypoints[0]];
    
    // Process each segment between waypoints
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      
      // Calculate segment properties
      const dx = curr.lng - prev.lng;
      const dy = curr.lat - prev.lat;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      // Add more detail for longer segments
      // This creates the appearance of a road following the terrain
      const numExtraPoints = Math.max(5, Math.floor(segmentLength * 1000));
      
      // Add points along this segment with small variations
      for (let j = 1; j <= numExtraPoints; j++) {
        const ratio = j / (numExtraPoints + 1);
        
        // Create small variations to simulate road curves
        // The variation is higher in the middle of each segment
        const curveFactor = Math.sin(ratio * Math.PI) * 0.0003;
        const randomAngle = Math.random() * Math.PI * 2;
        
        enhancedRoute.push({
          lat: prev.lat + dy * ratio + Math.sin(randomAngle) * curveFactor,
          lng: prev.lng + dx * ratio + Math.cos(randomAngle) * curveFactor
        });
      }
      
      enhancedRoute.push(curr);
    }
    
    return enhancedRoute;
  };
  
  // Create a simple route with intermediate points
  const createSimpleRoute = (start, end) => {
    const route = [start];
    const numPoints = 20; // More points for a smoother line
    
    for (let i = 1; i < numPoints; i++) {
      const ratio = i / numPoints;
      route.push({
        lat: start.lat + (end.lat - start.lat) * ratio,
        lng: start.lng + (end.lng - start.lng) * ratio
      });
    }
    
    route.push(end);
    return route;
  };
  
  // Calculate total distance of a route
  const calculateTotalDistance = (points) => {
    let totalDistance = 0;
    
    for (let i = 1; i < points.length; i++) {
      totalDistance += calculateDistance(points[i - 1], points[i]);
    }
    
    return totalDistance;
  };
  
  // Calculate distance between two points using Haversine formula
  const calculateDistance = (start, end) => {
    const R = 6371; // Earth's radius in km
    const dLat = (end.lat - start.lat) * Math.PI / 180;
    const dLon = (end.lng - start.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(start.lat * Math.PI / 180) * Math.cos(end.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  // Don't render anything if no route points
  if (routePoints.length === 0) {
    return null;
  }
  
  // Validate route points to prevent rendering issues
  const validRoutePoints = routePoints.filter(point => {
    // Check if point has valid lat/lng values
    return point && 
           typeof point.lat === 'number' && !isNaN(point.lat) &&
           typeof point.lng === 'number' && !isNaN(point.lng) &&
           Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  });
  
  // Don't render if we don't have at least 2 valid points
  if (validRoutePoints.length < 2) {
    console.log('Not enough valid route points to render a route');
    return null;
  }
  
  // Render the route as a polyline
  return (
    <>
      {/* Route outline for better visibility */}
      <Polyline
        positions={validRoutePoints.map(point => [point.lat, point.lng])}
        color="#004080"
        weight={10}
        opacity={0.4}
        smoothFactor={1}
      />
      
      {/* Main route */}
      <Polyline
        positions={validRoutePoints.map(point => [point.lat, point.lng])}
        color="#0066cc"
        weight={6}
        opacity={0.8}
        smoothFactor={1}
        dashArray={null}
      />
    </>
  );
};

export default RoadRoute;
