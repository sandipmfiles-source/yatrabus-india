/**
 * YatriBus Shared Types - Places and Administrative Hierarchy
 */

export type IndianState =
  | 'Andhra Pradesh'
  | 'Arunachal Pradesh'
  | 'Assam'
  | 'Bihar'
  | 'Chhattisgarh'
  | 'Goa'
  | 'Gujarat'
  | 'Haryana'
  | 'Himachal Pradesh'
  | 'Jharkhand'
  | 'Karnataka'
  | 'Kerala'
  | 'Madhya Pradesh'
  | 'Maharashtra'
  | 'Manipur'
  | 'Meghalaya'
  | 'Mizoram'
  | 'Nagaland'
  | 'Odisha'
  | 'Punjab'
  | 'Rajasthan'
  | 'Sikkim'
  | 'Tamil Nadu'
  | 'Telangana'
  | 'Tripura'
  | 'Uttar Pradesh'
  | 'Uttarakhand'
  | 'West Bengal'
  | 'Delhi'
  | 'Jammu and Kashmir'
  | 'Ladakh'
  | 'Chandigarh'
  | 'Puducherry'
  | 'Dadra and Nagar Haveli and Daman and Diu'
  | 'Andaman and Nicobar Islands'
  | 'Lakshadweep';

export type PlaceType =
  | 'COUNTRY'
  | 'STATE'
  | 'DISTRICT'
  | 'SUBDIVISION'
  | 'TEHSIL'
  | 'BLOCK'
  | 'MUNICIPALITY'
  | 'CITY'
  | 'TOWN'
  | 'CENSUS_TOWN'
  | 'VILLAGE'
  | 'LOCALITY'
  | 'BUS_STATION'
  | 'BUS_TERMINAL'
  | 'BUS_STOP'
  | 'TRANSIT_HUB';

export interface MultilingualName {
  en: string;
  hi?: string;
  bn?: string;
  ta?: string;
  te?: string;
  mr?: string;
}

export interface Place {
  id: string;
  canonicalName: string;
  names: MultilingualName;
  placeType: PlaceType;
  parentId?: string;
  district?: string;
  state: IndianState;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  sourceDataset: string;
  sourceRecordId?: string;
  sourceLicense: string;
  verificationStatus: 'UNVERIFIED' | 'COMMUNITY_VERIFIED' | 'ADMIN_VERIFIED';
  aliases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaceSearchResult {
  place: Place;
  matchScore: number;
  matchType: 'EXACT' | 'PREFIX' | 'ALIAS' | 'TYPO' | 'TRANSLITERATION';
  displayLabel: string;
  subtitle: string;
}
