# Changelog - Fake Form Detection Extension

## Version 1.0.0 - Major Upgrade (Current)

### 🚀 New Features

#### 1. Google Safe Browsing API Integration
- **File**: `service_worker.js`
- Real-time URL checking against Google's threat database
- Detects malware, phishing, and unwanted software
- Configurable API key in `config.js`
- Graceful fallback if API unavailable

#### 2. Machine Learning-Based Detection
- **File**: `ml-detector.js` (new)
- Heuristic-based risk scoring (0-100%)
- Feature extraction (domain, HTTPS, hidden inputs, brand impersonation)
- Pattern matching for:
  - Typosquatting detection
  - Subdomain abuse
  - Suspicious TLDs (.tk, .ml, .ga, .cf, .xyz)
  - IP address domains
- Configurable ML weights and risk thresholds

#### 3. Blacklist/Whitelist System
- **File**: `blacklist.js` (new)
- Persistent domain management using Chrome storage
- User reporting adds domains to blacklist
- Whitelist support for trusted domains
- Backend sync capability (optional)

#### 4. Expanded Brand Detection
- **File**: `utils.js` (enhanced)
- **Before**: 3 brands (Instagram, Facebook, Gmail)
- **After**: 20+ brands including:
  - Social: Instagram, Facebook, Twitter/X, LinkedIn, Reddit, Discord
  - Email: Gmail, Yahoo, Outlook
  - Shopping: Amazon, eBay
  - Tech: Microsoft, Apple, GitHub, Adobe, Dropbox
  - Banking: Bank of America, Wells Fargo, Chase
  - Media: Netflix, Spotify
  - Payments: PayPal
- Improved detection algorithm with scoring

#### 5. JavaScript-Based Submission Interception
- **File**: `content_script.js` (enhanced)
- Monitors `fetch()` API calls
- Intercepts `XMLHttpRequest` submissions
- Detects credential submissions via JavaScript
- Blocks suspicious JS-based credential requests

#### 6. Configuration System
- **File**: `config.js` (new)
- Centralized configuration
- API key management
- ML weight configuration
- Risk threshold settings
- Trusted domains list

### 🔧 Technical Improvements

#### Enhanced Content Script
- Integrated ML detection
- Blacklist/whitelist checks
- Safe Browsing API integration
- Improved error handling
- Better modal UI with risk scores

#### Enhanced Service Worker
- Safe Browsing API implementation
- Backend API support (optional)
- Config loading from storage
- Proper message handling

#### Enhanced Brand Detection
- Score-based algorithm
- Logo/keyword matching
- Body text analysis
- Multiple brand mentions detection

### 📊 Detection Capabilities

#### Before (v0.1.0)
- Basic domain mismatch detection
- HTTPS check
- Hidden input count
- Simple brand detection (3 brands)
- Form submission only

#### After (v1.0.0)
- ✅ All previous features
- ✅ ML-based risk scoring
- ✅ Google Safe Browsing API
- ✅ Blacklist/whitelist system
- ✅ 20+ brand detection
- ✅ JavaScript interception (fetch/XHR)
- ✅ Pattern matching (typosquatting, etc.)
- ✅ Enhanced UI with risk scores

### 🎯 Performance

- ML detection: < 10ms (lightweight heuristics)
- Safe Browsing API: ~100-200ms (network call)
- Blacklist check: < 5ms (local storage)
- Total overhead: Minimal for most cases

### 📝 Breaking Changes

- **Config location**: Now uses `config.js` instead of hardcoded values
- **Message format**: Service worker uses `chrome.runtime.onMessage` instead of `self.addEventListener('message')`
- **API requirements**: Safe Browsing API key recommended (optional)

### 🔄 Migration Guide

1. Backup existing extension
2. Replace all files with new version
3. Update `config.js` with your API key (optional)
4. Reload extension in Chrome
5. Existing blacklist data will persist (if any)

### 📚 Documentation

- **README.md**: Updated with new features
- **UPGRADE_GUIDE.md**: Comprehensive setup guide
- **CHANGELOG.md**: This file
- Inline code comments throughout

### 🐛 Bug Fixes

- Fixed message handling between content script and service worker
- Improved error handling for missing Chrome APIs
- Better handling of edge cases in domain extraction

### ⚠️ Known Limitations

- Safe Browsing API requires API key (free tier: 10,000 requests/day)
- Some sites may bypass detection with service workers
- ML model is heuristic-based (not neural network)
- JavaScript interception can be bypassed by obfuscated code

---

## Version 0.1.0 - Initial Release

### Features
- Basic form submission interception
- Domain mismatch detection
- HTTPS check
- Hidden input detection
- Simple brand detection (Instagram, Facebook, Gmail)
- Warning modal with basic options
- Dynamic form support (MutationObserver)

