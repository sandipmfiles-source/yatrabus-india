import { IndianState, PlaceSearchResult } from '../../../packages/shared/src/types/places.js';

const INDIAN_STATES: IndianState[] = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu and Kashmir',
  'Ladakh','Chandigarh','Puducherry','Dadra and Nagar Haveli and Daman and Diu',
  'Andaman and Nicobar Islands','Lakshadweep',
];

const cache = new Map<string, { expiresAt: number; results: PlaceSearchResult[] }>();

function inferState(text: string): IndianState | undefined {
  const normalized = text.toLowerCase();
  return INDIAN_STATES.find(state => normalized.includes(state.toLowerCase()));
}

/**
 * Google Places Autocomplete is a fallback only: verified/local YatraBus places
 * always remain first. The API key is server-only and is never sent to the APK.
 */
export async function searchGooglePlaces(query: string, limit: number): Promise<PlaceSearchResult[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || query.trim().length < 2) return [];

  const cacheKey = query.trim().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results.slice(0, limit);

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types',
    },
    body: JSON.stringify({
      input: query.trim(),
      includedRegionCodes: ['in'],
      languageCode: 'en',
    }),
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) return [];

  const payload = await response.json() as {
    suggestions?: Array<{ placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      types?: string[];
    } }>;
  };

  const now = new Date().toISOString();
  const results: PlaceSearchResult[] = (payload.suggestions || []).flatMap((suggestion, index) => {
    const prediction = suggestion.placePrediction;
    const name = prediction?.structuredFormat?.mainText?.text || prediction?.text?.text;
    if (!prediction?.placeId || !name) return [];
    const subtitle = prediction.structuredFormat?.secondaryText?.text || 'India';
    const fullLabel = prediction.text?.text || name;
    const state = inferState(subtitle + ' ' + fullLabel);
    const isBusStop = (prediction.types || []).some(type =>
      type.includes('bus_station') || type.includes('bus_stop') || type.includes('transit_station')
    );
    const place = {
      id: 'google-' + prediction.placeId,
      canonicalName: name,
      names: { en: name },
      placeType: isBusStop ? 'BUS_TERMINAL' as const : 'LOCALITY' as const,
      ...(state ? { state } : {}),
      sourceDataset: 'GOOGLE_PLACES_AUTOCOMPLETE',
      sourceRecordId: prediction.placeId,
      sourceLicense: 'Google Maps Platform',
      verificationStatus: 'UNVERIFIED' as const,
      aliases: [],
      createdAt: now,
      updatedAt: now,
    };
    return [{
      place,
      matchScore: 60 - index,
      matchType: 'PREFIX' as const,
      displayLabel: name,
      subtitle: state ? subtitle : subtitle + ' · Google Maps',
    }];
  });

  cache.set(cacheKey, { expiresAt: Date.now() + 5 * 60 * 1000, results });
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  return results.slice(0, limit);
}
