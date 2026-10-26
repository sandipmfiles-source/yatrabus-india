/**
 * Fuzzy Search and String Normalization Utilities
 * Supports Unicode Normalization, Levenshtein Distance, Jaro-Winkler & Token Matching
 * ₹0 Cost - Zero external API dependency
 */

/**
 * Clean and normalize text: Unicode NFC, lowercasing, trim punctuation and extra spaces
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Standard Levenshtein Distance
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1 || '';
  const b = s2 || '';

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate Jaro-Winkler string similarity (0.0 to 1.0)
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const str1 = normalizeText(s1);
  const str2 = normalizeText(s2);

  if (str1 === str2) return 1.0;
  if (!str1.length || !str2.length) return 0.0;

  const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / str1.length +
      matches / str2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler prefix adjustment
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(str1.length, str2.length)); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Multi-signal fuzzy match score for search query against candidate string
 * Returns score between 0 and 100
 */
export function calculateMatchScore(query: string, candidate: string): number {
  const normQuery = normalizeText(query);
  const normCandidate = normalizeText(candidate);

  if (!normQuery || !normCandidate) return 0;
  if (normCandidate === normQuery) return 100; // Exact match
  if (normCandidate.startsWith(normQuery)) return 95; // Exact prefix
  if (normCandidate.includes(normQuery)) return 85; // Exact substring

  // Token word match
  const qTokens = normQuery.split(' ');
  const cTokens = normCandidate.split(' ');
  const tokenMatches = qTokens.filter(qt => cTokens.some(ct => ct.startsWith(qt) || ct.includes(qt)));
  if (tokenMatches.length === qTokens.length) {
    return 80;
  }

  // Jaro-Winkler similarity
  const jw = jaroWinklerSimilarity(normQuery, normCandidate);
  if (jw >= 0.8) {
    return Math.round(jw * 75);
  }

  // Levenshtein typo tolerance for short queries
  const maxLen = Math.max(normQuery.length, normCandidate.length);
  const lev = levenshteinDistance(normQuery, normCandidate);
  if (lev <= 2 && maxLen <= 10) {
    return 70;
  }

  return Math.round(jw * 50);
}
