/**
 * API Helper Utility
 * Provides robust API request handling with error protection for JSON parsing
 */

const axios = require('axios');

/**
 * Make a safe API request that handles HTML responses and JSON parsing errors
 * @param {string} url - The URL to request
 * @param {Object} options - Request options
 * @returns {Object} - The response data or null if error
 */
async function safeApiRequest(url, options = {}) {
  try {
    // Set default options
    const requestOptions = {
      timeout: options.timeout || 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      validateStatus: status => status < 500,
      ...options
    };

    console.log(`Making API request to: ${url}`);
    
    // Make the request
    const response = await axios.get(url, requestOptions);
    
    // Check response status
    if (response.status !== 200) {
      console.error(`API returned status ${response.status} for URL: ${url}`);
      return null;
    }
    
    // Check if response is HTML instead of JSON
    if (typeof response.data === 'string') {
      if (response.data.includes('<!doctype') || response.data.includes('<html')) {
        console.error('API returned HTML instead of JSON');
        return null;
      }
      
      // Try to parse JSON if it's a string
      try {
        return JSON.parse(response.data);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError.message);
        return null;
      }
    }
    
    // If response is already an object, return it
    return response.data;
  } catch (error) {
    console.error(`API request failed for ${url}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

module.exports = {
  safeApiRequest
};
