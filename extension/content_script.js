// content_script.js
// Runs in page context (sandboxed) and hooks forms to analyze behaviour before submit.

// Config: thresholds and trusted domains (for demonstration)
const CONFIG = {
  trustedDomains: ['instagram.com', 'facebook.com', 'accounts.google.com', 'google.com'],
  minSimilarityToWarn: 0.25 // used for fuzzy checks (page title vs brand) - low to be conservative
};

/**
 * Main: scan forms and attach submit handler
 */
function initFormScanner() {
  try {
    const forms = Array.from(document.forms);
    forms.forEach(form => attachFormHandler(form));
  } catch (e) {
    console.error('Form scanner failed', e);
  }
}

/**
 * Attach submit interception to a form
 * @param {HTMLFormElement} form
 */
function attachFormHandler(form) {
  if (form.__ffd_hooked) return;
  form.__ffd_hooked = true;

  form.addEventListener('submit', async (ev) => {
    // Grab form snapshot before submission
    const formInfo = analyzeForm(form);
    const reasons = evaluateFormRisk(formInfo);

    if (reasons.length > 0) {
      // Block submission, show modal to user with reasons
      ev.preventDefault();
      ev.stopPropagation();
      showWarningModal(form, reasons, formInfo);
    } else {
      // optionally: report or allow submission
      // allow submit to continue
    }
  }, { capture: true });
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
    hidden: el.type === 'hidden' || (el.offsetParent === null && el.type !== 'password') // hidden heuristics
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
    pageTitle
  };
}

/**
 * Evaluate risk and return array of textual reasons if suspicious
 * @param {Object} info
 * @returns {string[]}
 */
function evaluateFormRisk(info) {
  const reasons = [];

  if (!info.hasPassword) {
    // If no password field, likely not a credential form -> low-risk for this plugin
    return reasons;
  }

  // 1. action domain mismatch: form posts to different domain than visible page
  if (info.actionDomain && info.actionDomain !== info.pageDomain) {
    // If action domain not in trusted list, warn
    if (!CONFIG.trustedDomains.includes(info.actionDomain)) {
      reasons.push(`Form action posts to a different domain: ${info.actionDomain}`);
    }
  }

  // 2. Absence of HTTPS
  if (!info.isHTTPS) reasons.push('Page is not loaded over HTTPS');

  // 3. Hidden inputs presence: presence of many hidden fields may indicate exfiltration
  const hiddenCount = info.inputs.filter(i => i.hidden).length;
  if (hiddenCount >= 2) reasons.push(`Form contains ${hiddenCount} hidden inputs (potential data exfiltration)`);

  // 4. Page looks like a known brand but domain is not the brand's domain
  if (info.brand) {
    const expected = CONFIG.trustedDomains.find(d => d.includes(info.brand));
    if (!info.pageDomain.includes(info.brand) && !expected) {
      reasons.push(`Page UI seems to impersonate ${info.brand} but domain is ${info.pageDomain}`);
    } else {
      // if it matches brand but action domain suspicious
      if (info.actionDomain && !info.actionDomain.includes(info.brand) && info.actionDomain !== info.pageDomain) {
        reasons.push(`Form action domain ${info.actionDomain} does not match ${info.brand} domain`);
      }
    }
  } else {
    // If title contains "Instagram" or "Sign in" but brand detection missed, do fuzzy check
    for (const b of ['instagram', 'facebook', 'gmail', 'google']) {
      if ((info.pageTitle || '').toLowerCase().includes(b) && !info.pageDomain.includes(b)) {
        reasons.push(`Page title mentions "${b}" but domain is ${info.pageDomain}`);
        break;
      }
    }
  }

  // 5. Suspicious input names (common phishing fields)
  const suspiciousNames = ['email', 'username', 'user', 'login', 'passwd', 'password'];
  const hasSuspicious = info.inputs.some(i => suspiciousNames.includes((i.name || '').toLowerCase()));
  if (!hasSuspicious) {
    // if no username field but password exists, warn
    const usernameLike = info.inputs.some(i => /(user(name)?|email|login)/i.test(i.name + i.id));
    if (!usernameLike) reasons.push('No identifiable username/email field found alongside password');
  }

  // dedupe
  return Array.from(new Set(reasons));
}

