// Mock data for route calculation when server is not available
export const mockRouteData = {
  route: [
    // Sample route from Delhi to Mumbai
    { lat: 28.6139, lng: 77.2090 }, // Delhi
    { lat: 28.4089, lng: 77.3178 }, // Faridabad
    { lat: 27.1767, lng: 78.0081 }, // Agra
    { lat: 26.9124, lng: 75.7873 }, // Jaipur
    { lat: 25.3176, lng: 74.6400 }, // Bhilwara
    { lat: 24.5854, lng: 73.7125 }, // Udaipur
    { lat: 23.0225, lng: 72.5714 }, // Ahmedabad
    { lat: 21.1702, lng: 72.8311 }, // Surat
    { lat: 19.0760, lng: 72.8777 }  // Mumbai
  ],
  distance: 1421.5,
  estimatedTime: 1260, // 21 hours in minutes
  safetyScore: 82,
  routeType: "safe-route",
  isSafeRoute: true
};
