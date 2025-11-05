// config.js
// Configuration file for API keys and extension settings

const CONFIG = {
  // Google Safe Browsing API
  // IMPORTANT: Get your API key from: https://console.cloud.google.com/apis/credentials
  // For production, use a backend proxy to keep the key secure
  SAFE_BROWSING_API_KEY: 'AIzaSyBjwZbTVhdK1_gwIEXXzypRh_DoMUV5e88', // Replace with your API key
  SAFE_BROWSING_API_URL: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
  USE_SAFE_BROWSING: true, // Set to false if you don't have an API key
  
  // Backend endpoint (optional - for production use)
  BACKEND_URL: 'https://your-backend.example.com/api',
  USE_BACKEND: false, // Set to true when backend is ready
  
  // Trusted domains (whitelist)
  trustedDomains: [
    'instagram.com',
    'facebook.com',
    'accounts.google.com',
    'google.com',
    'gmail.com',
    'twitter.com',
    'x.com',
    'linkedin.com',
    'amazon.com',
    'microsoft.com',
    'apple.com',
    'github.com',
    'netflix.com',
    'paypal.com',
    'bankofamerica.com',
    'wellsfargo.com',
    'chase.com'
  ],
  
  // Detection thresholds
  minSimilarityToWarn: 0.25,
  hiddenInputThreshold: 2,
  
  // ML model weights (simple heuristic-based scoring)
  mlWeights: {
    domainMismatch: 0.3,
    missingHttps: 0.2,
    hiddenInputs: 0.15,
    brandImpersonation: 0.25,
    suspiciousStructure: 0.1
  },
  
  // Risk score threshold (0-1)
  riskThreshold: 0.3
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// Make CONFIG available globally for content scripts
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
