/**
 * usta-sitemap-analyzer.js
 * ES Module for parsing and classifying USTA sitemap XML into discrete page types.
 *
 * Usage:
 *   import { parseSitemap, classifyURL, analyzeSitemap } from './usta-sitemap-analyzer.js';
 *
 *   const urls = parseSitemap(xmlString);
 *   const results = analyzeSitemap(urls);
 */


// ─── CLASSIFIER ───────────────────────────────────────────────────────────────

/**
 * Classifies a single USTA URL into a discrete page type.
 * @param {string} url - Full URL e.g. https://www.usta.com/en/home/play/youth-tennis/programs.html
 * @returns {string} Page type label
 */
export function classifyURL(url) {
  const base = 'https://www.usta.com/en/home';
  const p = url.replace(base, '').replace(/\.html$/, '').replace(/^\//, '');
  const parts = p.split('/');
  const s0 = parts[0] || '';
  const joined = parts.join(' ');

  if (!p || p === 'home') return 'Homepage';
  if (s0 === 'blog') return 'Blog / Editorial Article';

  if (s0 === 'stay-current') {
    if (parts.length === 1) return 'Section Hub';
    if (joined.includes('rankings') || joined.includes('ranking')) return 'Rankings Page';
    if (joined.includes('scores') || joined.includes('draws') || joined.includes('results')) return 'Scores / Results / Draws';
    if (joined.includes('schedule')) return 'Tournament Schedule';
    if (joined.includes('player')) return 'Player Profile';
    return 'News Article';
  }

  if (s0 === 'pro') {
    if (parts.length === 1) return 'Section Hub';
    if (joined.includes('us-open')) return 'US Open Hub / Sub-page';
    if (joined.includes('player')) return 'Player Profile';
    if (joined.includes('rankings') || joined.includes('ranking')) return 'Rankings Page';
    if (joined.includes('schedule') || joined.includes('tournament')) return 'Tournament Schedule';
    if (joined.includes('scores') || joined.includes('draws') || joined.includes('results')) return 'Scores / Results / Draws';
    return 'Pro Tennis Page';
  }

  if (s0 === 'play') {
    if (parts.length === 1) return 'Section Hub';
    if (joined.includes('facility') || joined.includes('facilities')) return 'Facility Finder';
    if (joined.includes('league')) return 'League Information';
    if (joined.includes('tournament')) return 'Tournament Info';
    if (joined.includes('youth')) return 'Youth Tennis Program';
    if (joined.includes('adult')) return 'Adult Tennis Program';
    if (joined.includes('wheelchair') || joined.includes('adaptive')) return 'Adaptive Tennis';
    return 'Play Program Page';
  }

  if (s0 === 'coach-organize') {
    if (parts.length === 1) return 'Section Hub';
    if (joined.includes('coach')) return 'Coaching Resource';
    if (joined.includes('tournament')) return 'Tournament Organizer';
    if (joined.includes('facility')) return 'Facility Resource';
    return 'Coach / Organize Page';
  }

  if (s0 === 'improve') {
    if (joined.includes('video')) return 'Video / Instruction';
    if (joined.includes('tips') || joined.includes('drill') || joined.includes('lesson')) return 'Tips / Drills / Lessons';
    return 'Improve / Instruction';
  }

  if (s0 === 'about-usta') {
    if (joined.includes('foundation')) return 'USTA Foundation';
    if (joined.includes('governance') || joined.includes('bylaw')) return 'Governance / Policy';
    if (joined.includes('history') || joined.includes('heritage')) return 'History / Heritage';
    if (joined.includes('staff') || joined.includes('board') || joined.includes('leadership')) return 'Staff / Leadership';
    if (joined.includes('section')) return 'Section / Regional';
    if (joined.includes('news') || joined.includes('press')) return 'Press Release';
    return 'About USTA';
  }

  if (s0 === 'membership') return 'Membership Page';
  if (s0 === 'safe-play') return 'Safe Play / Policy';
  if (s0 === 'myaccount' || s0 === 'account') return 'Account / Profile';
  if (['leads', 'unsubscribe', 'alerts', 'news-search', 'search-profile', 'us-open-artwork'].includes(s0)) return 'Utility / Tool Page';

  return 'General Content Page';
}


// ─── PARSER ───────────────────────────────────────────────────────────────────

/**
 * Parses a sitemap XML string and returns all English-language URLs.
 * Filters to /en/ URLs only to avoid counting Spanish duplicates.
 * Works in both browser (DOMParser) and Node.js (requires xmldom or similar).
 *
 * @param {string} xmlText - Raw XML string content of the sitemap
 * @returns {string[]} Array of full URLs
 */
export function parseSitemap(xmlText) {
  let locs;

  if (typeof DOMParser !== 'undefined') {
    // Browser environment
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    locs = Array.from(doc.querySelectorAll('loc'));
  } else {
    // Node.js fallback: simple regex extraction
    locs = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => ({ textContent: m[1] }));
  }

  return locs
    .map(loc => loc.textContent.trim())
    .filter(url => url.includes('/en/'));
}


