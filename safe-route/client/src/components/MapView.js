import React, { useEffect, useState } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  useMap, 
  Polyline,
  useMapEvents,
  CircleMarker
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
      const boundsData = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      };
      
      // Store bounds in a hidden element for access from outside the component
      const mapBoundsEl = document.getElementById('mapBounds');
      if (mapBoundsEl) {
        mapBoundsEl.dataset.north = boundsData.north;
        mapBoundsEl.dataset.south = boundsData.south;
        mapBoundsEl.dataset.east = boundsData.east;
        mapBoundsEl.dataset.west = boundsData.west;
      }
      
      onBoundsChange(boundsData);
    },
    zoomend: () => {
      const bounds = map.getBounds();
      const boundsData = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      };
      
      // Store bounds in a hidden element for access from outside the component
      const mapBoundsEl = document.getElementById('mapBounds');
      if (mapBoundsEl) {
        mapBoundsEl.dataset.north = boundsData.north;
        mapBoundsEl.dataset.south = boundsData.south;
        mapBoundsEl.dataset.east = boundsData.east;
        mapBoundsEl.dataset.west = boundsData.west;
      }
      
      onBoundsChange(boundsData);
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
  routeSegments,
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
  
  // Update map center when route is available
  useEffect(() => {
    try {
      if (route && Array.isArray(route) && route.length > 0) {
        // Validate route points
        const validPoints = route.filter(point => 
          point && typeof point.lat === 'number' && typeof point.lng === 'number'
        );
        
        if (validPoints.length > 0) {
          // Calculate center of route
          const bounds = L.latLngBounds(validPoints.map(point => [point.lat, point.lng]));
          setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
          setMapZoom(12);
        }
      }
    } catch (error) {
      console.error('Error updating map center based on route:', error);
      // Fallback to default center if there's an error
      if (startLocation) {
        setMapCenter([startLocation.lat, startLocation.lng]);
      } else if (userLocation) {
        setMapCenter([userLocation.lat, userLocation.lng]);
      }
    }
  }, [route, startLocation, userLocation]);

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
    if (event && event.originalEvent) {
      L.DomEvent.stopPropagation(event.originalEvent);
    }
    
    setSelectedRoad(roadSegment);
    
    // Log for debugging
    console.log('Road segment selected for rating:', roadSegment);
  };

  // Handle click on the main route - optimized version
  const handleRouteClick = (event) => {
    // Prevent default behaviors and propagation
    if (event && event.originalEvent) {
      L.DomEvent.stopPropagation(event.originalEvent);
    }
    
    // Get the click location
    const clickLatLng = event.latlng;
    
    // Create a simplified road segment from the click location
    // We'll use a minimal object with just what we need
    const roadSegment = {
      id: `route_click_${Date.now()}`,
      coordinates: {
        start: {
          lat: clickLatLng.lat - 0.0005,
          lng: clickLatLng.lng - 0.0005
        },
        end: {
          lat: clickLatLng.lat + 0.0005,
          lng: clickLatLng.lng + 0.0005
        }
      },
      clickPoint: clickLatLng
    };
    
    // Set the selected road immediately
    setSelectedRoad(roadSegment);
  };

  // Submit road rating - fixed version to prevent stuck popups
  const submitRoadRating = (rating) => {
    if (selectedRoad) {
      // First close the popup to prevent it from getting stuck
      setSelectedRoad(null);
      
      // Then submit the rating (after popup is closed)
      setTimeout(() => {
        try {
          onRoadRating(
            selectedRoad.id,
            selectedRoad.coordinates,
            rating
          );
        } catch (error) {
          console.error('Error submitting road rating:', error);
        }
      }, 10);
    }
  };

  // No longer needed after removing traffic system

  return (
    <div className="map-container">
      {/* Hidden element to store map bounds */}
      <div id="mapBounds" style={{ display: 'none' }} data-north="90" data-south="-90" data-east="180" data-west="-180"></div>
      
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
        
        {/* Route polyline with error handling */}
        {route && Array.isArray(route) && route.length > 1 && (
          <>
            {/* Route outline for better visibility */}
            <Polyline 
              positions={route.filter(point => point && typeof point.lat === 'number' && typeof point.lng === 'number')
                .map(point => [point.lat, point.lng])}
              color="#ffffff"
              weight={9}
              opacity={0.4}
              smoothFactor={1}
            />
            {/* Main route line - clickable for rating */}
            <Polyline 
              positions={route.map(point => [point.lat, point.lng])}
              pathOptions={{
                color: '#006400',
                weight: 6,
                opacity: 0.8,
                smoothFactor: 1,
                className: 'clickable-main-route'
              }}
              eventHandlers={{
                click: handleRouteClick,
                mouseover: (e) => {
                  // Simplified style change
                  e.target.setStyle({
                    weight: 8,
                    color: '#008000'
                  });
                },
                mouseout: (e) => {
                  // Simplified style change
                  e.target.setStyle({
                    weight: 6,
                    color: '#006400'
                  });
                }
              }}
            />
          </>
        )}
        
        {/* Road ratings visualization */}
        {roadRatings && roadRatings.map((rating, index) => (
          rating && rating.coordinates && rating.coordinates.start && rating.coordinates.end ? (
            <Polyline 
              key={`rating-${rating.roadId || index}-${index}`}
              positions={[
                [rating.coordinates.start.lat, rating.coordinates.start.lng],
                [rating.coordinates.end.lat, rating.coordinates.end.lng]
              ]}
              color={rating.rating === 'Good' ? '#28a745' : '#dc3545'}
              weight={4}
              opacity={0.6}
              dashArray={rating.rating === 'Good' ? '' : '5, 10'}
            />
          ) : null
        ))}
        
        {/* 2 km segments for rating that follow the actual road */}
        {routeSegments && routeSegments.length > 0 && routeSegments.map((segment, index) => {
          if (!segment) return null;
          return (
            <React.Fragment key={`segment-container-${segment.id || index}-${index}`}>
              {/* The segment line */}
              {segment.points ? (
                <Polyline 
                  key={`segment-${segment.id || index}-${index}`}
                  positions={segment.points}
                  pathOptions={{
                    color: '#006400',
                    weight: 8,
                    opacity: 0.7,
                    className: 'clickable-route-segment'
                  }}
                  eventHandlers={{
                    click: (e) => {
                      console.log('2km road segment clicked:', segment);
                      handleRoadClick(e, segment);
                    },
                    mouseover: (e) => {
                      e.target.setStyle({
                        weight: 10,
                        color: '#008000'
                      });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({
                        weight: 8,
                        color: '#006400'
                      });
                    }
                  }}
                />
              ) : segment.coordinates && segment.coordinates.start && segment.coordinates.end ? (
                <Polyline 
                  key={`segment-${segment.id || index}-${index}`}
                  positions={[
                    [segment.coordinates.start.lat, segment.coordinates.start.lng],
                    [segment.coordinates.end.lat, segment.coordinates.end.lng]
                  ]}
                  pathOptions={{
                    color: '#006400',
                    weight: 8,
                    opacity: 0.7,
                    className: 'clickable-route-segment'
                  }}
                  eventHandlers={{
                    click: (e) => {
                      console.log('2km road segment clicked:', segment);
                      handleRoadClick(e, segment);
                    },
                    mouseover: (e) => {
                      e.target.setStyle({
                        weight: 10,
                        color: '#008000'
                      });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({
                        weight: 8,
                        color: '#006400'
                      });
                    }
                  }}
                />
              ) : null}
            
              {/* Segment divider markers */}
              {index > 0 && segment.coordinates && segment.coordinates.start && (
                <CircleMarker
                  center={[
                    segment.coordinates.start.lat,
                    segment.coordinates.start.lng
                  ]}
                  radius={4}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: '#006400',
                    fillOpacity: 1,
                    weight: 2
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
        
        {/* Traffic data removed */}
        
        {/* Road click for rating - with improved popup handling */}
        {selectedRoad && selectedRoad.coordinates && selectedRoad.coordinates.start && selectedRoad.coordinates.end && (
          <Popup
            position={[
              selectedRoad.clickPoint ? selectedRoad.clickPoint.lat : (selectedRoad.coordinates.start.lat + selectedRoad.coordinates.end.lat) / 2,
              selectedRoad.clickPoint ? selectedRoad.clickPoint.lng : (selectedRoad.coordinates.start.lng + selectedRoad.coordinates.end.lng) / 2
            ]}
            onClose={() => setSelectedRoad(null)}
            closeButton={true}
            autoClose={true}
            closeOnClick={false}
          >
            <div className="road-rating-popup" style={{ padding: '10px', textAlign: 'center' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Rate this road segment:</p>
              {selectedRoad.distanceKm && (
                <p style={{ fontSize: '12px', marginBottom: '10px', color: '#555' }}>
                  ~{selectedRoad.distanceKm} km segment
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <button 
                  style={{ 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                  onClick={() => submitRoadRating('Good')}
                >
                  Good Road
                </button>
                <button 
                  style={{ 
                    backgroundColor: '#dc3545', 
                    color: 'white', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                  onClick={() => submitRoadRating('Bad')}
                >
                  Bad Road
                </button>
              </div>
              <div style={{ marginTop: '10px' }}>
                <button 
                  style={{ 
                    backgroundColor: '#6c757d', 
                    color: 'white', 
                    border: 'none', 
                    padding: '5px 10px', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  onClick={() => setSelectedRoad(null)}
                >
                  Cancel
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
