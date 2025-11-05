// content_script.js
// Enhanced version with ML detection, blacklist, Safe Browsing, and JS interception

// CONFIG is already declared in config.js (loaded before this file per manifest.json)
// We just use it directly - do NOT redeclare it!

// Ensure CONFIG has all required properties (add defaults if missing)
if (typeof CONFIG === 'undefined') {
  console.error('[FFD] ERROR: CONFIG not found! config.js may not have loaded. Check manifest.json file order.');
  throw new Error('CONFIG not found - config.js must load before content_script.js');
}

// Ensure all required properties exist (add defaults if missing)
if (!CONFIG.trustedDomains || !Array.isArray(CONFIG.trustedDomains)) {
  CONFIG.trustedDomains = CONFIG.trustedDomains || ['instagram.com', 'facebook.com', 'accounts.google.com', 'google.com'];
}
if (typeof CONFIG.hiddenInputThreshold === 'undefined') {
  CONFIG.hiddenInputThreshold = 2;
}
if (typeof CONFIG.riskThreshold === 'undefined') {
  CONFIG.riskThreshold = 0.3;
}
if (!CONFIG.mlWeights || typeof CONFIG.mlWeights !== 'object') {
  CONFIG.mlWeights = CONFIG.mlWeights || {
    domainMismatch: 0.3,
    missingHttps: 0.2,
    hiddenInputs: 0.15,
    brandImpersonation: 0.25,
    suspiciousStructure: 0.1
  };
}

// Load config from storage or merge with defaults
async function loadConfig() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(['ffd_config']);
      if (result.ffd_config) {
        // Merge stored config with existing CONFIG
        // CONFIG is const, but we can mutate its properties
        Object.assign(CONFIG, result.ffd_config);
      }
    }
  } catch (e) {
    console.warn('[FFD] Failed to load config:', e);
  }
}

// Initialize config (don't wait for it)
loadConfig();

// Track intercepted JS-based submissions
const interceptedSubmissions = new Map();

/**
 * Normalize URL to absolute URL for Safe Browsing API
 * @param {string} url - URL to normalize (can be relative or absolute)
 * @returns {string} - Absolute URL
 */
function normalizeUrlForSafeBrowsing(url) {
  if (!url || typeof url !== 'string') {
    return window.location.href;
  }
  
  // If already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      new URL(url); // Validate
      return url;
    } catch (e) {
      return window.location.href; // Fallback to current page
    }
  }
  
  // Relative URL - convert to absolute
  try {
    return new URL(url, window.location.href).href;
  } catch (e) {
    // If URL construction fails, use current page URL
    return window.location.href;
  }
}

/**
 * Intercept JavaScript-based credential submissions (fetch/XHR)
 */