// ─── ANALYZER ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PageTypeResult
 * @property {string} type        - Page type label
 * @property {number} count       - Number of URLs of this type
 * @property {number} percentage  - Share of total URLs (0–100, 2 decimal places)
 * @property {string} example     - A representative URL for this type
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {number}           total      - Total number of URLs analyzed
 * @property {number}           typeCount  - Number of distinct page types found
 * @property {PageTypeResult[]} types      - Sorted array of page type results (descending by count)
 */

/**
 * Analyzes an array of URLs and returns a structured breakdown by page type.
 *
 * @param {string[]} urls - Array of full USTA URLs
 * @returns {AnalysisResult}
 */
export function analyzeSitemap(urls) {
  const counts = {};
  const examples = {};

  for (const url of urls) {
    const type = classifyURL(url);
    counts[type] = (counts[type] || 0) + 1;
    if (!examples[type]) examples[type] = url;
  }

  const total = urls.length;

  const types = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      count,
      percentage: parseFloat(((count / total) * 100).toFixed(2)),
      example: examples[type]
    }));

  return {
    total,
    typeCount: types.length,
    types
  };
}


// ─── SECTION FILTER ───────────────────────────────────────────────────────────

/**
 * Filters URLs to a specific top-level section of the site.
 * Useful for isolating e.g. all stay-current or all pro URLs before analysis.
 *
 * @param {string[]} urls    - Full URL array from parseSitemap()
 * @param {string}   section - Section name e.g. 'stay-current', 'pro', 'play'
 * @returns {string[]} Filtered URL array
 */
export function filterBySection(urls, section) {
  const token = `/en/home/${section}/`;
  return urls.filter(url => url.includes(token));
}


// ─── LAST MODIFIED SORT ───────────────────────────────────────────────────────

/**
 * Parses a sitemap XML string and returns URLs with their lastmod dates,
 * sorted most-recent first. Useful for finding the most recently updated pages.
 *
 * @param {string} xmlText  - Raw XML string content of the sitemap
 * @param {string} [section] - Optional section filter e.g. 'stay-current'
 * @returns {{ url: string, lastmod: string }[]} Array sorted by lastmod descending
 */
export function getRecentURLs(xmlText, section = null) {
  let entries;

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    entries = Array.from(doc.querySelectorAll('url')).map(node => ({
      url: node.querySelector('loc')?.textContent.trim() || '',
      lastmod: node.querySelector('lastmod')?.textContent.trim() || ''
    }));
  } else {
    const urlBlocks = [...xmlText.matchAll(/<url>([\s\S]*?)<\/url>/g)];
    entries = urlBlocks.map(block => {
      const locMatch = block[1].match(/<loc>(.*?)<\/loc>/);
      const modMatch = block[1].match(/<lastmod>(.*?)<\/lastmod>/);
      return {
        url: locMatch ? locMatch[1].trim() : '',
        lastmod: modMatch ? modMatch[1].trim() : ''
      };
    });
  }

  return entries
    .filter(e => e.url.includes('/en/') && (!section || e.url.includes(`/en/home/${section}/`)))
    .sort((a, b) => b.lastmod.localeCompare(a.lastmod));
}
