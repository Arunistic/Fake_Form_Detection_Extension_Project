// utils.js
// Small helpers used by content_script and service_worker

/**
 * Extract domain from URL (host only)
 * @param {string} url
 * @returns {string}
 */
function getDomain(url) {
  try {
    const u = new URL(url, window.location.href);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

/**
 * Simple fuzzy check: how similar is `a` to `b` based on trigram overlap / ratio.
 * Lightweight approximate string similarity (0..1).
 */
function simpleSimilarity(a = '', b = '') {
  a = (a || '').toLowerCase();
  b = (b || '').toLowerCase();
  if (!a.length || !b.length) return 0;
  // character-level common subsequence ratio (fast approximate)
  let common = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) common++;
  }
  return common / Math.max(a.length, b.length);
}

/**
 * Known brand keywords we consider high-risk impersonation targets.
 * Expanded list for better coverage
 */
const KNOWN_BRANDS = [
  { name: 'instagram', keywords: ['instagram', 'insta', 'meta', 'ig'] },
  { name: 'facebook', keywords: ['facebook', 'fb', 'meta'] },
  { name: 'gmail', keywords: ['gmail', 'google', 'google accounts', 'sign in', 'google mail'] },
  { name: 'twitter', keywords: ['twitter', 'x.com', 'tweet', 'x social'] },
  { name: 'linkedin', keywords: ['linkedin', 'linked in', 'professional network'] },
  { name: 'amazon', keywords: ['amazon', 'amzn', 'prime', 'aws'] },
  { name: 'microsoft', keywords: ['microsoft', 'msft', 'outlook', 'office 365', 'azure', 'microsoft account'] },
  { name: 'apple', keywords: ['apple', 'icloud', 'apple id', 'app store', 'itunes'] },
  { name: 'github', keywords: ['github', 'git hub', 'github account'] },
  { name: 'netflix', keywords: ['netflix', 'net flix'] },
  { name: 'paypal', keywords: ['paypal', 'pay pal'] },
  { name: 'bankofamerica', keywords: ['bank of america', 'bofa', 'boa'] },
  { name: 'wellsfargo', keywords: ['wells fargo', 'wellsfargo'] },
  { name: 'chase', keywords: ['chase', 'chase bank', 'jpmorgan chase'] },
  { name: 'yahoo', keywords: ['yahoo', 'yahoo mail', 'yahoo account'] },
  { name: 'dropbox', keywords: ['dropbox', 'drop box'] },
  { name: 'spotify', keywords: ['spotify', 'spotify account'] },
  { name: 'discord', keywords: ['discord', 'discord account'] },
  { name: 'reddit', keywords: ['reddit', 'reddit account'] },
  { name: 'ebay', keywords: ['ebay', 'e bay'] },
  { name: 'adobe', keywords: ['adobe', 'adobe account', 'creative cloud'] }
];

function looksLikeBrand(document) {
  // Check page title and meta tags, as well as visible images' alt/title attributes for brand keywords
  const title = (document.title || '').toLowerCase();
  const meta = Array.from(document.getElementsByTagName('meta')).map(m => (m.content || '').toLowerCase());
  const imgs = Array.from(document.getElementsByTagName('img')).slice(0, 30); // limit
  const imgTexts = imgs.map(i => ((i.alt || '') + ' ' + (i.title || '')).toLowerCase());
  
  // Also check page text content for brand mentions
  const bodyText = document.body ? document.body.innerText.toLowerCase().substring(0, 1000) : '';
  
  // Check for brand logos and images
  const brandLogos = {
    'instagram': ['instagram', 'camera', 'instagram logo'],
    'facebook': ['facebook', 'f logo', 'facebook logo'],
    'google': ['google', 'g logo', 'google logo'],
    'twitter': ['twitter', 'x logo', 'bird logo'],
    'linkedin': ['linkedin', 'in logo'],
    'amazon': ['amazon', 'smile logo', 'amazon logo'],
    'microsoft': ['microsoft', 'windows logo', 'outlook'],
    'apple': ['apple', 'apple logo', 'mac', 'iphone']
  };
  
  const textPool = [title, ...meta, ...imgTexts, bodyText].join(' ');
  
  // Score-based brand detection (return brand with highest confidence)
  let bestBrand = null;
  let bestScore = 0;
  
  for (const brand of KNOWN_BRANDS) {
    let score = 0;
    for (const kw of brand.keywords) {
      const matches = (textPool.match(new RegExp(kw, 'gi')) || []).length;
      score += matches;
    }
    
    // Boost score if logo keywords found
    if (brandLogos[brand.name]) {
      for (const logoKw of brandLogos[brand.name]) {
        if (textPool.includes(logoKw)) score += 2;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestBrand = brand.name;
    }
  }
  
  // Only return brand if confidence is high enough
  return bestScore >= 2 ? bestBrand : null;
}
