import type { Operator } from '../types/bus.js';

/**
 * Government transport undertakings found in ASRTU/CAG and government transport references.
 * These are directory candidates, not authenticated operator accounts. No login/claim is implied.
 * Website links are official domains where independently identified; absent links are intentionally blank.
 */
const reviewedAt = '2026-11-03';
const source = 'ASRTU_STU_PROFILE_2019_20';

function operator(id: string, name: string, shortCode: string, serviceArea: string, website?: string, type: Operator['operatorType'] = 'GOVERNMENT_STATE'): Operator {
  return {
    id, name, shortCode, serviceArea, operatorType: type,
    ...(website ? { contactWebsite: website } : {}),
    verificationStatus: 'COMMUNITY_LISTED',
    isClaimed: false,
    sourceDataset: source,
    createdAt: reviewedAt + 'T00:00:00.000Z',
    updatedAt: reviewedAt + 'T00:00:00.000Z',
  };
}

export const INDIA_GOVERNMENT_OPERATORS: Operator[] = [
  operator('op-apsrtc', 'Andhra Pradesh State Road Transport Corporation', 'APSRTC', 'Andhra Pradesh', 'https://apsrtc.ap.gov.in/'),
  operator('op-apsts', 'Arunachal Pradesh State Transport Services', 'APSTS', 'Arunachal Pradesh', 'https://arunachalpradesh.gov.in/'),
  operator('op-astc', 'Assam State Transport Corporation', 'ASTC', 'Assam', 'https://astc.assam.gov.in/'),
  operator('op-bsrtc', 'Bihar State Road Transport Corporation', 'BSRTC', 'Bihar', 'https://state.bihar.gov.in/transport/'),
  operator('op-ktcl', 'Kadamba Transport Corporation Limited', 'KTCL', 'Goa', 'https://ktclgoa.com/'),
  operator('op-gsrtc', 'Gujarat State Road Transport Corporation', 'GSRTC', 'Gujarat', 'https://gsrtc.in/'),
  operator('op-haryana-roadways', 'Haryana Roadways', 'HR', 'Haryana', 'https://hartrans.gov.in/'),
  operator('op-hrtc', 'Himachal Road Transport Corporation', 'HRTC', 'Himachal Pradesh', 'https://hrtchp.com/'),
  operator('op-jksrtc', 'Jammu and Kashmir State Road Transport Corporation', 'JKSRTC', 'Jammu and Kashmir', 'https://jksrtc.co.in/'),
  operator('op-ksrtc', 'Karnataka State Road Transport Corporation', 'KSRTC', 'Karnataka', 'https://ksrtc.in/'),
  operator('op-kkrtc', 'Kalyana Karnataka Road Transport Corporation', 'KKRTC', 'Kalyana Karnataka', 'https://kkrtc.karnataka.gov.in/'),
  operator('op-nwkrtc', 'North Western Karnataka Road Transport Corporation', 'NWKRTC', 'North Western Karnataka', 'https://nwkrtc.karnataka.gov.in/'),
  operator('op-bmtc', 'Bengaluru Metropolitan Transport Corporation', 'BMTC', 'Bengaluru Urban', 'https://mybmtc.karnataka.gov.in/'),
  operator('op-kerala-rtc', 'Kerala State Road Transport Corporation', 'KSRTC-KL', 'Kerala', 'https://www.keralartc.com/'),
  operator('op-msrtc', 'Maharashtra State Road Transport Corporation', 'MSRTC', 'Maharashtra', 'https://msrtc.maharashtra.gov.in/'),
  operator('op-best', 'Brihanmumbai Electric Supply and Transport Undertaking', 'BEST', 'Mumbai', 'https://bestundertaking.com/', 'MUNICIPAL'),
  operator('op-mtc-meghalaya', 'Meghalaya Transport Corporation', 'MTC', 'Meghalaya', 'https://meghalaya.gov.in/'),
  operator('op-osrtc', 'Odisha State Road Transport Corporation', 'OSRTC', 'Odisha', 'https://osrtc.in/'),
  operator('op-punbus', 'Punjab State Bus Stand Management Company (PUNBUS)', 'PUNBUS', 'Punjab', 'https://punbusonline.com/'),
  operator('op-pepsu', 'PEPSU Road Transport Corporation', 'PRTC', 'Patiala and adjoining Punjab region', 'https://pepsuonline.com/'),
  operator('op-rsrtc', 'Rajasthan State Road Transport Corporation', 'RSRTC', 'Rajasthan', 'https://rsrtconline.rajasthan.gov.in/'),
  operator('op-sikkim-nt', 'Sikkim Nationalised Transport', 'SNT', 'Sikkim', 'https://sikkim.gov.in/'),
  operator('op-setc', 'State Express Transport Corporation Tamil Nadu', 'SETC', 'Tamil Nadu intercity', 'https://www.tnstc.in/'),
  operator('op-tnstc', 'Tamil Nadu State Transport Corporation', 'TNSTC', 'Tamil Nadu', 'https://www.tnstc.in/'),
  operator('op-mtc-chennai', 'Metropolitan Transport Corporation Chennai', 'MTC', 'Chennai', 'https://mtcbus.tn.gov.in/', 'MUNICIPAL'),
  operator('op-tgsrtc', 'Telangana State Road Transport Corporation', 'TGSRTC', 'Telangana', 'https://www.tgsrtc.telangana.gov.in/'),
  operator('op-trtc', 'Tripura Road Transport Corporation', 'TRTC', 'Tripura', 'https://tripura.gov.in/'),
  operator('op-upsrtc', 'Uttar Pradesh State Road Transport Corporation', 'UPSRTC', 'Uttar Pradesh', 'https://www.upsrtconline.co.in/'),
  operator('op-utc', 'Uttarakhand Transport Corporation', 'UTC', 'Uttarakhand', 'https://utc.uk.gov.in/'),
  operator('op-dtc', 'Delhi Transport Corporation', 'DTC', 'Delhi', 'https://dtc.delhi.gov.in/'),
  operator('op-ctu', 'Chandigarh Transport Undertaking', 'CTU', 'Chandigarh', 'https://chdctu.gov.in/'),
  operator('op-prtc-puducherry', 'Puducherry Road Transport Corporation', 'PRTC', 'Puducherry', 'https://prtc.in/'),
  operator('op-wbtc', 'West Bengal Transport Corporation', 'WBTC', 'Kolkata and suburban West Bengal', 'https://wbtconline.in/'),
  operator('op-sbstc', 'South Bengal State Transport Corporation', 'SBSTC', 'South and South-Western West Bengal', 'https://sbstc.co.in/'),
  operator('op-nbstc', 'North Bengal State Transport Corporation', 'NBSTC', 'North Bengal', 'https://nbstc.in/'),
];
