import React, { useState } from 'react';

// Mock data for popular destinations in India
const popularDestinations = [
  { name: 'Delhi', lat: 28.7041, lng: 77.1025 },
  { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
  { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
  { name: 'Jaipur', lat: 26.9124, lng: 75.7873 }
];

const Sidebar = ({ 
  userLocation, 
  startLocation,
  destination, 
  routeInfo, 
  loading, 
  error, 
  onStartSelect,
  onDestinationSelect,
  onCalculateRoute
}) => {
  const [startSearchQuery, setStartSearchQuery] = useState('');
  const [destSearchQuery, setDestSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState(null); // 'start' or 'destination'

  // Handle search input change
  const handleSearchChange = (e, type) => {
    const query = e.target.value;
    
    if (type === 'start') {
      setStartSearchQuery(query);
      setActiveSearchField('start');
    } else {
      setDestSearchQuery(query);
      setActiveSearchField('destination');
    }
    
    if (query.length > 2) {
      setIsSearching(true);
      
      // Filter popular destinations based on query
      // In a real app, this would be an API call to a geocoding service
      const results = popularDestinations.filter(place => 
        place.name.toLowerCase().includes(query.toLowerCase())
      );
      
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  // Handle location selection
  const handleLocationClick = (location) => {
    if (activeSearchField === 'start') {
      onStartSelect(location);
      setStartSearchQuery(location.name);
    } else {
      onDestinationSelect(location);
      setDestSearchQuery(location.name);
    }
    setSearchResults([]);
  };
  
  // Handle use current location for start
  const handleUseCurrentLocation = () => {
    if (userLocation) {
      onStartSelect(userLocation);
      setStartSearchQuery('My Location');
    }
  };

  // Format distance
  const formatDistance = (distance) => {
    if (!distance) return '';
    
    return distance < 1 
      ? `${Math.round(distance * 1000)} m` 
      : `${distance.toFixed(1)} km`;
  };

  // Format time
  const formatTime = (minutes) => {
    if (!minutes) return '';
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours === 0) {
      return `${mins} min`;
    } else if (mins === 0) {
      return `${hours} hr`;
    } else {
      return `${hours} hr ${mins} min`;
    }
  };

  return (
    <div className="w-80 bg-white shadow-lg overflow-auto">
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Find Safe Route</h2>
        
        {/* Start location input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Location</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Enter start location..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              value={startSearchQuery}
              onChange={(e) => handleSearchChange(e, 'start')}
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute right-3 top-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {userLocation && (
            <button 
              className="mt-1 text-sm text-primary flex items-center"
              onClick={handleUseCurrentLocation}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Use my current location
            </button>
          )}
        </div>
        
        {/* Destination input */}
        <div className="relative mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
          <input
            type="text"
            placeholder="Enter destination..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            value={destSearchQuery}
            onChange={(e) => handleSearchChange(e, 'destination')}
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute right-3 top-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Calculate route button */}
        {startLocation && destination && (
          <button
            className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded-lg mb-4 transition duration-300"
            onClick={onCalculateRoute}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Calculating...
              </span>
            ) : (
              'Calculate Route'
            )}
          </button>
        )}
        
        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
            <ul>
              {searchResults.map((place, index) => (
                <li 
                  key={index}
                  className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleLocationClick(place)}
                >
                  <div className="p-3">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{place.name}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {/* Route information */}
        {routeInfo && !loading && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h3 className="font-bold text-lg mb-2">Route Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">Distance</p>
                <p className="font-semibold">{formatDistance(routeInfo.distance)}</p>
              </div>
              
              <div>
                <p className="text-gray-500 text-sm">Estimated Time</p>
                <p className="font-semibold">{formatTime(routeInfo.estimatedTime)}</p>
              </div>
            </div>
            
            <div className="mt-3">
              <p className="text-gray-500 text-sm">Safety Score</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                <div 
                  className={`h-2.5 rounded-full ${
                    routeInfo.safetyScore >= 80 ? 'bg-success' : 
                    routeInfo.safetyScore >= 50 ? 'bg-warning' : 
                    'bg-danger'
                  }`}
                  style={{ width: `${routeInfo.safetyScore}%` }}
                ></div>
              </div>
              <p className="text-right text-xs mt-1">{routeInfo.safetyScore}%</p>
            </div>
          </div>
        )}
        
        {/* Popular destinations */}
        <div>
          <h3 className="font-bold mb-2">Popular Destinations</h3>
          <ul className="space-y-2">
            {popularDestinations.slice(0, 5).map((place, index) => (
              <li 
                key={index}
                className="flex items-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                onClick={() => handleLocationClick(place)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{place.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
