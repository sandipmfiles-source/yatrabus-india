import { levenshteinDistance, calculateTokenSimilarity, searchPlaces } from '../../packages/shared/src/search/typoSearch.js';
import { Place } from '../../packages/shared/src/types/places.js';

export function runTypoSearchTests(assert: (desc: string, pass: boolean) => void) {
  // Test 1: Levenshtein distance
  const d1 = levenshteinDistance('kashmiri', 'kashmere');
  assert('Levenshtein distance between kashmiri and kashmere is small (2)', d1 === 2);

  // Test 2: Token similarity
  const sim = calculateTokenSimilarity('Anand Vihar ISBT', 'ISBT Anand Vihar Terminal');
  assert('Token similarity is high for rearranged transit stop terms', sim >= 0.5);

  // Test 3: Typo-tolerant search on test places
  const samplePlaces: Place[] = [
    {
      id: 'p-1',
      canonicalName: 'ISBT Kashmere Gate',
      names: { en: 'ISBT Kashmere Gate' },
      placeType: 'BUS_TERMINAL',
      district: 'North Delhi',
      state: 'Delhi',
      sourceDataset: 'TEST',
      sourceLicense: 'MIT',
      verificationStatus: 'ADMIN_VERIFIED',
      aliases: ['Kashmiri Gate', 'Maharana Pratap ISBT'],
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'p-2',
      canonicalName: 'Kempegowda Bus Station (Majestic)',
      names: { en: 'Kempegowda Bus Station' },
      placeType: 'BUS_TERMINAL',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      sourceDataset: 'TEST',
      sourceLicense: 'MIT',
      verificationStatus: 'ADMIN_VERIFIED',
      aliases: ['Majestic', 'Bangalore Central Bus Stand'],
      createdAt: '',
      updatedAt: '',
    },
  ];

  const resTypo = searchPlaces('Kashmiri Gate', samplePlaces);
  assert('Finds place via alias or typo matching', resTypo.length > 0 && resTypo[0].place.id === 'p-1');

  const resTranslit = searchPlaces('Majestic', samplePlaces);
  assert('Finds place via popular alias (Majestic)', resTranslit.length > 0 && resTranslit[0].place.id === 'p-2');
}
