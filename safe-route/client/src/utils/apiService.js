/**
 * API Service
 * Safe wrapper for API requests that handles HTML responses and JSON parsing errors
 */

/**
 * Make a safe API request with proper error handling
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - The response data or throws an error
 */
export const safeApiRequest = async (url, options = {}) => {
  try {
    // Set default options
    const requestOptions = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    };

    console.log(`Making API request to: ${url}`);
    
    // Make the request
    const response = await fetch(url, requestOptions);
    
    // Check response status
    if (!response.ok) {
      console.error(`API returned status ${response.status} for URL: ${url}`);
      const errorText = await response.text();
      
      // Check if response is HTML
      if (errorText.includes('<!doctype') || errorText.includes('<html')) {
        console.error('Server returned HTML instead of JSON');
        throw new Error('Server returned HTML instead of JSON');
      }
      
      // Try to parse as JSON if possible
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || `API error: ${response.status}`);
      } catch (parseError) {
        throw new Error(`API error: ${response.status}`);
      }
    }
    
    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error(`API returned non-JSON content type: ${contentType}`);
      
      // Get the text response
      const text = await response.text();
      
      // Check if it's HTML
      if (text.includes('<!doctype') || text.includes('<html')) {
        console.error('Server returned HTML instead of JSON');
        throw new Error('Server returned HTML instead of JSON');
      }
      
      // Try to parse as JSON anyway
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Invalid response format');
      }
    }
    
    // Try to parse JSON with error handling
    try {
      return await response.json();
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      const text = await response.text();
      console.error('Response text:', text);
      throw new Error('Failed to parse response as JSON');
    }
  } catch (error) {
    console.error(`API request failed for ${url}:`, error.message);
    throw error;
  }
};

/**
 * Get the base API URL based on environment
 * @returns {string} - Base API URL
 */
const getApiBaseUrl = () => {
  // For local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '';
  }
  
  // For Firebase hosting with Cloud Functions
  // This handles the case where the app is deployed to Firebase
  return 'https://us-central1-safe-route-127fd.cloudfunctions.net';
};

/**
 * Calculate route with safe error handling
 * @param {Object} startLocation - Start coordinates {lat, lng}
 * @param {Object} destination - Destination coordinates {lat, lng}
 * @param {boolean} prioritizeSafety - Whether to prioritize safety
 * @returns {Promise<Object>} - Route data or null if error
 */
export const calculateRouteApi = async (startLocation, destination, prioritizeSafety = true) => {
  try {
    // Get the base API URL
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/routes/calculate`;
    
    console.log('Making API request to:', url);
    
    const data = await safeApiRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        start: startLocation,
        destination: destination,
        prioritizeSafety: prioritizeSafety,
      }),
    });
    
    return data;
  } catch (error) {
    console.error('Error calculating route:', error.message);
    return null;
  }
};

/**
 * Test API connectivity
 * @returns {Promise<Object>} - Test response or null if error
 */
export const testApiConnection = async () => {
  try {
    const baseUrl = getApiBaseUrl();
    const data = await safeApiRequest(`${baseUrl}/api/test`);
    return data;
  } catch (error) {
    console.error('API connectivity test failed:', error.message);
    return null;
  }
};