function initJSInterception() {
  console.log('[FFD] Initializing JavaScript interception...');
  
  // Intercept fetch API
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options = {}] = args;
    const urlString = typeof url === 'string' ? url : (url?.url || url?.toString() || '');
    
    console.log('[FFD] Fetch intercepted:', urlString, options.method);
    
    // Check if this looks like a credential submission (POST, PUT, PATCH)
    if (options.method && ['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
      const body = options.body || '';
      let bodyString = '';
      
      try {
        if (typeof body === 'string') {
          bodyString = body;
        } else if (body instanceof FormData) {
          // Check FormData for credential fields
          for (const [key, value] of body.entries()) {
            if (/password|passwd|pwd|email|username|login|credential/i.test(key)) {
              bodyString += `${key}=${value}`;
            }
          }
        } else if (body instanceof URLSearchParams) {
          bodyString = body.toString();
        } else {
          bodyString = JSON.stringify(body);
        }
      } catch (e) {
        console.warn('[FFD] Error parsing fetch body:', e);
      }
      
      // Check for password/credential fields
      const credentialPatterns = [
        /password/i,
        /passwd/i,
        /pwd/i,
        /email/i,
        /username/i,
        /user/i,
        /login/i,
        /credential/i,
        /auth/i,
        /token/i
      ];
      
      const hasCredentials = credentialPatterns.some(pattern => pattern.test(bodyString));
      const suspiciousDomain = !urlString.includes(window.location.hostname) && 
                               !urlString.startsWith('/') && 
                               !urlString.startsWith('./');
      
      if (hasCredentials || suspiciousDomain) {
        console.log('[FFD] ⚠️ Suspicious fetch detected!', {
          url: urlString,
          hasCredentials,
          suspiciousDomain,
          bodyPreview: bodyString.substring(0, 200)
        });
        
        const formInfo = {
          action: urlString,
          method: options.method,
          actionDomain: getDomain(urlString),
          pageDomain: window.location.hostname.replace(/^www\./i, '').toLowerCase(),
          isHTTPS: window.location.protocol === 'https:',
          brand: looksLikeBrand(document),
          pageTitle: document.title || '',
          hasPassword: hasCredentials,
          inputs: [],
          isJSSubmission: true,
          jsBody: bodyString.substring(0, 500)
        };
        
        const reasons = await evaluateFormRisk(formInfo);
        
        if (reasons.length > 0) {
          console.log('[FFD] ⚠️ BLOCKING FETCH REQUEST - Suspicious!');
          // Block the request and show warning
          const proceed = await showWarningModalAsync(formInfo, reasons);
          if (proceed) {
            console.log('[FFD] User chose to proceed with fetch');
            return originalFetch.apply(this, args);
          } else {
            console.log('[FFD] User blocked fetch request');
            throw new Error('Request blocked by Fake Form Detection Extension');
          }
        }
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._ffd_method = method;
    this._ffd_url = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    if (this._ffd_method && ['POST', 'PUT', 'PATCH'].includes(this._ffd_method.toUpperCase())) {
      console.log('[FFD] XHR intercepted:', this._ffd_url, this._ffd_method);
      
      let bodyString = '';
      try {
        if (typeof data === 'string') {
          bodyString = data;
        } else if (data instanceof FormData) {
          for (const [key, value] of data.entries()) {
            if (/password|passwd|pwd|email|username|login|credential/i.test(key)) {
              bodyString += `${key}=${value}`;
            }
          }
        } else {
          bodyString = JSON.stringify(data);
        }
      } catch (e) {
        console.warn('[FFD] Error parsing XHR body:', e);
      }
      
      const credentialPatterns = [
        /password/i,
        /passwd/i,
        /pwd/i,
        /email/i,
        /username/i,
        /user/i,
        /login/i,
        /credential/i,
        /auth/i,
        /token/i
      ];
      
      const hasCredentials = credentialPatterns.some(pattern => pattern.test(bodyString));
      const suspiciousDomain = !this._ffd_url.includes(window.location.hostname) && 
                               !this._ffd_url.startsWith('/') && 
                               !this._ffd_url.startsWith('./');
      
      if (hasCredentials || suspiciousDomain) {
        console.log('[FFD] ⚠️ Suspicious XHR detected!', {
          url: this._ffd_url,
          hasCredentials,
          suspiciousDomain
        });
        
        const formInfo = {
          action: this._ffd_url,
          method: this._ffd_method,
          actionDomain: getDomain(this._ffd_url),
          pageDomain: window.location.hostname.replace(/^www\./i, '').toLowerCase(),
          isHTTPS: window.location.protocol === 'https:',
          brand: looksLikeBrand(document),
          pageTitle: document.title || '',
          hasPassword: hasCredentials,
          inputs: [],
          isJSSubmission: true,
          jsBody: bodyString.substring(0, 500)
        };
        
        evaluateFormRisk(formInfo).then(reasons => {
          if (reasons.length > 0) {
            console.log('[FFD] ⚠️ BLOCKING XHR REQUEST - Suspicious!');
            showWarningModalAsync(formInfo, reasons).then(proceed => {
              if (!proceed) {
                console.log('[FFD] User blocked XHR request');
                this.abort();
              } else {
                console.log('[FFD] User chose to proceed with XHR');
                originalXHRSend.apply(this, [data]);
              }
            });
            return; // Don't send yet
          } else {
            return originalXHRSend.apply(this, [data]);
          }
        });
        return; // Wait for async check
      }
    }
    
    return originalXHRSend.apply(this, [data]);
  };
}

/**
 * Main: scan forms and attach submit handler
 */
function initFormScanner() {
  try {
    const forms = Array.from(document.forms);
    console.log(`[FFD] Found ${forms.length} forms on page`);
    
    if (forms.length === 0) {
      // Also check for forms that might be added dynamically
      console.log('[FFD] No forms found, will retry on mutations');
    }
    
    forms.forEach((form, index) => {
      console.log(`[FFD] Attaching handler to form ${index + 1}:`, form);
      attachFormHandler(form);
      
      // Also analyze form immediately to show warning if suspicious
      analyzeFormImmediately(form);
    });
  } catch (e) {
    console.error('[FFD] Form scanner failed', e);
  }
}

/**
 * Analyze form immediately on page load and show warning if suspicious
 */
async function analyzeFormImmediately(form) {
  try {
    const formInfo = analyzeForm(form);
    console.log('[FFD] Form info:', formInfo);
    
    // Only check if form has password field
    if (!formInfo.hasPassword) {
      console.log('[FFD] Form has no password field, skipping');
      return;
    }
    
    const reasons = await evaluateFormRisk(formInfo);
    console.log('[FFD] Risk evaluation reasons:', reasons);
    
    if (reasons.length > 0) {
      console.log('[FFD] ⚠️ Suspicious form detected! Reasons:', reasons);
      // Show a warning banner instead of blocking (since form hasn't been submitted yet)
      showWarningBanner(form, reasons, formInfo);
    } else {
      console.log('[FFD] ✓ Form appears safe');
    }
  } catch (e) {
    console.error('[FFD] Error analyzing form immediately:', e);
  }
}

/**
 * Attach submit interception to a form
 * @param {HTMLFormElement} form
 */
async function attachFormHandler(form) {
  if (form.__ffd_hooked) {
    console.log('[FFD] Form already hooked, skipping');
    return;
  }
  form.__ffd_hooked = true;
  console.log('[FFD] Form handler attached to form:', form);

  // Intercept form.submit() method calls (JavaScript-based submission)
  const originalSubmit = HTMLFormElement.prototype.submit;
  Object.defineProperty(form, 'submit', {
    value: function() {
      // Check if this is a bypass (when we want to allow submission)
      if (this.__ffd_bypass) {
        this.__ffd_bypass = false;
        console.log('[FFD] Bypassing check, submitting form');
        originalSubmit.call(this);
        return;
      }
      
      console.log('[FFD] form.submit() method called!');
      const formInfo = analyzeForm(this);
      console.log('[FFD] Form info from submit() method:', formInfo);
      
      // Check if suspicious
      evaluateFormRisk(formInfo).then(reasons => {
        if (reasons.length > 0) {
          console.log('[FFD] ⚠️ BLOCKING form.submit() - Suspicious!');
          showWarningModal(this, reasons, formInfo);
        } else {
          console.log('[FFD] Form appears safe, allowing form.submit()');
          this.__ffd_bypass = true;
          originalSubmit.call(this);
        }
      });
    },
    writable: true,
    configurable: true
  });

  // Intercept submit event (browser native form submission)
  form.addEventListener('submit', function(ev) {
    console.log('[FFD] ⚠️ SUBMIT EVENT FIRED!');
    console.log('[FFD] Event details:', ev);
    
    // ALWAYS prevent default first to stop submission
    ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();
    
    console.log('[FFD] Form submission PREVENTED - analyzing...');
    
    // Grab form snapshot before submission
    const formInfo = analyzeForm(form);
    console.log('[FFD] Form info on submit:', formInfo);
    
    // Check blacklist/whitelist first
    const domainList = typeof window.__ffd_domainList !== 'undefined' ? window.__ffd_domainList : null;
    
    if (domainList) {
      domainList.isBlacklisted(formInfo.actionDomain).then(isBlacklisted => {
        domainList.isWhitelisted(formInfo.actionDomain).then(isWhitelisted => {
          if (isBlacklisted) {
            console.log('[FFD] Domain is blacklisted!');
            showWarningModal(form, [`Domain ${formInfo.actionDomain} is blacklisted`], formInfo);
            return;
          }
          
          if (isWhitelisted) {
            console.log('[FFD] Domain is whitelisted, allowing');
            // Bypass check and submit
            form.__ffd_bypass = true;
            HTMLFormElement.prototype.submit.call(form);
            return;
          }
          
          // Use ML-based evaluation
          evaluateFormRisk(formInfo).then(reasons => {
            console.log('[FFD] Risk evaluation on submit:', reasons);

    if (reasons.length > 0) {
              console.log('[FFD] ⚠️ BLOCKING FORM SUBMISSION - Suspicious! Reasons:', reasons);
      showWarningModal(form, reasons, formInfo);
            } else {
              console.log('[FFD] ✓ Form appears safe, allowing submission');
              // Bypass check and submit
              form.__ffd_bypass = true;
              HTMLFormElement.prototype.submit.call(form);
            }
          });
        });
      });
    } else {
      // No domain list, just evaluate risk
      evaluateFormRisk(formInfo).then(reasons => {
        console.log('[FFD] Risk evaluation on submit:', reasons);

        if (reasons.length > 0) {
          console.log('[FFD] ⚠️ BLOCKING FORM SUBMISSION - Suspicious! Reasons:', reasons);
          showWarningModal(form, reasons, formInfo);
        } else {
          console.log('[FFD] ✓ Form appears safe, allowing submission');
          // Bypass check and submit
          form.__ffd_bypass = true;
          HTMLFormElement.prototype.submit.call(form);
        }
      });
    }
  }, { capture: true, passive: false });
}

/**
 * Analyze form: action, inputs, presence of hidden fields, SSL, etc.
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function analyzeForm(form) {
  const action = form.getAttribute('action') || window.location.href;
  const method = (form.getAttribute('method') || 'GET').toUpperCase();
  const inputs = Array.from(form.querySelectorAll('input, button, textarea, select')).map(el => ({
    tag: el.tagName.toLowerCase(),
    type: el.type || '',
    name: el.name || '',
    id: el.id || '',
    hidden: el.type === 'hidden' || (el.offsetParent === null && el.type !== 'password')
  }));
  const hasPassword = inputs.some(i => i.type && i.type.toLowerCase() === 'password');
  const pageDomain = window.location.hostname.replace(/^www\./i, '').toLowerCase();
  const actionDomain = (() => {
    try {
      const u = new URL(action, window.location.href);
      return u.hostname.replace(/^www\./i, '').toLowerCase();
    } catch (e) {
      return '';
    }
  })();
  const isHTTPS = window.location.protocol === 'https:';
  const brand = looksLikeBrand(document);
  const pageTitle = document.title || '';

  return {
    action,
    method,
    inputs,
    hasPassword,
    pageDomain,
    actionDomain,
    isHTTPS,
    brand,
    pageTitle,
    isJSSubmission: false
  };
}

/**
 * Enhanced risk evaluation with ML and Safe Browsing
 * @param {Object} info
 * @returns {Promise<string[]>}
 */
async function evaluateFormRisk(info) {
  const reasons = [];
  
  console.log('[FFD] Evaluating form risk:', info);

  if (!info.hasPassword && !info.isJSSubmission) {
    // If no password field, likely not a credential form -> low-risk for this plugin
    console.log('[FFD] No password field found, skipping risk evaluation');
    return reasons;
  }
  
  // Ensure CONFIG is loaded
  if (!CONFIG || !CONFIG.trustedDomains) {
    console.warn('[FFD] CONFIG not loaded, using defaults');
    CONFIG = {
      trustedDomains: ['instagram.com', 'facebook.com', 'accounts.google.com', 'google.com'],
      hiddenInputThreshold: 2,
      riskThreshold: 0.3,
      mlWeights: {
        domainMismatch: 0.3,
        missingHttps: 0.2,
        hiddenInputs: 0.15,
        brandImpersonation: 0.25,
        suspiciousStructure: 0.1
      }
    };
  }
  
  // Early exit for trusted domains posting to same or trusted domain
  // This prevents false positives on legitimate sites like Facebook, Instagram, etc.
  // Check if domain is trusted (check both page and action domain)
  const isTrustedDomain = CONFIG.trustedDomains.some(trusted => 
    info.pageDomain.includes(trusted) || (info.actionDomain && info.actionDomain.includes(trusted))
  );
  const actionIsTrusted = !info.actionDomain || CONFIG.trustedDomains.some(trusted => 
    info.actionDomain.includes(trusted)
  );
  const sameDomain = !info.actionDomain || info.actionDomain === info.pageDomain;
  
  // If it's a trusted domain and posts to same/trusted domain with HTTPS, skip most checks
  if (isTrustedDomain && (sameDomain || actionIsTrusted) && info.isHTTPS) {
    console.log('[FFD] Trusted domain with safe submission - skipping most checks');
    // Only check Safe Browsing API (if configured) and return early
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime.id) {
          console.warn('[FFD] Extension context invalidated - extension may have been reloaded');
          return reasons; // Skip Safe Browsing check if extension was reloaded
        }
        
        // Normalize URL to absolute URL for Safe Browsing API
        const urlToCheck = normalizeUrlForSafeBrowsing(info.action || window.location.href);
        
        const sbResult = await new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage(
              { type: 'CHECK_SAFE_BROWSING', payload: { url: urlToCheck } },
              (response) => {
                if (chrome.runtime.lastError) {
                  // Extension context invalidated - extension was reloaded
                  if (chrome.runtime.lastError.message && chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    console.warn('[FFD] Extension was reloaded, Safe Browsing check skipped');
                    resolve({ safe: 'unknown', reason: 'Extension reloaded' });
                  } else {
                    resolve({ safe: 'unknown', reason: chrome.runtime.lastError.message });
                  }
                } else if (response && response.payload) {
                  resolve(response.payload);
                } else {
                  resolve({ safe: 'unknown' });
                }
              }
            );
          } catch (e) {
            console.warn('[FFD] Failed to send Safe Browsing message:', e);
            resolve({ safe: 'unknown', reason: e.message });
          }
        });
        
        if (sbResult && sbResult.safe === false) {
          reasons.push(`🔴 ${sbResult.reason || 'URL flagged by Google Safe Browsing'}`);
        }
      } catch (e) {
        // Silently handle - extension may have been reloaded
        if (!e.message || !e.message.includes('Extension context invalidated')) {
          console.warn('[FFD] Safe Browsing check failed:', e);
        }
      }
    }
    
    // If Safe Browsing says it's safe (or unknown), return empty reasons (no warning)
    return reasons;
  }

  // Check Safe Browsing API
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime.id) {
        console.warn('[FFD] Extension context invalidated - extension may have been reloaded');
        // Continue with other checks even if Safe Browsing is unavailable
      } else {
        // Normalize URL to absolute URL for Safe Browsing API
        const urlToCheck = normalizeUrlForSafeBrowsing(info.action || window.location.href);
        
        const sbResult = await new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage(
              { type: 'CHECK_SAFE_BROWSING', payload: { url: urlToCheck } },
              (response) => {
                if (chrome.runtime.lastError) {
                  // Extension context invalidated - extension was reloaded
                  if (chrome.runtime.lastError.message && chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    console.warn('[FFD] Extension was reloaded, Safe Browsing check skipped');
                    resolve({ safe: 'unknown', reason: 'Extension reloaded' });
                  } else {
                    resolve({ safe: 'unknown', reason: chrome.runtime.lastError.message });
                  }
                } else if (response && response.payload) {
                  resolve(response.payload);
                } else {
                  resolve({ safe: 'unknown' });
                }
              }
            );
          } catch (e) {
            console.warn('[FFD] Failed to send Safe Browsing message:', e);
            resolve({ safe: 'unknown', reason: e.message });
          }
        });
        
        if (sbResult && sbResult.safe === false) {
          reasons.push(`🔴 ${sbResult.reason || 'URL flagged by Google Safe Browsing'}`);
        }
      }
    } catch (e) {
      // Silently handle - extension may have been reloaded
      if (!e.message || !e.message.includes('Extension context invalidated')) {
        console.warn('[FFD] Safe Browsing check failed:', e);
      }
    }
  }

  // Use ML-based detection if available
  if (typeof window.__ffd_ml !== 'undefined') {
    const mlResult = window.__ffd_ml.mlEvaluateRisk(info, CONFIG);
    
    if (mlResult.isSuspicious) {
      reasons.push(`⚠️ ML Risk Score: ${(mlResult.riskScore * 100).toFixed(1)}%`);
      
      // Add ML-detected patterns
      if (mlResult.patterns && mlResult.patterns.length > 0) {
        reasons.push(...mlResult.patterns);
      }
    }
  }

  // Legacy heuristic checks (still useful)
  
  // 1. action domain mismatch
  if (info.actionDomain && info.actionDomain !== info.pageDomain) {
    if (!CONFIG.trustedDomains.includes(info.actionDomain)) {
      reasons.push(`Form action posts to a different domain: ${info.actionDomain}`);
    }
  }

  // 2. Absence of HTTPS
  if (!info.isHTTPS) reasons.push('Page is not loaded over HTTPS');

  // 3. Hidden inputs presence
  // Check if domain is trusted first - trusted domains often use many hidden inputs for CSRF tokens, analytics, etc.
  // isTrustedDomain is already declared above, reuse it
  
  const hiddenCount = info.inputs.filter(i => i.hidden).length;
  
  // Only flag hidden inputs if domain is NOT trusted
  // Trusted domains like Facebook use many hidden inputs legitimately (CSRF tokens, session data, analytics)
  if (!isTrustedDomain && hiddenCount >= (CONFIG.hiddenInputThreshold || 2)) {
    reasons.push(`Form contains ${hiddenCount} hidden inputs (potential data exfiltration)`);
  }
  // For trusted domains, use a much higher threshold (only flag if suspiciously high)
  else if (isTrustedDomain && hiddenCount > 50) {
    reasons.push(`Form contains ${hiddenCount} hidden inputs (unusually high even for trusted domain)`);
  }

  // 4. Brand impersonation
  if (info.brand) {
    const expected = CONFIG.trustedDomains.find(d => d.includes(info.brand));
    if (!info.pageDomain.includes(info.brand) && !expected) {
      reasons.push(`Page UI seems to impersonate ${info.brand} but domain is ${info.pageDomain}`);
    } else {
      if (info.actionDomain && !info.actionDomain.includes(info.brand) && info.actionDomain !== info.pageDomain) {
        reasons.push(`Form action domain ${info.actionDomain} does not match ${info.brand} domain`);
      }
    }
  } else {
    // Fuzzy check for brand mentions in title
    for (const b of ['instagram', 'facebook', 'gmail', 'google', 'twitter', 'linkedin', 'amazon']) {
      if ((info.pageTitle || '').toLowerCase().includes(b) && !info.pageDomain.includes(b)) {
        reasons.push(`Page title mentions "${b}" but domain is ${info.pageDomain}`);
        break;
      }
    }
  }

  // 5. Suspicious input names
  const suspiciousNames = ['email', 'username', 'user', 'login', 'passwd', 'password'];
  const hasSuspicious = info.inputs.some(i => suspiciousNames.includes((i.name || '').toLowerCase()));
  if (!hasSuspicious && !info.isJSSubmission) {
    const usernameLike = info.inputs.some(i => /(user(name)?|email|login)/i.test(i.name + i.id));
    if (!usernameLike) reasons.push('No identifiable username/email field found alongside password');
  }

  // Dedupe
  return Array.from(new Set(reasons));
}

