// service_worker.js
// Service worker with Safe Browsing API integration and message handling

// Import config (injected via importScripts in manifest or loaded separately)
let CONFIG = {
  SAFE_BROWSING_API_KEY: 'AIzaSyBjwZbTVhdK1_gwIEXXzypRh_DoMUV5e88',
  SAFE_BROWSING_API_URL: 'https://safebrowsing.googleapis.com/v4/threatMatches:find',
  USE_SAFE_BROWSING: true,
  BACKEND_URL: 'https://your-backend.example.com/api',
  USE_BACKEND: false
};

// Load config from storage
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['ffd_config']);
    if (result.ffd_config) {
      CONFIG = { ...CONFIG, ...result.ffd_config };
    }
  } catch (e) {
    console.warn('Failed to load config:', e);
  }
}

// Initialize on startup
loadConfig();

// Cache for Safe Browsing results to avoid repeated API calls
const safeBrowsingCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Track consecutive failures to auto-disable after repeated errors
let consecutiveFailures = 0;
const MAX_FAILURES = 3; // Disable after 3 consecutive failures
let safeBrowsingDisabled = false;

/**
 * Check URL against Google Safe Browsing API
 * NOTE: For production, use a backend proxy to keep API key secure
 */
async function checkSafeBrowsing(url) {
  // Check if Safe Browsing is disabled due to repeated failures
  if (safeBrowsingDisabled) {
    return { safe: 'unknown', reason: 'Safe Browsing disabled due to repeated API errors' };
  }
  
  if (!CONFIG.USE_SAFE_BROWSING || !CONFIG.SAFE_BROWSING_API_KEY || CONFIG.SAFE_BROWSING_API_KEY === 'YOUR_API_KEY_HERE') {
    return { safe: 'unknown', reason: 'API key not configured' };
  }
  
  // Check cache first
  const cacheKey = url;
  const cached = safeBrowsingCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log('[FFD] Using cached Safe Browsing result for:', url);
    return cached.result;
  }

  try {
    // Validate and normalize URL
    let validUrl = url;
    
    // If URL is relative or invalid, try to construct a valid one
    if (!url || typeof url !== 'string') {
      return { safe: 'unknown', reason: 'Invalid URL provided' };
    }
    
    // Check if URL is absolute (starts with http:// or https://)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Relative URL - we can't check it with Safe Browsing API
      // Safe Browsing API requires absolute URLs
      return { safe: 'unknown', reason: 'Relative URL cannot be checked' };
    }
    
    // Validate URL format
    try {
      const urlObj = new URL(url);
      validUrl = urlObj.href; // Use normalized URL
      finalCacheKey = validUrl; // Use normalized URL as cache key
    } catch (e) {
      // Invalid URL format
      return { safe: 'unknown', reason: `Invalid URL format: ${e.message}` };
    }
    
    // Safe Browsing API v4 request
    const requestBody = {
      client: {
        clientId: 'fake-form-detection-extension',
        clientVersion: '1.0.0'
      },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [
          { url: validUrl }
        ]
      }
    };

    const response = await fetch(
      `${CONFIG.SAFE_BROWSING_API_URL}?key=${CONFIG.SAFE_BROWSING_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      let errorMessage = `Safe Browsing API error: ${response.status}`;
      
      // Provide helpful error messages based on status code
      if (response.status === 403) {
        errorMessage = `Safe Browsing API error 403 (Forbidden).\n` +
          `Possible causes:\n` +
          `• API key is invalid or expired\n` +
          `• Safe Browsing API not enabled in Google Cloud Console\n` +
          `• API key has restrictions (IP/referrer) blocking requests\n` +
          `• Quota exceeded (check Google Cloud Console)\n` +
          `• API key doesn't have Safe Browsing API enabled\n\n` +
          `To fix:\n` +
          `1. Go to: https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com\n` +
          `2. Enable "Safe Browsing API" for your project\n` +
          `3. Go to: https://console.cloud.google.com/apis/credentials\n` +
          `4. Verify your API key is correct and has no restrictions\n` +
          `5. Check quota usage in Google Cloud Console\n\n` +
          `Or disable Safe Browsing by setting USE_SAFE_BROWSING: false in config.js`;
      } else if (response.status === 400) {
        errorMessage = 'Safe Browsing API error 400: Invalid request format.';
      } else if (response.status === 429) {
        errorMessage = 'Safe Browsing API error 429: Rate limit exceeded. Please wait before trying again.';
      }
      
      // Try to get more details from response
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorMessage += `\n\nAPI Error Details: ${errorData.error.message}`;
        }
        if (errorData.error && errorData.error.errors) {
          errorMessage += `\nErrors: ${JSON.stringify(errorData.error.errors)}`;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      
      console.error('[FFD]', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Check if threats were found
    if (data.matches && data.matches.length > 0) {
      const threats = data.matches.map(m => m.threatType).join(', ');
      const result = {
        safe: false,
        threats: data.matches,
        threatTypes: threats,
        reason: `URL flagged by Google Safe Browsing: ${threats}`
      };
      
      // Cache successful result
      safeBrowsingCache.set(finalCacheKey, { result, timestamp: Date.now() });
      consecutiveFailures = 0; // Reset failure counter on success
      
      return result;
    }

    const result = { safe: true, reason: 'No threats found' };
    
    // Cache successful result
    safeBrowsingCache.set(finalCacheKey, { result, timestamp: Date.now() });
    consecutiveFailures = 0; // Reset failure counter on success
    
    return result;
  } catch (error) {
    // Track consecutive failures
    consecutiveFailures++;
    
    // Only log error once per failure type to avoid spam
    if (consecutiveFailures === 1 || consecutiveFailures === MAX_FAILURES) {
      if (error.message.includes('403')) {
        console.error('[FFD] Safe Browsing API error 403 (Forbidden).', 
          consecutiveFailures === MAX_FAILURES ? 
          'Disabling Safe Browsing due to repeated failures. Set USE_SAFE_BROWSING: false in config.js to disable permanently.' :
          'Check your API key configuration. See SAFE_BROWSING_SETUP.md for help.');
      } else {
        console.error('[FFD] Safe Browsing check failed:', error.message);
      }
    }
    
    // Auto-disable after MAX_FAILURES consecutive failures
    if (consecutiveFailures >= MAX_FAILURES) {
      safeBrowsingDisabled = true;
      console.warn('[FFD] Safe Browsing disabled due to', MAX_FAILURES, 'consecutive failures. To re-enable, fix API key and reload extension.');
      
      // Cache the failure to avoid repeated attempts
      const result = { 
        safe: 'unknown', 
        reason: 'Safe Browsing API unavailable (disabled due to repeated errors)',
        disabled: true
      };
      safeBrowsingCache.set(finalCacheKey, { result, timestamp: Date.now() });
      
      return result;
    }
    
    // Provide user-friendly error messages
    let reason = 'Check failed: ' + error.message;
    
    if (error.message.includes('403')) {
      reason = 'Safe Browsing API key issue. Please check API key configuration.';
    } else if (error.message.includes('Invalid URL')) {
      reason = 'Cannot check URL - invalid format.';
    }
    
    // Cache the failure (short duration) to avoid repeated immediate attempts
    const result = { safe: 'unknown', reason: reason };
    safeBrowsingCache.set(finalCacheKey, { result, timestamp: Date.now() - (CACHE_DURATION - 30000) }); // Cache for 30 seconds only
    
    return result;
  }
}