/**
 * Injects and displays a modal with reasons; includes options to proceed or cancel.
 * If the user chooses to proceed, the form will be submitted programmatically.
 */
function showWarningModal(form, reasons, formInfo) {
  // Prevent multiple modals
  if (document.getElementById('__ffd_modal')) return;

  const container = document.createElement('div');
  container.id = '__ffd_modal';
  container.style = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    display:flex; align-items:center; justify-content:center; z-index: 2147483647;
  `;

  const dialog = document.createElement('div');
  dialog.style = `
    width: min(680px, 95%); background: #fff; border-radius: 12px; padding: 20px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.35); font-family: Arial, sans-serif;
  `;

  const title = document.createElement('h2');
  title.innerText = 'Security warning — suspicious login form';
  title.style = 'margin:0 0 8px 0; font-size:18px;';

  const ul = document.createElement('ul');
  reasons.forEach(r => {
    const li = document.createElement('li');
    li.innerText = r;
    ul.appendChild(li);
  });

  const details = document.createElement('pre');
  details.style = 'background:#f7f7f7;padding:8px;border-radius:6px;overflow:auto;max-height:120px;';
  details.innerText = JSON.stringify(formInfo, null, 2);

  const btnContainer = document.createElement('div');
  btnContainer.style = 'display:flex; gap:8px; justify-content:flex-end; margin-top:12px;';

  const cancelBtn = document.createElement('button');
  cancelBtn.innerText = 'Cancel submission';
  cancelBtn.style = 'padding:8px 12px; border-radius:6px; border:1px solid #bbb; background:#fff; cursor:pointer;';
  cancelBtn.onclick = () => {
    container.remove();
    // optionally: record user cancellation
    console.info('FFD: submission cancelled by user', formInfo);
  };

  const proceedBtn = document.createElement('button');
  proceedBtn.innerText = 'Proceed anyway';
  proceedBtn.style = 'padding:8px 12px; border-radius:6px; border:0; background:#d9534f; color:#fff; cursor:pointer;';
  proceedBtn.onclick = () => {
    container.remove();
    // submit the form programmatically - preserve default behaviour where possible
    try {
      // remove event listeners to avoid loop, then submit
      form.__ffd_hooked = false;
      form.submit();
      console.info('FFD: user chose to proceed and form submitted', formInfo);
    } catch (e) {
      console.error('FFD: failed to submit programmatically', e);
    }
  };

  // optional: "Report" button that sends info to background for logging
  const reportBtn = document.createElement('button');
  reportBtn.innerText = 'Report as phishing';
  reportBtn.style = 'padding:8px 12px; border-radius:6px; border:0; background:#2b90d9; color:#fff; cursor:pointer;';
  reportBtn.onclick = () => {
    container.remove();
    try {
      navigator.sendBeacon && navigator.sendBeacon('https://example-collection-endpoint.org/report', JSON.stringify({
        time: new Date().toISOString(),
        url: window.location.href,
        formInfo: formInfo,
        reasons
      }));
      alert('Reported (demo).');
    } catch (e) {
      console.warn('FFD: report failed', e);
    }
  };

  btnContainer.appendChild(reportBtn);
  btnContainer.appendChild(cancelBtn);
  btnContainer.appendChild(proceedBtn);

  dialog.appendChild(title);
  const p = document.createElement('p');
  p.innerText = 'This page appears to have characteristics commonly used in phishing pages. Please review the reasons and decide.';
  dialog.appendChild(p);
  dialog.appendChild(ul);
  dialog.appendChild(details);
  dialog.appendChild(btnContainer);
  container.appendChild(dialog);
  document.documentElement.appendChild(container);
}

// initialize scanner after small delay to allow dynamic forms to load
setTimeout(initFormScanner, 800);

// Also observe DOM mutations for forms added dynamically (single observer)
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes && m.addedNodes.length) {
      // simple schedule to (re)scan
      setTimeout(() => initFormScanner(), 200);
      break;
    }
  }
});
observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

// export for testing in console (if developer wants to run)
window.__ffd = { analyzeForm, evaluateFormRisk, initFormScanner };