/**
 * Show warning banner on page load (non-blocking)
 */
function showWarningBanner(form, reasons, formInfo) {
  // Remove existing banner if any
  const existingBanner = document.getElementById('__ffd_banner');
  if (existingBanner) existingBanner.remove();

  const banner = document.createElement('div');
  banner.id = '__ffd_banner';
  banner.style = `
    position: fixed; top: 0; left: 0; right: 0; 
    background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%);
    color: white; padding: 16px 20px; z-index: 2147483646;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
  `;

  const leftSection = document.createElement('div');
  leftSection.style = 'flex: 1; min-width: 200px;';
  
  const title = document.createElement('div');
  title.innerText = '⚠️ Suspicious Login Form Detected';
  title.style = 'font-weight: 600; font-size: 16px; margin-bottom: 4px;';
  
  const reasonsText = document.createElement('div');
  reasonsText.innerText = reasons.slice(0, 2).join(' • ');
  reasonsText.style = 'font-size: 13px; opacity: 0.9;';
  
  if (reasons.length > 2) {
    const moreText = document.createElement('div');
    moreText.innerText = `+ ${reasons.length - 2} more reasons`;
    moreText.style = 'font-size: 12px; opacity: 0.8; margin-top: 4px;';
    reasonsText.appendChild(moreText);
  }
  
  leftSection.appendChild(title);
  leftSection.appendChild(reasonsText);

  const rightSection = document.createElement('div');
  rightSection.style = 'display: flex; gap: 8px; flex-wrap: wrap;';
  
  const viewBtn = document.createElement('button');
  viewBtn.innerText = 'View Details';
  viewBtn.style = 'padding: 8px 16px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;';
  viewBtn.onclick = () => {
    banner.remove();
    showWarningModal(form, reasons, formInfo);
  };
  
  const dismissBtn = document.createElement('button');
  dismissBtn.innerText = '✕';
  dismissBtn.style = 'padding: 8px 12px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); color: white; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;';
  dismissBtn.onclick = () => banner.remove();

  rightSection.appendChild(viewBtn);
  rightSection.appendChild(dismissBtn);

  banner.appendChild(leftSection);
  banner.appendChild(rightSection);
  document.documentElement.appendChild(banner);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (banner.parentNode) {
      banner.style.transition = 'opacity 0.3s';
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 300);
    }
  }, 10000);
}

