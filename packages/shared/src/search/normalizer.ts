/**
 * YatriBus Search Normalizer - Unicode, Indian Transliterations & Transit Term Expansion
 */

// Common Indian city alternative spellings and historic names mapping
export const INDIAN_PLACE_VARIANTS: Record<string, string[]> = {
  'delhi': ['dilli', 'new delhi', 'dehli', 'nct', 'del'],
  'mumbai': ['bombay', 'mumbay', 'bby', 'bom'],
  'kolkata': ['calcutta', 'kolikata', 'cal', 'ccu'],
  'bengaluru': ['bangalore', 'bangaluru', 'blr'],
  'chennai': ['madras', 'chennay', 'maa'],
  'pune': ['poona', 'punawadi', 'punecity'],
  'varanasi': ['banaras', 'benares', 'kashi'],
  'prayagraj': ['allahabad', 'ilhabad', 'pryj'],
  'gurugram': ['gurgaon', 'ggn'],
  'noida': ['new okhla industrial development authority', 'gautam buddha nagar'],
  'ayodhya': ['faizabad', 'saket'],
  'visakhapatnam': ['vizag', 'waltair'],
  'thiruvananthapuram': ['trivandrum', 'tvm'],
  'kozhikode': ['calicut', 'clt'],
  'mysuru': ['mysore', 'mys'],
  'hubballi': ['hubli'],
  'belagavi': ['belgaum'],
  'kalaburagi': ['gulbarga'],
  'vijayawada': ['bezawada', 'bza'],
  'vadodara': ['baroda', 'brc'],
  'chhatrapati sambhajinagar': ['aurangabad'],
  'dharashiv': ['osmanabad'],
  'ahmedabad': ['amdavad', 'karnavati'],
  'howrah': ['haora', 'hwh'],
  'siliguri': ['shiliguri'],
  'guwahati': ['gauhati'],
};

// Transit abbreviation expansions
export const TRANSIT_ABBREVIATIONS: Record<string, string> = {
  'isbt': 'inter state bus terminal',
  'cbs': 'central bus stand',
  'bs': 'bus stand',
  'st': 'state transport',
  'jn': 'junction',
  'stn': 'station',
  'rly': 'railway',
  'term': 'terminal',
  'trm': 'terminal',
  'dep': 'depot',
  'chw': 'chowk',
  'chr': 'chauraha',
  'rd': 'road',
  'sec': 'sector',
  'bypass': 'bypass',
  'tt': 'tram terminus',
  'mrg': 'marg',
};

/**
 * Normalizes an Indian place, bus stop, or route name for consistent indexing and comparison.
 */
export function normalizePlaceName(name: string): string {
  if (!name) return '';

  let normalized = name
    .toLowerCase()
    .normalize('NFKD') // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics / accents
    .replace(/['’`.]/g, '') // Remove apostrophes and periods
    .replace(/[-_/\\,]/g, ' ') // Convert hyphens, slashes, commas to space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  // Split tokens to expand abbreviations
  const tokens = normalized.split(' ').map(tok => {
    return TRANSIT_ABBREVIATIONS[tok] || tok;
  });

  return tokens.join(' ');
}

/**
 * Returns canonical key for transliterated or alternative city names.
 */
export function resolveCanonicalPlaceVariant(name: string): string {
  const norm = normalizePlaceName(name);

  // Check direct matches
  if (INDIAN_PLACE_VARIANTS[norm]) {
    return norm;
  }

  // Check alias matches
  for (const [canonical, aliases] of Object.entries(INDIAN_PLACE_VARIANTS)) {
    if (aliases.includes(norm)) {
      return canonical;
    }
  }

  return norm;
}
