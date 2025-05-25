import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  useMap, 
  Polyline,
  useMapEvents,
  CircleMarker,
  GeoJSON
} from 'react-leaflet';
import './MapView.css';
import '../styles/responsive.css';
import L from 'leaflet';

// Custom icons for markers
const createCustomIcon = (type) => {
  // Use modern SVG icons
  const iconUrl = type === 'user' 
    ? '/icons/user-location.svg' 
    : type === 'start' 
      ? '/icons/start-marker.svg'
      : '/icons/destination-marker.svg';
  
  // Configure icon size and anchor based on type
  let iconSize, iconAnchor, popupAnchor;
  
  if (type === 'user') {
    // User location is a circular marker
    iconSize = [40, 40];
    iconAnchor = [20, 20]; // Center of the circle
    popupAnchor = [0, -15];
  } else {
    // Start and destination are pin shapes
    iconSize = [40, 40];
    iconAnchor = [20, 36]; // Bottom of the pin
    popupAnchor = [0, -25];
  }
  
  return L.icon({
    iconUrl,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
    popupAnchor: popupAnchor,
    className: `custom-marker-icon ${type}-marker` // Add specific class for styling
  });
};

// Component to center map on a position
const CenterMap = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], 13);
    }
  }, [map, position]);
  return null;
};

// Component to handle map events
const MapEvents = ({ onBoundsChange }) => {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onBoundsChange && onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    }
  });
  return null;
};

