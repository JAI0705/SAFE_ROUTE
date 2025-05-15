import React from 'react';

const LocationPermission = ({ onGrant }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-primary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        
        <h2 className="text-2xl font-bold mb-2">Location Access Required</h2>
        
        <p className="text-gray-600 mb-6">
          Safe Route needs access to your location to provide you with the safest and fastest routes in India.
          Your location will only be used while you're using the app.
        </p>
        
        <button 
          onClick={onGrant}
          className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-6 rounded-lg transition duration-300 w-full"
        >
          Allow Location Access
        </button>
        
        <p className="mt-4 text-sm text-gray-500">
          You can change your location settings at any time in your browser settings.
        </p>
      </div>
    </div>
  );
};

export default LocationPermission;
