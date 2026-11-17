import { Place, PlaceSearchResult } from '../types/places.js';
import { normalizePlaceName, resolveCanonicalPlaceVariant } from './normalizer.js';

/**
 * Computes Levenshtein Distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0));
  for (let i = 0; i <= an; ++i) matrix[0][i] = i;
  for (let i = 0; i <= bn; ++i) matrix[i][0] = i;

  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1) // insertion, deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Calculates token similarity ratio (0.0 to 1.0)
 */
export function calculateTokenSimilarity(s1: string, s2: string): number {
  const norm1 = normalizePlaceName(s1);
  const norm2 = normalizePlaceName(s2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const tokens1 = new Set(norm1.split(' '));
  const tokens2 = new Set(norm2.split(' '));

  let common = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) common++;
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  return common / (union || 1);
}

/**
 * Disambiguates an Indian place by formatting its administrative hierarchy.
 * e.g., "Kashmere Gate, North Delhi (Delhi)" or "Rampur, Shimla (Himachal Pradesh)"
 */
export function formatPlaceDisambiguation(place: Place): { title: string; subtitle: string } {
  const title = place.canonicalName;
  const parts: string[] = [];

  if (place.district && place.district !== place.canonicalName) {
    parts.push(place.district);
  }
  if (place.state) {
    parts.push(place.state);
  }

  const subtitle = parts.join(', ') || place.placeType.replace('_', ' ');
  return { title, subtitle };
}

/**
 * Typo-tolerant and prefix matching search over a list of places.
 */
export function searchPlaces(query: string, places: Place[], limit: number = 8): PlaceSearchResult[] {
  if (!query || query.trim().length === 0) return [];

  const rawQuery = query.trim();
  const normQuery = normalizePlaceName(rawQuery);
  const canonicalQuery = resolveCanonicalPlaceVariant(normQuery);

  const results: PlaceSearchResult[] = [];

  for (const place of places) {
    const normCanonical = normalizePlaceName(place.canonicalName);
    const resolvedCanonical = resolveCanonicalPlaceVariant(normCanonical);

    let score = 0;
    let matchType: PlaceSearchResult['matchType'] = 'TYPO';

    // 1. Exact match on canonical name or variant
    if (normCanonical === normQuery || resolvedCanonical === canonicalQuery) {
      score = 100;
      matchType = 'EXACT';
    }
    // 2. Exact match in aliases
    else if (place.aliases && place.aliases.some(a => normalizePlaceName(a) === normQuery)) {
      score = 95;
      matchType = 'ALIAS';
    }
    // 3. Prefix match
    else if (normCanonical.startsWith(normQuery) || resolvedCanonical.startsWith(canonicalQuery)) {
      score = 85;
      matchType = 'PREFIX';
    }
    // 4. Token substring match (e.g. query "Kashmere" matching "ISBT Kashmere Gate")
    else if (normCanonical.includes(normQuery) || normQuery.split(' ').every(tok => normCanonical.includes(tok))) {
      score = 75;
      matchType = 'PREFIX';
    }
    // 5. Typo tolerance via Levenshtein distance
    else {
      const distance = levenshteinDistance(normCanonical, normQuery);
      const maxLen = Math.max(normCanonical.length, normQuery.length);
      const similarity = 1 - distance / maxLen;

      if (similarity >= 0.70 || (distance <= 2 && maxLen >= 5)) {
        score = Math.round(similarity * 70);
        matchType = 'TYPO';
      } else {
        // Check token similarity
        const tokenSim = calculateTokenSimilarity(normCanonical, normQuery);
        if (tokenSim >= 0.5) {
          score = Math.round(tokenSim * 65);
          matchType = 'TYPO';
        }
      }
    }

    // Boost verified bus stations and transit hubs slightly for search utility
    if (score > 0) {
      if (place.placeType === 'BUS_STATION' || place.placeType === 'BUS_TERMINAL') {
        score += 3;
      }
      if (place.verificationStatus === 'ADMIN_VERIFIED') {
        score += 2;
      }

      const { title, subtitle } = formatPlaceDisambiguation(place);
      results.push({
        place,
        matchScore: score,
        matchType,
        displayLabel: title,
        subtitle,
      });
    }
  }

  // Sort descending by score
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, limit);
}
