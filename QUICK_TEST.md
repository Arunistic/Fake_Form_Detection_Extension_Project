# ⚡ Quick Test Guide

## Where to Test

### 📍 Test Location 1: Basic Form Detection
**File:** `test-site/fake-login.html`

**How to open:**
1. Navigate to the `test-site` folder
2. Double-click `fake-login.html` OR
3. Drag & drop into Chrome browser

**What you should see:**
- ✅ Red warning banner at top of page (immediately)
- ✅ Console logs (press F12) showing `[FFD]` messages
- ✅ When you submit: Form blocked + Full warning modal

---

### 📍 Test Location 2: API Call Detection  
**File:** `test-site/test-api-calls.html`

**How to open:**
1. Navigate to the `test-site` folder  
2. Double-click `test-api-calls.html` OR
3. Drag & drop into Chrome browser

**What to do:**
1. Click each test button (1-5)
2. Tests 1-4 should show warning modals
3. Test 5 should NOT trigger (safe call)

**What you should see:**
- ✅ Warning modal appears for suspicious API calls
- ✅ Console shows `[FFD] ⚠️ Suspicious fetch detected!`
- ✅ Option to block or allow requests

---

### 📍 Test Location 3: Real Sites (False Positive Check)
**URLs:** 
- `https://www.instagram.com/accounts/login/`
- `https://accounts.google.com/`
- `https://www.facebook.com/login/`

**What to verify:**
- ❌ Should NOT show warning banner
- ❌ Should NOT block form submission
- ✅ Console shows `[FFD] ✓ Form appears safe`
- ✅ Form submits normally

---

## Step-by-Step Testing

### Step 1: Load Extension
```
1. Open Chrome
2. Go to: chrome://extensions/
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the "extension" folder
6. Verify extension is loaded ✅
```

### Step 2: Open Test Site
```
1. Open: test-site/fake-login.html
2. Press F12 (open console)
3. Look for red banner at top
4. Check console for [FFD] logs
```

### Step 3: Test Form Submission
```
1. Enter any username/password
2. Click "Log In" button
3. Form should be BLOCKED
4. Warning modal should appear
5. Console shows: [FFD] ⚠️ BLOCKING FORM SUBMISSION
```

### Step 4: Test API Calls
```
1. Open: test-site/test-api-calls.html
2. Click "Test Fetch with Credentials"
3. Warning modal should appear
4. Click "Test XHR with Credentials"
5. Warning modal should appear
```

---

## Visual Checklist

### ✅ Extension is Working If:
- [ ] Red banner appears on test site
- [ ] Console shows `[FFD]` messages
- [ ] Form submission is blocked
- [ ] Warning modal appears
- [ ] API calls are detected
- [ ] Real sites (Instagram/Gmail) do NOT trigger

### ❌ Extension is NOT Working If:
- [ ] No banner appears
- [ ] No console logs
- [ ] Form submits without warning
- [ ] No API call detection

---

## Quick Troubleshooting

**No banner?**
→ Check console (F12) for errors
→ Reload extension: `chrome://extensions/` → Reload icon
→ Reload page: Ctrl+Shift+R

**Form not blocked?**
→ Check console for `[FFD] Form submission intercepted!`
→ Verify form has password field
→ Check extension is enabled

**No API detection?**
→ Check console for `[FFD] Fetch intercepted:`
→ Verify request is POST/PUT/PATCH (not GET)
→ Check request contains credential keywords

---

## Files to Test

| File | Purpose | What to Test |
|------|---------|--------------|
| `test-site/fake-login.html` | Form detection | Warning banner + blocked submission |
| `test-site/test-api-calls.html` | API detection | Fetch/XHR interception |

---

## Console Output Examples

### ✅ Working Extension
```
[FFD] Initializing Fake Form Detection Extension...
[FFD] Found 1 forms on page
[FFD] Form info: {action: "http://fake-instagram.com/login", ...}
[FFD] ⚠️ Suspicious form detected! Reasons: [...]
[FFD] Form submission intercepted!
[FFD] ⚠️ BLOCKING FORM SUBMISSION - Suspicious!
```

### ❌ Not Working
```
(No [FFD] messages)
```

---

## Need More Help?

See **HOW_TO_TEST.md** for detailed testing instructions.

**Summary:** Open `test-site/fake-login.html` and you should immediately see a red warning banner at the top! 🎉