/**
 * Show warning modal (synchronous version for form submissions)
 */
function showWarningModal(form, reasons, formInfo) {
  // Prevent multiple modals
  if (document.getElementById('__ffd_modal')) return;

  const container = document.createElement('div');
  container.id = '__ffd_modal';
  container.style = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display:flex; align-items:center; justify-content:center; z-index: 2147483647;
  `;

  const dialog = document.createElement('div');
  dialog.style = `
    width: min(680px, 95%); background: #fff; border-radius: 12px; padding: 24px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.35); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    max-height: 90vh; overflow-y: auto;
  `;

  const title = document.createElement('h2');
  title.innerText = '🔒 Security Warning — Suspicious Login Form Detected';
  title.style = 'margin:0 0 12px 0; font-size:20px; color:#d32f2f; font-weight:600;';

  const p = document.createElement('p');
  p.innerText = 'This page appears to have characteristics commonly used in phishing pages. Please review the reasons below and decide carefully.';
  p.style = 'margin:0 0 16px 0; color:#555; line-height:1.5;';

  const ul = document.createElement('ul');
  ul.style = 'margin:0 0 16px 0; padding-left:20px; color:#333;';
  reasons.forEach(r => {
    const li = document.createElement('li');
    li.innerText = r;
    li.style = 'margin-bottom:8px; line-height:1.4;';
    ul.appendChild(li);
  });

  const details = document.createElement('details');
  details.style = 'margin-bottom:16px;';
  const summary = document.createElement('summary');
  summary.innerText = 'Show technical details';
  summary.style = 'cursor:pointer; color:#1976d2; margin-bottom:8px;';
  const pre = document.createElement('pre');
  pre.style = 'background:#f7f7f7;padding:12px;border-radius:6px;overflow:auto;max-height:200px;font-size:12px;';
  pre.innerText = JSON.stringify(formInfo, null, 2);
  details.appendChild(summary);
  details.appendChild(pre);

  const btnContainer = document.createElement('div');
  btnContainer.style = 'display:flex; gap:12px; justify-content:flex-end; margin-top:20px; flex-wrap:wrap;';

  const cancelBtn = document.createElement('button');
  cancelBtn.innerText = 'Cancel Submission';
  cancelBtn.style = 'padding:10px 20px; border-radius:6px; border:1px solid #bbb; background:#fff; cursor:pointer; font-size:14px; font-weight:500;';
  cancelBtn.onclick = () => {
    container.remove();
    console.info('FFD: submission cancelled by user', formInfo);
  };

  const reportBtn = document.createElement('button');
  reportBtn.innerText = 'Report as Phishing';
  reportBtn.style = 'padding:10px 20px; border-radius:6px; border:0; background:#1976d2; color:#fff; cursor:pointer; font-size:14px; font-weight:500;';
  reportBtn.onclick = async () => {
    container.remove();
    try {
      // Add to blacklist
      if (typeof window.__ffd_domainList !== 'undefined') {
        await window.__ffd_domainList.addToBlacklist(formInfo.actionDomain || formInfo.pageDomain);
      }
      
      // Send report
      if (navigator.sendBeacon) {
        navigator.sendBeacon('https://example-collection-endpoint.org/report', JSON.stringify({
          time: new Date().toISOString(),
          url: window.location.href,
          formInfo: formInfo,
          reasons
        }));
      }
      alert('Reported and added to blacklist. Thank you!');
    } catch (e) {
      console.warn('FFD: report failed', e);
      alert('Reported (demo).');
    }
  };

  const proceedBtn = document.createElement('button');
  proceedBtn.innerText = 'Proceed Anyway';
  proceedBtn.style = 'padding:10px 20px; border-radius:6px; border:0; background:#d32f2f; color:#fff; cursor:pointer; font-size:14px; font-weight:500;';
  proceedBtn.onclick = () => {
    container.remove();
    try {
      form.__ffd_hooked = false;
      form.submit();
      console.info('FFD: user chose to proceed and form submitted', formInfo);
    } catch (e) {
      console.error('FFD: failed to submit programmatically', e);
    }
  };

  btnContainer.appendChild(reportBtn);
  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(proceedBtn);

  dialog.appendChild(title);
  dialog.appendChild(p);
  dialog.appendChild(ul);
  dialog.appendChild(details);
  dialog.appendChild(btnContainer);
  container.appendChild(dialog);
  document.documentElement.appendChild(container);
}

/**
 * Async version of warning modal for JS-based submissions
 */
function showWarningModalAsync(formInfo, reasons) {
  return new Promise((resolve) => {
    if (document.getElementById('__ffd_modal_async')) {
      resolve(false);
      return;
    }

    const container = document.createElement('div');
    container.id = '__ffd_modal_async';
    container.style = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      display:flex; align-items:center; justify-content:center; z-index: 2147483647;
    `;

    const dialog = document.createElement('div');
    dialog.style = `
      width: min(680px, 95%); background: #fff; border-radius: 12px; padding: 24px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.35); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    `;

    const title = document.createElement('h2');
    title.innerText = '🔒 Suspicious JavaScript-Based Submission Detected';
    title.style = 'margin:0 0 12px 0; font-size:20px; color:#d32f2f;';

    const ul = document.createElement('ul');
    ul.style = 'margin:0 0 16px 0; padding-left:20px;';
    reasons.forEach(r => {
      const li = document.createElement('li');
      li.innerText = r;
      ul.appendChild(li);
    });

    const btnContainer = document.createElement('div');
    btnContainer.style = 'display:flex; gap:12px; justify-content:flex-end;';

    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'Block Request';
    cancelBtn.style = 'padding:10px 20px; border-radius:6px; border:1px solid #bbb; background:#fff; cursor:pointer;';
    cancelBtn.onclick = () => {
      container.remove();
      resolve(false);
    };

    const proceedBtn = document.createElement('button');
    proceedBtn.innerText = 'Allow Request';
    proceedBtn.style = 'padding:10px 20px; border-radius:6px; border:0; background:#d32f2f; color:#fff; cursor:pointer;';
    proceedBtn.onclick = () => {
      container.remove();
      resolve(true);
    };

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(proceedBtn);

    dialog.appendChild(title);
    dialog.appendChild(ul);
    dialog.appendChild(btnContainer);
    container.appendChild(dialog);
    document.documentElement.appendChild(container);
  });
}

