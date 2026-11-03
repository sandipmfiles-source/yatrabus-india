import type { IndianState } from '../types/places.js';

export type AdministrativeUnitKind = 'STATE' | 'UNION_TERRITORY';
export type IndiaRegion = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'CENTRAL' | 'NORTH_EAST' | 'ISLANDS';

export interface IndiaAdministrativeUnit {
  name: IndianState;
  kind: AdministrativeUnitKind;
  capital: string;
  aliases: string[];
  region: IndiaRegion;
  capitalNote?: string;
  officialReference: string;
  lastReviewedAt: string;
}

/**
 * Administrative reference catalogue: 28 States + 8 Union Territories.
 * It is not a substitute for the LGD's district, sub-district, town or village master.
 * Capital notes preserve seasonal/second-capital distinctions where applicable.
 */
export const INDIA_ADMINISTRATIVE_UNITS: IndiaAdministrativeUnit[] = [
  { name: 'Andhra Pradesh', kind: 'STATE', capital: 'Amaravati', aliases: ['Vijayawada'], region: 'SOUTH', officialReference: 'https://www.ap.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Arunachal Pradesh', kind: 'STATE', capital: 'Itanagar', aliases: [], region: 'NORTH_EAST', officialReference: 'https://arunachalpradesh.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Assam', kind: 'STATE', capital: 'Dispur', aliases: ['Guwahati'], region: 'NORTH_EAST', officialReference: 'https://assam.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Bihar', kind: 'STATE', capital: 'Patna', aliases: [], region: 'EAST', officialReference: 'https://state.bihar.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Chhattisgarh', kind: 'STATE', capital: 'Raipur', aliases: [], region: 'CENTRAL', officialReference: 'https://cgstate.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Goa', kind: 'STATE', capital: 'Panaji', aliases: ['Panjim'], region: 'WEST', officialReference: 'https://www.goa.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Gujarat', kind: 'STATE', capital: 'Gandhinagar', aliases: ['Ahmedabad'], region: 'WEST', officialReference: 'https://gujaratindia.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Haryana', kind: 'STATE', capital: 'Chandigarh', aliases: [], region: 'NORTH', capitalNote: 'Chandigarh is a shared capital and a separate Union Territory.', officialReference: 'https://haryana.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Himachal Pradesh', kind: 'STATE', capital: 'Shimla', aliases: ['Dharamshala'], region: 'NORTH', capitalNote: 'Dharamshala is the second capital.', officialReference: 'https://himachal.nic.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Jharkhand', kind: 'STATE', capital: 'Ranchi', aliases: [], region: 'EAST', officialReference: 'https://www.jharkhand.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Karnataka', kind: 'STATE', capital: 'Bengaluru', aliases: ['Bangalore'], region: 'SOUTH', officialReference: 'https://www.karnataka.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Kerala', kind: 'STATE', capital: 'Thiruvananthapuram', aliases: ['Trivandrum'], region: 'SOUTH', officialReference: 'https://kerala.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Madhya Pradesh', kind: 'STATE', capital: 'Bhopal', aliases: [], region: 'CENTRAL', officialReference: 'https://mp.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Maharashtra', kind: 'STATE', capital: 'Mumbai', aliases: ['Nagpur'], region: 'WEST', capitalNote: 'Nagpur is the winter/second capital.', officialReference: 'https://www.maharashtra.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Manipur', kind: 'STATE', capital: 'Imphal', aliases: [], region: 'NORTH_EAST', officialReference: 'https://manipur.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Meghalaya', kind: 'STATE', capital: 'Shillong', aliases: [], region: 'NORTH_EAST', officialReference: 'https://meghalaya.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Mizoram', kind: 'STATE', capital: 'Aizawl', aliases: [], region: 'NORTH_EAST', officialReference: 'https://mizoram.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Nagaland', kind: 'STATE', capital: 'Kohima', aliases: [], region: 'NORTH_EAST', officialReference: 'https://nagaland.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Odisha', kind: 'STATE', capital: 'Bhubaneswar', aliases: ['Bhubaneshwar'], region: 'EAST', officialReference: 'https://odisha.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Punjab', kind: 'STATE', capital: 'Chandigarh', aliases: [], region: 'NORTH', capitalNote: 'Chandigarh is a shared capital and a separate Union Territory.', officialReference: 'https://punjab.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Rajasthan', kind: 'STATE', capital: 'Jaipur', aliases: [], region: 'NORTH', officialReference: 'https://rajasthan.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Sikkim', kind: 'STATE', capital: 'Gangtok', aliases: [], region: 'NORTH_EAST', officialReference: 'https://sikkim.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Tamil Nadu', kind: 'STATE', capital: 'Chennai', aliases: ['Madras'], region: 'SOUTH', officialReference: 'https://www.tn.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Telangana', kind: 'STATE', capital: 'Hyderabad', aliases: [], region: 'SOUTH', officialReference: 'https://www.telangana.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Tripura', kind: 'STATE', capital: 'Agartala', aliases: [], region: 'NORTH_EAST', officialReference: 'https://tripura.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Uttar Pradesh', kind: 'STATE', capital: 'Lucknow', aliases: [], region: 'NORTH', officialReference: 'https://up.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Uttarakhand', kind: 'STATE', capital: 'Dehradun', aliases: ['Gairsain', 'Bhararisain'], region: 'NORTH', capitalNote: 'Dehradun is the winter capital; Gairsain (Bhararisain) is the summer capital.', officialReference: 'https://uk.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'West Bengal', kind: 'STATE', capital: 'Kolkata', aliases: ['Calcutta'], region: 'EAST', officialReference: 'https://wb.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Andaman and Nicobar Islands', kind: 'UNION_TERRITORY', capital: 'Sri Vijaya Puram', aliases: ['Port Blair'], region: 'ISLANDS', officialReference: 'https://andaman.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Chandigarh', kind: 'UNION_TERRITORY', capital: 'Chandigarh', aliases: [], region: 'NORTH', officialReference: 'https://chandigarh.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', kind: 'UNION_TERRITORY', capital: 'Daman', aliases: ['Silvassa'], region: 'WEST', officialReference: 'https://ddd.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Delhi', kind: 'UNION_TERRITORY', capital: 'New Delhi', aliases: ['National Capital Territory of Delhi'], region: 'NORTH', officialReference: 'https://delhi.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Jammu and Kashmir', kind: 'UNION_TERRITORY', capital: 'Srinagar', aliases: ['Jammu'], region: 'NORTH', capitalNote: 'Srinagar is the summer capital and Jammu the winter capital.', officialReference: 'https://jk.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Ladakh', kind: 'UNION_TERRITORY', capital: 'Leh', aliases: ['Kargil'], region: 'NORTH', officialReference: 'https://ladakh.nic.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Lakshadweep', kind: 'UNION_TERRITORY', capital: 'Kavaratti', aliases: [], region: 'ISLANDS', officialReference: 'https://lakshadweep.gov.in/', lastReviewedAt: '2026-11-03' },
  { name: 'Puducherry', kind: 'UNION_TERRITORY', capital: 'Puducherry', aliases: ['Pondicherry'], region: 'SOUTH', officialReference: 'https://py.gov.in/', lastReviewedAt: '2026-11-03' },
];

export const INDIA_STATE_COUNT = INDIA_ADMINISTRATIVE_UNITS.filter(unit => unit.kind === 'STATE').length;
export const INDIA_UT_COUNT = INDIA_ADMINISTRATIVE_UNITS.filter(unit => unit.kind === 'UNION_TERRITORY').length;
