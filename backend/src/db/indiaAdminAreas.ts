import { Place } from '../../../packages/shared/src/types/places.js';

const now = '2026-10-30T00:00:00.000Z';
const areas: Array<{ state: Place['state']; capital: string; aliases?: string[] }> = [
  { state: 'Andhra Pradesh', capital: 'Amaravati', aliases: ['Vijayawada'] },
  { state: 'Arunachal Pradesh', capital: 'Itanagar' },
  { state: 'Assam', capital: 'Dispur', aliases: ['Guwahati'] },
  { state: 'Bihar', capital: 'Patna' },
  { state: 'Chhattisgarh', capital: 'Raipur' },
  { state: 'Goa', capital: 'Panaji', aliases: ['Panjim'] },
  { state: 'Gujarat', capital: 'Gandhinagar', aliases: ['Ahmedabad'] },
  { state: 'Haryana', capital: 'Chandigarh' },
  { state: 'Himachal Pradesh', capital: 'Shimla', aliases: ['Dharamshala'] },
  { state: 'Jharkhand', capital: 'Ranchi' },
  { state: 'Karnataka', capital: 'Bengaluru', aliases: ['Bangalore'] },
  { state: 'Kerala', capital: 'Thiruvananthapuram', aliases: ['Trivandrum'] },
  { state: 'Madhya Pradesh', capital: 'Bhopal' },
  { state: 'Maharashtra', capital: 'Mumbai' },
  { state: 'Manipur', capital: 'Imphal' },
  { state: 'Meghalaya', capital: 'Shillong' },
  { state: 'Mizoram', capital: 'Aizawl' },
  { state: 'Nagaland', capital: 'Kohima' },
  { state: 'Odisha', capital: 'Bhubaneswar' },
  { state: 'Punjab', capital: 'Chandigarh' },
  { state: 'Rajasthan', capital: 'Jaipur' },
  { state: 'Sikkim', capital: 'Gangtok' },
  { state: 'Tamil Nadu', capital: 'Chennai' },
  { state: 'Telangana', capital: 'Hyderabad' },
  { state: 'Tripura', capital: 'Agartala' },
  { state: 'Uttar Pradesh', capital: 'Lucknow' },
  { state: 'Uttarakhand', capital: 'Dehradun', aliases: ['Gairsain'] },
  { state: 'West Bengal', capital: 'Kolkata', aliases: ['Calcutta'] },
  { state: 'Delhi', capital: 'New Delhi', aliases: ['National Capital Territory of Delhi'] },
  { state: 'Jammu and Kashmir', capital: 'Srinagar', aliases: ['Jammu'] },
  { state: 'Ladakh', capital: 'Leh', aliases: ['Kargil'] },
  { state: 'Chandigarh', capital: 'Chandigarh' },
  { state: 'Puducherry', capital: 'Puducherry', aliases: ['Pondicherry'] },
  { state: 'Dadra and Nagar Haveli and Daman and Diu', capital: 'Daman', aliases: ['Silvassa'] },
  { state: 'Andaman and Nicobar Islands', capital: 'Sri Vijaya Puram', aliases: ['Port Blair'] },
  { state: 'Lakshadweep', capital: 'Kavaratti' },
];

export const INDIA_ADMIN_AREA_PLACES: Place[] = areas.flatMap((area, index) => {
  const state = area.state!;
  const statePlace: Place = {
    id: 'india-state-' + index,
    canonicalName: state,
    names: { en: state },
    placeType: 'STATE',
    state,
    sourceDataset: 'YATRIBUS_INDIA_ADMIN_INDEX',
    sourceLicense: 'YatriBus reference data',
    verificationStatus: 'UNVERIFIED',
    aliases: [],
    createdAt: now,
    updatedAt: now,
  };
  const cityPlace: Place = {
    id: 'india-capital-' + index,
    canonicalName: area.capital,
    names: { en: area.capital },
    placeType: 'CITY',
    state,
    sourceDataset: 'YATRIBUS_INDIA_ADMIN_INDEX',
    sourceLicense: 'YatriBus reference data',
    verificationStatus: 'UNVERIFIED',
    aliases: area.aliases || [],
    createdAt: now,
    updatedAt: now,
  };
  return [statePlace, cityPlace];
});