/**
 * Check URL against backend API (if configured)
 */
async function checkBackend(url) {
  if (!CONFIG.USE_BACKEND) {
    return { safe: 'unknown', reason: 'Backend not configured' };
  }

  try {
    const response = await fetch(`${CONFIG.BACKEND_URL}/check-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.warn('Backend check failed:', error);
  }

  return { safe: 'unknown', reason: 'Backend unavailable' };
}

// Message handler for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message || {};

  // Handle async operations
  (async () => {
    switch (type) {
      case 'CHECK_SAFE_BROWSING': {
        const { url } = payload;
        const result = await checkSafeBrowsing(url);
        sendResponse({ type: 'SB_RESULT', payload: result });
        break;
      }

      case 'CHECK_BACKEND': {
        const { url } = payload;
        const result = await checkBackend(url);
        sendResponse({ type: 'BACKEND_RESULT', payload: result });
        break;
      }

      case 'UPDATE_CONFIG': {
        CONFIG = { ...CONFIG, ...payload };
        await chrome.storage.local.set({ ffd_config: CONFIG });
        
        // Reset Safe Browsing if config was updated
        if (payload.USE_SAFE_BROWSING === false) {
          safeBrowsingDisabled = false;
          consecutiveFailures = 0;
          safeBrowsingCache.clear();
        }
        
        sendResponse({ type: 'CONFIG_UPDATED', payload: { success: true } });
        break;
      }
      
      case 'RESET_SAFE_BROWSING': {
        // Allow manual reset of Safe Browsing
        safeBrowsingDisabled = false;
        consecutiveFailures = 0;
        safeBrowsingCache.clear();
        sendResponse({ type: 'SAFE_BROWSING_RESET', payload: { success: true } });
        break;
      }

      default:
        console.warn('Unknown message type:', type);
        sendResponse({ error: 'Unknown message type' });
    }
  })();

  // Return true to indicate we will send a response asynchronously
  return true;
});

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fake Form Detection Extension installed/updated');
  loadConfig();
});
