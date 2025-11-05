// ml-detector.js
// Machine learning-based detection using pattern matching and heuristic scoring

/**
 * Feature extraction for ML-based detection
 */
function extractFeatures(form, formInfo) {
  const features = {
    // Domain features
    domainMismatch: formInfo.actionDomain && formInfo.actionDomain !== formInfo.pageDomain ? 1 : 0,
    domainLength: formInfo.pageDomain.length,
    domainHasNumbers: /\d/.test(formInfo.pageDomain) ? 1 : 0,
    domainHasHyphens: formInfo.pageDomain.includes('-') ? 1 : 0,
    
    // Security features
    hasHttps: formInfo.isHTTPS ? 1 : 0,
    hasPassword: formInfo.hasPassword ? 1 : 0,
    
    // Form structure features
    hiddenInputCount: formInfo.inputs.filter(i => i.hidden).length,
    totalInputCount: formInfo.inputs.length,
    hasUsernameField: formInfo.inputs.some(i => /(user|email|login)/i.test(i.name + i.id)) ? 1 : 0,
    
    // Brand impersonation features
    brandImpersonation: formInfo.brand ? 1 : 0,
    titleBrandMismatch: (() => {
      if (!formInfo.brand) return 0;
      return formInfo.pageDomain.includes(formInfo.brand) ? 0 : 1;
    })(),
    
    // URL features
    suspiciousActionUrl: /(login|signin|auth|verify|secure)/i.test(formInfo.action) ? 1 : 0,
    actionMethod: formInfo.method === 'POST' ? 1 : 0,
    
    // Page features
    titleLength: formInfo.pageTitle.length,
    hasSuspiciousKeywords: /(verify|confirm|update|secure|alert)/i.test(formInfo.pageTitle) ? 1 : 0
  };
  
  return features;
}

/**
 * Calculate risk score using weighted heuristics (simple ML approach)
 */
function calculateRiskScore(features, weights = null, isTrustedDomain = false) {
  const defaultWeights = {
    domainMismatch: 0.3,
    missingHttps: 0.2,
    hiddenInputs: 0.15,
    brandImpersonation: 0.25,
    suspiciousStructure: 0.1
  };
  
  const w = weights || defaultWeights;
  let score = 0;
  
  // Domain mismatch risk
  if (features.domainMismatch) score += w.domainMismatch;
  
  // HTTPS risk
  if (!features.hasHttps) score += w.missingHttps;
  
  // Hidden inputs risk (normalized)
  // Trusted domains often use many hidden inputs legitimately (CSRF tokens, analytics, etc.)
  // Only apply this risk if domain is NOT trusted
  if (!isTrustedDomain) {
    const hiddenRatio = features.hiddenInputCount / Math.max(features.totalInputCount, 1);
    score += Math.min(hiddenRatio * 2, 1) * w.hiddenInputs;
  }
  // For trusted domains, only flag if suspiciously high (e.g., >50 hidden inputs)
  else if (features.hiddenInputCount > 50) {
    score += 0.05; // Minimal risk even for trusted domains with excessive hidden inputs
  }
  
  // Brand impersonation risk
  if (features.brandImpersonation && features.titleBrandMismatch) {
    score += w.brandImpersonation;
  }
  
  // Suspicious structure risk
  if (features.hasPassword && !features.hasUsernameField) {
    score += w.suspiciousStructure;
  }
  
  // Domain quality indicators
  if (features.domainHasNumbers && features.domainHasHyphens) {
    score += 0.05; // Suspicious domain pattern
  }
  
  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * Advanced pattern matching for known phishing patterns
 */
function detectPhishingPatterns(formInfo) {
  const patterns = [];
  
  // Pattern 1: Typosquatting detection
  const commonBrands = ['instagram', 'facebook', 'google', 'gmail', 'twitter', 'linkedin', 'amazon'];
  for (const brand of commonBrands) {
    if (formInfo.pageDomain.includes(brand)) {
      // Check for common typosquatting patterns
      const suspiciousPatterns = [
        /instag[a-z]{0,2}m/i,
        /face[b-z]{0,2}ook/i,
        /goo[a-z]{0,2}le/i,
        /gma[i-z]{0,2}l/i
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(formInfo.pageDomain) && !formInfo.pageDomain.includes(brand)) {
          patterns.push(`Possible typosquatting detected for ${brand}`);
          break;
        }
      }
    }
  }
  
  // Pattern 2: Subdomain abuse
  if (formInfo.pageDomain.split('.').length > 3) {
    patterns.push('Suspicious subdomain structure detected');
  }
  
  // Pattern 3: IP address in domain (highly suspicious)
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipPattern.test(formInfo.pageDomain)) {
    patterns.push('Domain appears to be an IP address (highly suspicious)');
  }
  
  // Pattern 4: Suspicious TLDs
  const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.xyz', '.top'];
  const hasSuspiciousTld = suspiciousTlds.some(tld => formInfo.pageDomain.endsWith(tld));
  if (hasSuspiciousTld && formInfo.brand) {
    patterns.push(`Suspicious TLD detected while impersonating ${formInfo.brand}`);
  }
  
  return patterns;
}

/**
 * ML-based risk evaluation
 */
function mlEvaluateRisk(formInfo, config) {
  const features = extractFeatures(null, formInfo);
  
  // Check if domain is trusted
  const isTrustedDomain = config.trustedDomains && config.trustedDomains.some(trusted => 
    formInfo.pageDomain.includes(trusted) || (formInfo.actionDomain && formInfo.actionDomain.includes(trusted))
  );
  
  const riskScore = calculateRiskScore(features, config.mlWeights, isTrustedDomain);
  const patterns = detectPhishingPatterns(formInfo);
  
  // For trusted domains, use a higher risk threshold to reduce false positives
  const effectiveThreshold = isTrustedDomain ? (config.riskThreshold || 0.3) * 1.5 : (config.riskThreshold || 0.3);
  
  return {
    riskScore,
    features,
    patterns,
    isSuspicious: riskScore >= effectiveThreshold,
    isTrustedDomain: isTrustedDomain
  };
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.__ffd_ml = { extractFeatures, calculateRiskScore, detectPhishingPatterns, mlEvaluateRisk };
}