const MapView = ({ 
  userLocation, 
  startLocation, 
  setStartLocation, 
  destination, 
  setDestination, 
  route, 
  routeSegments = [],
  onRouteUpdate,
  onRateRoad
}) => {
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Center of India
  const [mapZoom, setMapZoom] = useState(5);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const mapRef = useRef(null);
  
  // Update map center when user location changes
  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(13);
    }
  }, [userLocation]);
  
  // Handle map click for setting start and destination
  const handleMapClick = useCallback((e) => {
    const { lat, lng } = e.latlng;
    
    if (!startLocation) {
      setStartLocation({ lat, lng });
    } else if (!destination) {
      setDestination({ lat, lng });
    }
  }, [startLocation, destination, setStartLocation, setDestination]);
  
  // Handle route click
  const handleRouteClick = useCallback((e) => {
    console.log('Route clicked at:', e.latlng);
  }, []);
  
  // Handle bounds change
  const handleBoundsChange = useCallback((bounds) => {
    // This can be used to fetch road ratings for the visible area
    console.log('Map bounds changed:', bounds);
  }, []);
  
  // Handle rating a road segment
  const handleRateRoad = useCallback((segmentId, rating) => {
    if (onRateRoad && segmentId) {
      onRateRoad(segmentId, rating);
      setSelectedRoad(null);
    }
  }, [onRateRoad]);
  
  // Function to calculate distance between two points in kilometers
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };
  
  // Function to create 2km segments from a GeoJSON LineString
  const createSegmentsFromGeoJSON = useCallback((geometry, segmentLengthKm = 2) => {
    if (!geometry || geometry.type !== 'LineString' || !geometry.coordinates || geometry.coordinates.length < 2) {
      console.error('Invalid GeoJSON geometry for segmentation');
      return [];
    }
    
    const coordinates = geometry.coordinates;
    const segments = [];
    let currentSegment = [];
    let segmentDistance = 0;
    let segmentId = 1;
    
    // Add the first point to the current segment
    currentSegment.push(coordinates[0]);
    
    // Process all coordinates to create segments
    for (let i = 1; i < coordinates.length; i++) {
      const prevCoord = coordinates[i-1];
      const currentCoord = coordinates[i];
      
      // Calculate distance between these two points
      const pointDistance = calculateDistance(
        prevCoord[1], prevCoord[0], // [lng, lat] to [lat, lng]
        currentCoord[1], currentCoord[0]
      );
      
      // If adding this point would exceed the segment length
      if (segmentDistance + pointDistance > segmentLengthKm) {
        // Calculate how far along the line we need to go to reach exactly segmentLengthKm
        const remainingDistance = segmentLengthKm - segmentDistance;
        const ratio = remainingDistance / pointDistance;
        
        // Interpolate a point at exactly segmentLengthKm distance
        const interpolatedPoint = [
          prevCoord[0] + (currentCoord[0] - prevCoord[0]) * ratio,
          prevCoord[1] + (currentCoord[1] - prevCoord[1]) * ratio
        ];
        
        // Add the interpolated point to complete the current segment
        currentSegment.push(interpolatedPoint);
        
        // Create the segment object
        segments.push({
          id: `segment-${segmentId}`,
          coordinates: {
            start: { lng: currentSegment[0][0], lat: currentSegment[0][1] },
            end: { lng: interpolatedPoint[0], lat: interpolatedPoint[1] }
          },
          distance: segmentLengthKm,
          points: currentSegment,
          rating: 'Unknown',
          ratingCount: 0,
          goodRatingCount: 0,
          badRatingCount: 0
        });
        
        // Start a new segment from the interpolated point
        currentSegment = [interpolatedPoint];
        segmentDistance = 0;
        segmentId++;
        
        // Now add the current point and calculate the remaining distance
        const remainingPointDistance = calculateDistance(
          interpolatedPoint[1], interpolatedPoint[0],
          currentCoord[1], currentCoord[0]
        );
        
        currentSegment.push(currentCoord);
        segmentDistance += remainingPointDistance;
      } else {
        // Add the point to the current segment
        currentSegment.push(currentCoord);
        segmentDistance += pointDistance;
      }
    }
    
    // If we have a partial segment at the end, add it
    if (currentSegment.length > 1 && segmentDistance > 0.1) {
      segments.push({
        id: `segment-${segmentId}`,
        coordinates: {
          start: { lng: currentSegment[0][0], lat: currentSegment[0][1] },
          end: { lng: currentSegment[currentSegment.length-1][0], lat: currentSegment[currentSegment.length-1][1] }
        },
        distance: segmentDistance,
        points: currentSegment,
        rating: 'Unknown',
        ratingCount: 0,
        goodRatingCount: 0,
        badRatingCount: 0
      });
    }
    
    console.log(`Created ${segments.length} segments of exactly ${segmentLengthKm}km each from route with ${coordinates.length} points`);
    return segments;
  }, []);
  
  // Function to fetch a route directly from OSRM API
  const fetchOsrmRoute = useCallback(async (start, end) => {
    if (!start || !end) return null;
    
    try {
      // Format coordinates for OSRM (lng,lat format)
      const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
      
      // Build URL with detailed parameters to ensure accurate road following
      const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=false&annotations=true`;
      
      console.log('Fetching route directly from OSRM API:', url);
      
      // Make request to OSRM API
      const response = await axios.get(url, {
        timeout: 15000, // 15 second timeout
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status !== 200 || !response.data || !response.data.routes || response.data.routes.length === 0) {
        console.error('Invalid OSRM response:', response.data);
        return null;
      }
      
      const osrmRoute = response.data.routes[0];
      console.log('OSRM route received:', osrmRoute);
      
      // Return the GeoJSON feature
      return {
        type: 'Feature',
        properties: {
          distance: osrmRoute.distance,
          duration: osrmRoute.duration,
          source: 'osrm-direct'
        },
        geometry: osrmRoute.geometry
      };
    } catch (error) {
      console.error('Error fetching OSRM route:', error);
      return null;
    }
  }, []);
  
  // State for the direct OSRM route
  const [directRouteGeoJSON, setDirectRouteGeoJSON] = useState(null);
  const [routeSegmentsFromGeoJSON, setRouteSegmentsFromGeoJSON] = useState([]);
  
  // Fetch direct route when start and destination change
  useEffect(() => {
    if (startLocation && destination) {
      // Clear any existing route data when fetching a new route
      setDirectRouteGeoJSON(null);
      setRouteSegmentsFromGeoJSON([]);
      
      fetchOsrmRoute(startLocation, destination)
        .then(geoJson => {
          if (geoJson) {
            console.log('Setting direct OSRM route GeoJSON');
            
            // Always create exactly 2km segments from the GeoJSON route
            const segments = createSegmentsFromGeoJSON(geoJson.geometry, 2);
            console.log(`Created ${segments.length} segments of exactly 2km each`);
            
            // Set the segments
            setRouteSegmentsFromGeoJSON(segments);
            
            // Set the direct route GeoJSON
            setDirectRouteGeoJSON(geoJson);
            
            // Update parent component with the segments for potential server-side storage
            if (onRouteUpdate) {
              onRouteUpdate(segments);
            }
          }
        })
        .catch(error => console.error('Failed to fetch direct route:', error));
    }
  }, [startLocation, destination, fetchOsrmRoute, createSegmentsFromGeoJSON, onRouteUpdate]);
  
  // Memoize segment handling to prevent unnecessary rerenders
  const handleSegmentClickMemo = useCallback((segment) => {
    console.log('Segment clicked:', segment);
    setSelectedRoad(segment);
  }, []);
  
  return (
    <div className="map-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        ref={mapRef}
        onClick={handleMapClick}
      >
        {/* Base map layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Map events handler */}
        <MapEvents onBoundsChange={handleBoundsChange} />
        
        {/* Center map on user location */}
        {userLocation && <CenterMap position={userLocation} />}
        
        {/* User location marker - only shown when no route is created */}
        {userLocation && !route && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={createCustomIcon('user')}
            zIndexOffset={2000} // Highest z-index to ensure it's always on top
          >
            <Popup>
              <div>
                <strong>Your Location</strong>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Start location marker */}
        {startLocation && (
          <Marker 
            position={[startLocation.lat, startLocation.lng]}
            icon={createCustomIcon('start')}
            zIndexOffset={1800} // Very high z-index
          >
            <Popup>
              <div>
                <strong>Start Location</strong>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Destination marker */}
        {destination && (
          <Marker 
            position={[destination.lat, destination.lng]}
            icon={createCustomIcon('destination')}
            zIndexOffset={1800} // Very high z-index
          >
            <Popup>
              <div>
                <strong>Destination</strong>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Only render the direct OSRM route with GeoJSON for accurate road following */}
        {directRouteGeoJSON && (
          <GeoJSON 
            data={directRouteGeoJSON}
            style={() => ({
              color: '#006400', // Dark green color
              weight: 6, // Increased weight for better visibility
              opacity: 0.8, // Increased opacity
              dashArray: null // Solid line
            })}
            eventHandlers={{
              click: handleRouteClick
            }}
          />
        )}
        
        {/* 2km Route segments for rating */}
        {routeSegmentsFromGeoJSON.map((segment, index) => (
          <Polyline
            key={segment.id}
            positions={segment.points.map(point => [point[1], point[0]])}
            color={segment.rating === 'Good' ? '#4CAF50' : 
                  segment.rating === 'Bad' ? '#F44336' : 
                  '#006400'} // Dark green for unrated segments
            weight={6} // Increased weight for better visibility
            opacity={0.9} // Increased opacity
            className="route-segment" // Added class for additional CSS styling
            eventHandlers={{
              click: () => handleSegmentClickMemo(segment),
              mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({
                  weight: 8,
                  opacity: 1
                });
              },
              mouseout: (e) => {
                const layer = e.target;
                layer.setStyle({
                  weight: 6,
                  opacity: 0.9
                });
              }
            }}
          />
        ))}
        
        {/* Road rating popup with enhanced information */}
        {selectedRoad && (
          <Popup
            position={[
              (selectedRoad.coordinates.start.lat + selectedRoad.coordinates.end.lat) / 2,
              (selectedRoad.coordinates.start.lng + selectedRoad.coordinates.end.lng) / 2
            ]}
            onClose={() => setSelectedRoad(null)}
            className="segment-rating-popup"
          >
            <div className="road-rating-popup">
              <h4>2km Road Segment Rating</h4>
              
              {/* Show segment details */}
              <div className="segment-details">
                <p><strong>Segment ID:</strong> {selectedRoad.id}</p>
                <p><strong>Distance:</strong> {selectedRoad.distance.toFixed(2)} km</p>
                <p><strong>Current Rating:</strong> {selectedRoad.rating || 'Not rated'}</p>
                <p><strong>Rating Count:</strong> {selectedRoad.ratingCount || 0}</p>
                <p><strong>Good Ratings:</strong> {selectedRoad.goodRatingCount || 0}</p>
                <p><strong>Bad Ratings:</strong> {selectedRoad.badRatingCount || 0}</p>
              </div>
              
              {/* Rating buttons */}
              <div className="rating-buttons">
                <button 
                  className="good-button"
                  onClick={() => handleRateRoad(selectedRoad.id, 'Good')}
                >
                  Good Road
                </button>
                <button 
                  className="bad-button"
                  onClick={() => handleRateRoad(selectedRoad.id, 'Bad')}
                >
                  Bad Road
                </button>
              </div>
            </div>
          </Popup>
        )}
      </MapContainer>
    </div>
  );
};

export default MapView;
