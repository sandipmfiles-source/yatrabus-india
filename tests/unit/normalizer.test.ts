import { normalizePlaceName, resolveCanonicalPlaceVariant } from '../../packages/shared/src/search/normalizer.js';

export function runNormalizerTests(assert: (desc: string, pass: boolean) => void) {
  // Test 1: Whitespace and case normalization
  const norm1 = normalizePlaceName('   ISBT   Kashmere Gate  ');
  assert('Normalizes whitespace and lowercase', norm1 === 'inter state bus terminal kashmere gate');

  // Test 2: Indian city transliteration & alternate names
  const canonicalDelhi = resolveCanonicalPlaceVariant('Dilli');
  assert('Resolves Dilli to delhi', canonicalDelhi === 'delhi');

  const canonicalCal = resolveCanonicalPlaceVariant('Calcutta');
  assert('Resolves Calcutta to kolkata', canonicalCal === 'kolkata');

  const canonicalBlr = resolveCanonicalPlaceVariant('Bangalore');
  assert('Resolves Bangalore to bengaluru', canonicalBlr === 'bengaluru');

  const canonicalPryj = resolveCanonicalPlaceVariant('Allahabad');
  assert('Resolves Allahabad to prayagraj', canonicalPryj === 'prayagraj');

  // Test 3: Common transit abbreviations expansion
  const normStn = normalizePlaceName('Pune Rly Stn');
  assert('Expands transit abbreviations (Rly Stn -> railway station)', normStn === 'pune railway station');

  const normChowk = normalizePlaceName('IFFCO Chw');
  assert('Expands Chw to chowk', normChowk === 'iffco chowk');
}
