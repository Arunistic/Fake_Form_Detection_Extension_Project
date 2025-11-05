# 🔐 Safe Browsing API Setup Guide

## Error: 403 Forbidden

If you're seeing `Safe Browsing API error: 403`, it means your API key is not working. Here's how to fix it:

---

## Quick Fix Options

### Option 1: Disable Safe Browsing (Easiest)

If you don't need Safe Browsing API, just disable it:

1. Open `extension/config.js`
2. Change this line:
   ```javascript
   USE_SAFE_BROWSING: false,  // Change from true to false
   ```
3. Reload the extension

**The extension will still work** - it just won't use Safe Browsing API. All other detection features (ML, domain checks, etc.) will still work.

---

### Option 2: Fix Your API Key (Recommended)

Follow these steps to get a working API key:

## Step 1: Enable Safe Browsing API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
4. Search for **"Safe Browsing API"**
5. Click on it and click **"Enable"**

## Step 2: Create API Key

1. Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **"Create Credentials"** → **"API Key"**
3. Copy your new API key

## Step 3: Configure API Key Restrictions (Optional but Recommended)

1. Click on your API key to edit it
2. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check only **"Safe Browsing API"**
3. Under **"Application restrictions"**:
   - For development: Leave as "None" or set to "HTTP referrers"
   - For production: Use "IP addresses" or "HTTP referrers"
4. Click **"Save"**

## Step 4: Add API Key to Extension

1. Open `extension/config.js`
2. Replace `YOUR_API_KEY_HERE` with your actual API key:
   ```javascript
   SAFE_BROWSING_API_KEY: 'YOUR_ACTUAL_API_KEY_HERE',
   ```
3. Make sure `USE_SAFE_BROWSING: true` is set
4. Reload the extension

---

## Common 403 Error Causes

### 1. API Not Enabled
**Problem:** Safe Browsing API is not enabled in your Google Cloud project.

**Solution:** 
- Go to [APIs & Services > Library](https://console.cloud.google.com/apis/library)
- Enable "Safe Browsing API"

### 2. Invalid API Key
**Problem:** The API key in `config.js` is wrong or expired.

**Solution:**
- Generate a new API key in Google Cloud Console
- Update `config.js` with the new key

### 3. API Key Restrictions
**Problem:** Your API key has restrictions (IP/referrer) that block the extension.

**Solution:**
- Edit your API key in Google Cloud Console
- Remove or adjust restrictions for development
- For production, use appropriate restrictions

### 4. Quota Exceeded
**Problem:** You've exceeded the free quota (10,000 requests/day).

**Solution:**
- Check quota in Google Cloud Console
- Wait for quota to reset (daily)
- Or upgrade to paid plan

### 5. Wrong API Key Format
**Problem:** API key is malformed or incomplete.

**Solution:**
- Make sure you copied the entire API key
- No extra spaces or characters
- Should start with `AIza...`

---

## Testing Your API Key

### Test 1: Check if API is Enabled

1. Go to: https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com
2. Verify it shows **"API enabled"** (green checkmark)

### Test 2: Check API Key

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your API key
3. Click on it to view details
4. Verify:
   - ✅ Status: Enabled
   - ✅ API restrictions: Safe Browsing API (or None)
   - ✅ No application restrictions blocking requests

### Test 3: Test API Key Directly

You can test your API key using curl:

```bash
curl -X POST \
  "https://safebrowsing.googleapis.com/v4/threatMatches:find?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "client": {
      "clientId": "test",
      "clientVersion": "1.0"
    },
    "threatInfo": {
      "threatTypes": ["MALWARE"],
      "platformTypes": ["ANY_PLATFORM"],
      "threatEntryTypes": ["URL"],
      "threatEntries": [{"url": "http://malware.testing.google.test/testing/malware/"}]
    }
  }'
```

If you get a 200 response, your API key works!

---

## Free Tier Limits

- **Free quota:** 10,000 requests per day
- **Rate limit:** 10 requests per second
- **Cost after free tier:** $0.0005 per request

---

## Troubleshooting Checklist

- [ ] Safe Browsing API is enabled in Google Cloud Console
- [ ] API key is correct in `config.js`
- [ ] API key has no restrictions blocking requests
- [ ] Quota not exceeded (check Google Cloud Console)
- [ ] API key is enabled (not deleted/disabled)
- [ ] Extension reloaded after updating config.js

---

## Still Not Working?

1. **Check Console Logs:**
   - Open browser console (F12)
   - Look for detailed error messages
   - Copy the full error message

2. **Check Google Cloud Console:**
   - Go to "APIs & Services" → "Dashboard"
   - Check for any errors or warnings
   - Check quota usage

3. **Disable Safe Browsing:**
   - If you can't fix it, just disable it
   - Set `USE_SAFE_BROWSING: false` in `config.js`
   - Extension will still work without it

---

## Security Note

**⚠️ Important:** Never commit your API key to public repositories!

For production, use a backend proxy to:
- Keep API key secure
- Cache results
- Reduce API calls
- Monitor usage

---

## Alternative: Use Without Safe Browsing

The extension works perfectly fine without Safe Browsing API! Just set:

```javascript
USE_SAFE_BROWSING: false
```

You'll still have:
- ✅ ML-based detection
- ✅ Domain mismatch detection
- ✅ HTTPS checking
- ✅ Hidden input detection
- ✅ Brand impersonation detection
- ✅ JavaScript interception
- ✅ Blacklist/whitelist

Only the Google Safe Browsing check will be disabled.