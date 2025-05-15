import React, { useEffect, useState } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  useMap, 
  Polyline,
  useMapEvents
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom marker icons
const createCustomIcon = (type) => {
  return L.divIcon({
    className: `custom-marker-icon ${type}`,
    html: type === 'user' ? 
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>' :
      type === 'start' ?
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>' :
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18px" height="18px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });
};

// Component to handle map events
const MapEvents = ({ onBoundsChange }) => {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    },
    zoomend: () => {
      const bounds = map.getBounds();
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
    }
  });
  
  return null;
};

// Component to center map on user location
const CenterMap = ({ position }) => {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], 13, {
        animate: true,
        duration: 1.5
      });
    }
  }, [map, position]);
  
  return null;
};

const MapView = ({ 
  userLocation, 
  startLocation,
  destination, 
  route, 
  roadRatings, 
  trafficData, 
  onBoundsChange, 
  onRoadRating 
}) => {
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Default center of India
  const [mapZoom, setMapZoom] = useState(5);
  const [selectedRoad, setSelectedRoad] = useState(null);

  // Update map center when user location is available
  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
      setMapZoom(13);
    }
  }, [userLocation]);
  
  // Update map center when start location is selected
  useEffect(() => {
    if (startLocation) {
      setMapCenter([startLocation.lat, startLocation.lng]);
      setMapZoom(13);
    }
  }, [startLocation]);

  // Handle road click for rating
  const handleRoadClick = (event, roadSegment) => {
    // Prevent map click event
    L.DomEvent.stopPropagation(event);
    
    setSelectedRoad(roadSegment);
  };

  // Submit road rating
  const submitRoadRating = (rating) => {
    if (selectedRoad) {
      onRoadRating(
        selectedRoad.id || `road_${Date.now()}`,
        selectedRoad.coordinates,
        rating
      );
      setSelectedRoad(null);
    }
  };

  // Get color based on traffic status
  const getTrafficColor = (status) => {
    switch (status) {
      case 'Smooth': return '#28a745';
      case 'Moderate': return '#ffc107';
      case 'Congested': return '#dc3545';
      default: return '#ffc107';
    }
  };

  return (
    <div className="map-container">
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Map events handler */}
        <MapEvents onBoundsChange={onBoundsChange} />
        
        {/* Center map on user location */}
        {userLocation && <CenterMap position={userLocation} />}
        
        {/* User location marker */}
        {userLocation && !startLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]} 
            icon={createCustomIcon('user')}
          >
            <Popup>
              <div className="text-center">
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
          >
            <Popup>
              <div className="text-center">
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
          >
            <Popup>
              <div className="text-center">
                <strong>Destination</strong>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Route polyline */}
        {route && (
          <Polyline 
            positions={route.map(point => [point.lat, point.lng])}
            color="#0078ff"
            weight={6}
            opacity={0.7}
          />
        )}
        
        {/* Road ratings */}
        {roadRatings.map((rating, index) => (
          <Polyline 
            key={`rating-${index}`}
            positions={[
              [rating.coordinates.start.lat, rating.coordinates.start.lng],
              [rating.coordinates.end.lat, rating.coordinates.end.lng]
            ]}
            color={rating.rating === 'Good' ? '#28a745' : '#dc3545'}
            weight={5}
            opacity={0.6}
            eventHandlers={{
              click: (e) => handleRoadClick(e.originalEvent, rating)
            }}
          >
            <Popup>
              <div className="road-rating-popup">
                <p className="font-semibold mb-2">Road Quality: {rating.rating}</p>
                <p className="text-sm mb-2">Traffic: {rating.trafficStatus}</p>
                <div className="flex justify-between">
                  <button 
                    className="good"
                    onClick={() => submitRoadRating('Good')}
                  >
                    Good
                  </button>
                  <button 
                    className="bad"
                    onClick={() => submitRoadRating('Bad')}
                  >
                    Bad
                  </button>
                </div>
              </div>
            </Popup>
          </Polyline>
        ))}
        
        {/* Traffic data */}
        {trafficData.map((segment, index) => (
          <Polyline 
            key={`traffic-${index}`}
            positions={[
              [segment.coordinates.start.lat, segment.coordinates.start.lng],
              [segment.coordinates.end.lat, segment.coordinates.end.lng]
            ]}
            color={getTrafficColor(segment.trafficStatus)}
            weight={4}
            opacity={0.7}
            dashArray="5, 10"
          >
            <Popup>
              <div className="text-center">
                <p className="font-semibold">Traffic Status</p>
                <p className={`text-sm ${
                  segment.trafficStatus === 'Smooth' ? 'text-success' : 
                  segment.trafficStatus === 'Moderate' ? 'text-warning' : 
                  'text-danger'
                }`}>
                  {segment.trafficStatus}
                </p>
              </div>
            </Popup>
          </Polyline>
        ))}
        
        {/* Road click for rating */}
        {selectedRoad && (
          <Popup
            position={[
              (selectedRoad.coordinates.start.lat + selectedRoad.coordinates.end.lat) / 2,
              (selectedRoad.coordinates.start.lng + selectedRoad.coordinates.end.lng) / 2
            ]}
            onClose={() => setSelectedRoad(null)}
          >
            <div className="road-rating-popup">
              <p className="font-semibold mb-2">Rate this road:</p>
              <div className="flex justify-between">
                <button 
                  className="good"
                  onClick={() => submitRoadRating('Good')}
                >
                  Good
                </button>
                <button 
                  className="bad"
                  onClick={() => submitRoadRating('Bad')}
                >
                  Bad
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
