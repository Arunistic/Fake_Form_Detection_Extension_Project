# Upgrade Guide - Fake Form Detection Extension

## 🚀 New Features Added

### 1. **Google Safe Browsing API Integration**
- Real-time URL checking against Google's threat database
- Detects malware, phishing, and unwanted software
- **Setup Required**: Add your API key in `config.js`

### 2. **Backend Blacklist/Whitelist System**
- Persistent domain blacklist/whitelist using Chrome storage
- Users can report phishing sites to add to blacklist
- Automatic blocking of blacklisted domains
- Whitelist support for trusted sites

### 3. **Machine Learning-Based Detection**
- Heuristic-based risk scoring (0-100%)
- Pattern matching for typosquatting, subdomain abuse, suspicious TLDs
- Weighted feature analysis (domain mismatch, HTTPS, hidden inputs, etc.)
- Configurable risk thresholds

### 4. **Expanded Brand Detection**
- Now detects 20+ brands (was 3):
  - Social: Instagram, Facebook, Twitter/X, LinkedIn, Reddit, Discord
  - Email: Gmail, Yahoo, Outlook
  - Shopping: Amazon, eBay
  - Tech: Microsoft, Apple, GitHub, Adobe, Dropbox
  - Banking: Bank of America, Wells Fargo, Chase
  - Media: Netflix, Spotify
  - Payments: PayPal
- Improved brand detection with logo/keyword scoring

### 5. **JavaScript-Based Submission Interception**
- Monitors `fetch()` API calls
- Intercepts `XMLHttpRequest` submissions
- Detects credential submissions via JavaScript (bypassing form submits)
- Blocks suspicious JS-based credential requests

## 📋 Setup Instructions

### Step 1: Configure Google Safe Browsing API

1. Get your API key:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create a new project or select existing
   - Enable "Safe Browsing API"
   - Create credentials (API Key)
   
2. Update `extension/config.js`:
   ```javascript
   SAFE_BROWSING_API_KEY: 'YOUR_ACTUAL_API_KEY_HERE',
   USE_SAFE_BROWSING: true,
   ```

**⚠️ Security Note**: For production, use a backend proxy to keep your API key secure. Direct client-side API calls expose your key.

### Step 2: Configure Backend (Optional)

If you have a backend server:

1. Update `extension/config.js`:
   ```javascript
   BACKEND_URL: 'https://your-backend.com/api',
   USE_BACKEND: true,
   ```

2. Your backend should provide:
   - `POST /api/check-url` - URL threat checking
   - `GET /api/domain-lists` - Sync blacklist/whitelist

### Step 3: Install Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension` folder

## 🎯 How It Works

### Detection Flow

1. **Form Submission Interception**
   - Monitors all form submissions
   - Analyzes form structure, domain, and attributes

2. **Blacklist/Whitelist Check**
   - Checks if domain is blacklisted (blocks immediately)
   - Checks if domain is whitelisted (allows immediately)

3. **Safe Browsing API Check**
   - Queries Google Safe Browsing API
   - Returns threat status if configured

4. **ML-Based Risk Evaluation**
   - Extracts features (domain, HTTPS, hidden inputs, etc.)
   - Calculates risk score using weighted heuristics
   - Detects phishing patterns (typosquatting, etc.)

5. **Brand Impersonation Detection**
   - Checks if page mimics known brands
   - Verifies domain matches brand

6. **JavaScript Interception**
   - Monitors fetch/XHR calls
   - Detects credential submissions via JS

### Risk Scoring

The ML system calculates a risk score (0-100%) based on:
- **Domain Mismatch** (30% weight): Form posts to different domain
- **Missing HTTPS** (20% weight): Page not using HTTPS
- **Hidden Inputs** (15% weight): Suspicious number of hidden fields
- **Brand Impersonation** (25% weight): Page mimics brand but wrong domain
- **Suspicious Structure** (10% weight): Unusual form patterns

Forms with risk score ≥ 30% trigger warnings (configurable).

## 🛠️ Configuration Options

Edit `extension/config.js` to customize:

```javascript
{
  // Risk threshold (0-1)
  riskThreshold: 0.3,  // 30% risk triggers warning
  
  // ML weights (must sum to ~1.0)
  mlWeights: {
    domainMismatch: 0.3,
    missingHttps: 0.2,
    hiddenInputs: 0.15,
    brandImpersonation: 0.25,
    suspiciousStructure: 0.1
  },
  
  // Hidden input threshold
  hiddenInputThreshold: 2,
  
  // Trusted domains (whitelist)
  trustedDomains: [...]
}
```

## 📊 API Usage

### Safe Browsing API
- **Free Tier**: 10,000 requests/day
- **Cost**: $0.0005 per request after free tier
- **Rate Limits**: 10,000 requests/day free, higher with paid plans

### Reducing API Calls
- Cache results in Chrome storage
- Only check on suspicious forms (not all forms)
- Use blacklist for known bad domains

## 🔧 Advanced Features

### Manual Blacklist/Whitelist Management

Open browser console on any page and use:

```javascript
// Add to blacklist
await window.__ffd_domainList.addToBlacklist('example.com');

// Add to whitelist
await window.__ffd_domainList.addToWhitelist('trusted-site.com');

// Check lists
await window.__ffd_domainList.getLists();
```

### Testing ML Detection

```javascript
// Analyze a form
const form = document.querySelector('form');
const info = window.__ffd.analyzeForm(form);
const reasons = await window.__ffd.evaluateFormRisk(info);

// Check ML risk score
const mlResult = window.__ffd_ml.mlEvaluateRisk(info, CONFIG);
console.log('Risk Score:', mlResult.riskScore);
```

## 🐛 Troubleshooting

### Safe Browsing API Not Working
- Check API key is set correctly
- Verify API is enabled in Google Cloud Console
- Check browser console for errors
- Ensure you have quota remaining

### JavaScript Interception Not Working
- Some sites may use service workers or other techniques
- Check browser console for errors
- Verify extension is loaded (check `chrome://extensions/`)

### False Positives
- Adjust `riskThreshold` in config.js (increase to reduce false positives)
- Add legitimate domains to whitelist
- Adjust ML weights to reduce sensitivity

### False Negatives
- Decrease `riskThreshold` in config.js
- Add suspicious domains to blacklist
- Check that Safe Browsing API is enabled

## 📝 Notes

- **API Key Security**: Never commit API keys to public repositories
- **Performance**: ML detection is lightweight, but Safe Browsing API calls add latency
- **Privacy**: Safe Browsing API sends URLs to Google (consider backend proxy)
- **Compatibility**: Works with Chrome/Edge (Manifest V3)

## 🔄 Migration from Old Version

If upgrading from v0.1.0:
1. Backup your current extension
2. Replace files with new version
3. Update `config.js` with your API key
4. Reload extension in Chrome
5. Your stored data (blacklist) will persist

## 📚 Additional Resources

- [Google Safe Browsing API Docs](https://developers.google.com/safe-browsing)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Phishing Detection Best Practices](https://www.phishing.org/what-is-phishing)