// Initialize immediately and also after delay
function initializeExtension() {
  console.log('[FFD] ========================================');
  console.log('[FFD] Initializing Fake Form Detection Extension...');
  console.log('[FFD] Extension version: 1.0.0');
  console.log('[FFD] CONFIG loaded:', CONFIG);
  console.log('[FFD] Current URL:', window.location.href);
  console.log('[FFD] Forms found:', document.forms.length);
  console.log('[FFD] ========================================');
  
  // Scan forms immediately
  initFormScanner();
  initJSInterception();
  
  // Also scan on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[FFD] DOM loaded, scanning forms...');
      initFormScanner();
    });
  } else {
    // DOM already loaded
    console.log('[FFD] DOM already loaded, scanning forms...');
    initFormScanner();
  }
  
  // Also scan after a delay to catch late-loading forms
  setTimeout(() => {
    console.log('[FFD] Delayed scan for dynamic forms...');
    initFormScanner();
  }, 800);
  
  // Final scan after 2 seconds
  setTimeout(() => {
    console.log('[FFD] Final scan...');
    initFormScanner();
  }, 2000);
}

// Start initialization immediately
// Try multiple initialization strategies to ensure it runs
(function() {
  'use strict';
  
  // Immediate initialization
  try {
    initializeExtension();
  } catch (e) {
    console.error('[FFD] Initial initialization failed:', e);
  }
  
  // Also initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      try {
        initializeExtension();
      } catch (e) {
        console.error('[FFD] DOMContentLoaded initialization failed:', e);
      }
    });
  }
  
  // Also initialize on window load
  window.addEventListener('load', function() {
    try {
      initializeExtension();
    } catch (e) {
      console.error('[FFD] Window load initialization failed:', e);
    }
  });
  
  // Immediate timeout as backup
  setTimeout(function() {
    try {
      if (!window.__ffd) {
        console.warn('[FFD] Extension not initialized after 100ms, retrying...');
        initializeExtension();
      }
    } catch (e) {
      console.error('[FFD] Timeout initialization failed:', e);
    }
  }, 100);
})();

// Observe DOM mutations for forms added dynamically
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes && m.addedNodes.length) {
      setTimeout(() => initFormScanner(), 200);
      break;
    }
  }
});
observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

// Export for testing in console
window.__ffd = { analyzeForm, evaluateFormRisk, initFormScanner, initJSInterception };