# Fake Form Detection Extension

### Overview

Fake Form Detection is a Chrome browser extension developed as a course project to detect and alert users when they attempt to submit credentials on suspicious login forms. The extension specifically targets phishing attempts that mimic platforms like Instagram, Gmail, and Facebook. It uses real-time DOM analysis and form heuristics to identify potentially dangerous forms.

### Files and Functionality

This repository has two main parts:

#### `extensions/`  
Contains the Chrome extension source code:

- **`manifest.json`** — Defines the Chrome extension, permissions, content scripts, and background service worker.  
- **`content_script.js`** — Runs in the context of every webpage. It scans all forms, analyzes attributes such as action URLs, hidden inputs, and HTTPS status, and displays a warning modal if the form is suspicious.  
- **`utils.js`** — Contains helper functions for domain extraction, brand detection, and simple fuzzy matching to identify impersonated brands.  
- **`service_worker.js`** — Handles optional background tasks like integrating with the Google Safe Browsing API for external phishing checks.  
- **`icons/`** — Folder containing extension icons of various sizes.

#### `test-site/`  
Contains a sample `fake-login.html` page to simulate a phishing site for testing the extension.

### Features

* Detects forms that post credentials to untrusted domains.
* Flags forms with hidden inputs, lack of HTTPS, or suspicious branding.
* Displays a modal warning popup with detailed reasons and options:
  * Cancel submission
  * Proceed anyway
  * Report as phishing (demo reporting endpoint)
* Observes dynamically added forms (SPAs) using a MutationObserver.

### Installation

1. Clone or download the repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder/extension.
5. The extension will now be active.

### How to Run

1. Open any webpage with a login form or load the `test-site/fake-login.html` file in your browser.
2. The content script automatically scans forms on page load and dynamically added forms.
3. If a form is flagged as suspicious, a modal will appear showing:
   * Reasons for suspicion
   * Form details
4. Users can choose to cancel, proceed, or report the form.

### Example

```javascript
// The content script automatically scans forms like this:
window.addEventListener("load", () => {
    scanForms();
});
```

* Suspicious domains: `insta-login.xyz` (fake Instagram)
* Hidden fields count: >2 triggers a warning
* Missing HTTPS triggers a warning

### Testing

1. Load the extension in Chrome using Developer mode.
2. Open demo phishing pages (local or controlled environment) with forms mimicking Instagram, Gmail, or Facebook.
3. Check that warning modals appear for suspicious forms.
4. Open legitimate login pages (Instagram, Gmail) to verify that the extension does not falsely flag them.
