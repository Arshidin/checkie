/**
 * Checkie Configuration
 * Set API URL based on environment
 */

(function() {
  // Detect environment
  const hostname = window.location.hostname;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Local development
    window.CHECKIE_API_URL = 'http://localhost:3000/api';
  } else {
    // Production (Netlify)
    window.CHECKIE_API_URL = 'https://checkie-production.up.railway.app/api';
  }

  console.log('Checkie API URL:', window.CHECKIE_API_URL);
})();
