Safe Browsing check failed: TypeError: Failed to construct 'URL': Invalid URL
Context
service_worker.js
Stack Trace
service_worker.js:87 (anonymous function)
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
97
98
99
100
101
102
103
104
105
106
107
108
109
110
111
112
113
114
115
116
117
118
119
120
121
122
123
124
125
126
127
128
129
130
131
132
133
134
135
136
137
138
139
140
141
142
143
144
145
146
147
148
149
150
151
152
153
154
155
156
157
158
159
160
161
162
163
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

/**
 * Check URL against Google Safe Browsing API
 * NOTE: For production, use a backend proxy to keep API key secure
 */
async function checkSafeBrowsing(url) {
  if (!CONFIG.USE_SAFE_BROWSING || !CONFIG.SAFE_BROWSING_API_KEY || CONFIG.SAFE_BROWSING_API_KEY === 'YOUR_API_KEY_HERE') {
    return { safe: 'unknown', reason: 'API key not configured' };
  }

  try {
    // Extract domain from URL
    const domain = new URL(url).hostname;
    
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
          { url: url }
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
      throw new Error(`Safe Browsing API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if threats were found
    if (data.matches && data.matches.length > 0) {
      const threats = data.matches.map(m => m.threatType).join(', ');
      return {
        safe: false,
        threats: data.matches,
        threatTypes: threats,
        reason: `URL flagged by Google Safe Browsing: ${threats}`
      };
    }

    return { safe: true, reason: 'No threats found' };
  } catch (error) {
    console.error('Safe Browsing check failed:', error);
    return { safe: 'unknown', reason: `Check failed: ${error.message}` };
  }
}

/**# 🧪 How to Test the Fake Form Detection Extension

## Quick Start Testing

### Step 1: Load the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension` folder from this project
5. Verify it shows "Fake Form Detection (Enhanced)" version 1.0.0

### Step 2: Open Browser Console
**Press F12** or **Right-click → Inspect → Console tab**
- This shows debug logs from the extension
- Look for messages starting with `[FFD]`

---

## Test 1: Basic Form Detection (Test Site)

### What to Test
The extension should detect a suspicious login form.

### Steps
1. Open `test-site/fake-login.html` in Chrome
   - You can drag & drop the file into Chrome, or
   - Right-click the file → Open with → Chrome
2. **Immediately** you should see:
   - ✅ **Red warning banner** at the top of the page
   - ✅ Console logs showing `[FFD]` messages

3. Try to submit the form:
   - ✅ Form submission is **blocked**
   - ✅ **Full warning modal** appears
   - ✅ Console shows: `[FFD] ⚠️ BLOCKING FORM SUBMISSION - Suspicious!`

### Expected Console Output
```
[FFD] Initializing Fake Form Detection Extension...
[FFD] Found 1 forms on page
[FFD] Form info: {action: "http://fake-instagram.com/login", ...}
[FFD] ⚠️ Suspicious form detected! Reasons: [...]
[FFD] Form submission intercepted!
[FFD] ⚠️ BLOCKING FORM SUBMISSION - Suspicious!
```

### What Should Trigger Detection
- ✅ Form posts to different domain (`fake-instagram.com` vs `localhost`)
- ✅ Page not using HTTPS
- ✅ Brand impersonation (Instagram)
- ✅ Hidden input field

---

## Test 2: API Call Detection

### What to Test
The extension should detect suspicious JavaScript API calls (fetch/XHR).

### Steps
1. Open `test-site/test-api-calls.html` in Chrome
2. Click each test button one by one
3. For each suspicious test (1-4), you should see:
   - ✅ **Warning modal** appears
   - ✅ Console shows: `[FFD] ⚠️ Suspicious fetch detected!` or `[FFD] ⚠️ Suspicious XHR detected!`
   - ✅ Option to block or allow the request

### Test Buttons Explained

| Button | Should Trigger? | Why |
|--------|----------------|-----|
| Test 1: Fetch with Credentials | ✅ YES | Contains password, sends to external domain |
| Test 2: External Domain | ✅ YES | Posts to different domain |
| Test 3: XHR with Credentials | ✅ YES | XMLHttpRequest with password |
| Test 4: FormData Submission | ✅ YES | FormData contains email/password |
| Test 5: Safe API Call | ❌ NO | GET request, no credentials |

---

## Test 3: Real-World Phishing Sites

### ⚠️ WARNING: Only Test on Known Safe Test Sites

You can test on legitimate sites to verify the extension doesn't cause false positives:

### Safe Tests (Should NOT Trigger)
1. **Instagram.com** - Real login page
   - Should NOT show warning
   - Should allow submission

2. **Gmail.com** - Real Google login
   - Should NOT show warning
   - Should allow submission

3. **Facebook.com** - Real Facebook login
   - Should NOT show warning
   - Should allow submission

### How to Verify
- Open console (F12)
- Look for `[FFD]` logs
- Should see: `[FFD] ✓ Form appears safe`
- No warning banner should appear
- Form should submit normally

---

## Test 4: Safe Browsing API

### Prerequisites
- API key must be set in `extension/config.js`
- Need internet connection

### Steps
1. Make sure your API key is configured
2. Visit a known phishing test URL (use Google's test URLs)
3. The extension should check Safe Browsing API
4. Console should show Safe Browsing check results

### Test URLs (Use with Caution)
- Google provides test URLs for Safe Browsing API
- Check [Google Safe Browsing API docs](https://developers.google.com/safe-browsing/v4/test) for test URLs

---

## Test 5: Blacklist/Whitelist

### Test Blacklist
1. Open browser console on any page
2. Run:
   ```javascript
   await window.__ffd_domainList.addToBlacklist('test-phishing.com');
   ```
3. Try to submit a form to that domain
4. Should be blocked immediately

### Test Whitelist
1. Open browser console
2. Run:
   ```javascript
   await window.__ffd_domainList.addToWhitelist('trusted-site.com');
   ```
3. Forms to that domain should be allowed

---

## Visual Indicators

### ✅ Extension is Working

1. **Warning Banner** (on page load if suspicious):
   - Red banner at top of page
   - Shows "⚠️ Suspicious Login Form Detected"
   - Has "View Details" and "✕" buttons

2. **Warning Modal** (on form submit or API call):
   - Full-screen overlay
   - Red title: "🔒 Security Warning"
   - List of reasons
   - Three buttons: Report, Cancel, Proceed

3. **Console Logs**:
   - All start with `[FFD]`
   - Show detection process step-by-step

### ❌ Extension is NOT Working

If you see:
- No banner on test site
- No console logs
- Form submits without warning

**Troubleshooting:**
1. Check extension is loaded: `chrome://extensions/`
2. Check extension is enabled (toggle ON)
3. Reload the page (Ctrl+Shift+R)
4. Check console for errors (red messages)
5. Check `manifest.json` is valid

---

## Quick Test Checklist

Use this checklist to verify everything works:

- [ ] Extension loads in Chrome without errors
- [ ] Test site (`fake-login.html`) shows warning banner
- [ ] Test site form submission is blocked
- [ ] Warning modal appears on form submit
- [ ] API test page (`test-api-calls.html`) detects fetch calls
- [ ] API test page detects XHR calls
- [ ] Console shows `[FFD]` debug logs
- [ ] Real Instagram/Gmail login does NOT trigger (false positive check)
- [ ] Safe API calls (GET requests) do NOT trigger
- [ ] Blacklist/whitelist works (optional)

---

## Common Issues

### Issue: No Banner Appears
**Solution:**
1. Open console (F12)
2. Check for `[FFD]` logs
3. If no logs, extension may not be loaded
4. Reload extension: `chrome://extensions/` → Click reload icon

### Issue: Form Submits Without Warning
**Solution:**
1. Check console for `[FFD] Form submission intercepted!`
2. If missing, form handler may not be attached
3. Try hard refresh: Ctrl+Shift+R
4. Check if form has password field (required)

### Issue: API Calls Not Detected
**Solution:**
1. Check console for `[FFD] Fetch intercepted:` or `[FFD] XHR intercepted:`
2. Verify request is POST/PUT/PATCH (not GET)
3. Verify request contains credential keywords
4. Check if request goes to external domain

### Issue: Too Many False Positives
**Solution:**
1. Adjust `riskThreshold` in `config.js` (increase to reduce sensitivity)
2. Add legitimate domains to whitelist
3. Check ML weights in `config.js`

---

## Testing Tips

1. **Always check the console** - It shows what the extension is doing
2. **Test on multiple pages** - Different sites behave differently
3. **Test both forms and API calls** - Both should work
4. **Verify false positives** - Real sites should NOT trigger
5. **Check Safe Browsing** - If API key is set, verify it works

---

## Need Help?

If something isn't working:
1. Check browser console for errors
2. Verify extension is loaded and enabled
3. Check `config.js` has valid settings
4. Review console logs for `[FFD]` messages
5. Try reloading extension and page

---

## File Locations

- **Test Site 1**: `test-site/fake-login.html` - Basic form detection
- **Test Site 2**: `test-site/test-api-calls.html` - API call detection
- **Extension**: `extension/` folder
- **Config**: `extension/config.js`

Happy Testing! 🎉
