# 🔧 Troubleshooting Guide - Extension Not Loading

## Issue: Extension Not Detected (`window.__ffd` not found)

If you see "Extension NOT loaded!" in the diagnostic page, follow these steps:

---

## Step 1: Verify Extension is Installed

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Look for **"Fake Form Detection (Enhanced)"**
4. Check:
   - ✅ Extension is **visible** in the list
   - ✅ Toggle is **ON** (enabled)
   - ✅ Version shows **1.0.0**

**If extension is NOT visible:**
- Click **"Load unpacked"**
- Navigate to the `extension` folder
- Select the folder and click "Select Folder"

---

## Step 2: Check for Errors

1. On `chrome://extensions/`
2. Find your extension
3. Click **"Errors"** or **"Inspect views: service worker"**
4. Look for red error messages

**Common errors:**
- `File not found` → Files are missing
- `Syntax error` → JavaScript error in code
- `Permission denied` → Missing permissions

**If you see errors:**
- Take a screenshot
- Check that all files exist in `extension/` folder
- Verify `manifest.json` is valid JSON

---

## Step 3: Reload Extension

1. Go to `chrome://extensions/`
2. Find "Fake Form Detection (Enhanced)"
3. Click the **reload icon** (circular arrow)
4. Wait for it to reload
5. **Refresh the test page** (Ctrl+Shift+R)

---

## Step 4: Check File Structure

Your `extension/` folder should contain:
```
extension/
├── manifest.json          ✅ REQUIRED
├── config.js              ✅ REQUIRED
├── utils.js               ✅ REQUIRED
├── blacklist.js           ✅ REQUIRED
├── ml-detector.js         ✅ REQUIRED
├── content_script.js      ✅ REQUIRED
└── service_worker.js      ✅ REQUIRED
```

**Verify all files exist:**
- Open `extension/` folder
- Check that all 7 files are present
- Make sure no files are corrupted

---

## Step 5: Check Manifest.json

Open `extension/manifest.json` and verify:

1. **JSON is valid** (no syntax errors)
2. **All files are listed** in `content_scripts[0].js`:
   ```json
   "js": [
     "config.js",
     "utils.js",
     "blacklist.js",
     "ml-detector.js",
     "content_script.js"
   ]
   ```
3. **Matches pattern** includes your test site:
   ```json
   "matches": ["<all_urls>"]
   ```

---

## Step 6: Test in Console

1. Open the test page (`test-site/diagnostic.html`)
2. Press **F12** to open console
3. Type: `window.__ffd`
4. Press Enter

**Expected:**
- Should show: `{analyzeForm: ƒ, evaluateFormRisk: ƒ, ...}`

**If shows `undefined`:**
- Extension content script is not running
- Check for JavaScript errors in console
- Verify extension is enabled

---

## Step 7: Check Browser Console for Errors

1. Open test page
2. Press **F12** → **Console** tab
3. Look for:
   - Red error messages
   - Messages starting with `[FFD]`
   - Any JavaScript errors

**Expected console output:**
```
[FFD] ========================================
[FFD] Initializing Fake Form Detection Extension...
[FFD] Extension version: 1.0.0
```

**If no `[FFD]` messages:**
- Content script is not running
- Check extension errors (Step 2)
- Reload extension

---

## Step 8: Verify Content Script Injection

1. Open test page
2. Press **F12** → **Sources** tab
3. Look for:
   - `content_script.js` in the file tree
   - `config.js` in the file tree
   - Other extension files

**If files not visible:**
- Content scripts are not injecting
- Check manifest.json
- Reload extension

---

## Step 9: Check Extension Permissions

1. Go to `chrome://extensions/`
2. Click on your extension
3. Check **"Site access"** or **"Permissions"**
4. Verify:
   - ✅ Can access all sites
   - ✅ Storage permission granted
   - ✅ Active tab permission granted

---

## Step 10: Test on Different Page

1. Open a simple HTML page
2. Or use `test-site/fake-login.html`
3. Check console for `[FFD]` messages
4. If still not working, try:
   - Different browser (Edge, Brave)
   - Incognito mode (with extension enabled)

---

## Common Issues & Solutions

### Issue: "Extension not found"
**Solution:**
- Make sure you're loading the `extension` folder, not the parent folder
- Verify `manifest.json` is in the `extension/` folder

### Issue: "Content script not running"
**Solution:**
- Check for JavaScript errors in extension errors
- Verify all files exist and are not corrupted
- Reload extension

### Issue: "window.__ffd is undefined"
**Solution:**
- Content script hasn't initialized
- Check console for errors
- Verify extension is enabled
- Try reloading extension and page

### Issue: "No [FFD] console messages"
**Solution:**
- Extension is not running
- Check Step 2 (Errors)
- Verify manifest.json is correct
- Reload extension

---

## Quick Fix Checklist

- [ ] Extension is installed in Chrome
- [ ] Extension is enabled (toggle ON)
- [ ] All 7 files exist in `extension/` folder
- [ ] `manifest.json` is valid JSON
- [ ] Extension reloaded (click reload icon)
- [ ] Test page refreshed (Ctrl+Shift+R)
- [ ] Browser console opened (F12)
- [ ] No errors in extension errors panel
- [ ] No errors in browser console

---

## Still Not Working?

1. **Check Extension Errors:**
   - `chrome://extensions/` → Find extension → Click "Errors"
   - Copy any error messages

2. **Check Browser Console:**
   - Open test page → F12 → Console
   - Look for red errors
   - Copy error messages

3. **Verify Installation:**
   - Try removing and re-adding extension
   - Make sure you're selecting the correct folder

4. **Test File by File:**
   - Temporarily comment out files in manifest.json
   - Add them back one by one
   - Find which file causes the issue

---

## Expected Behavior When Working

✅ Extension installed and enabled
✅ Console shows `[FFD]` messages
✅ `window.__ffd` exists in console
✅ `window.__ffd_ml` exists in console
✅ `window.__ffd_domainList` exists in console
✅ Warning banner appears on test site
✅ Form submission is blocked
✅ Warning modal appears

---

## Need More Help?

If none of these steps work:
1. Check all files for syntax errors
2. Verify Chrome version (should support Manifest V3)
3. Try a fresh Chrome profile
4. Check if other extensions are interfering

Good luck! 🍀
