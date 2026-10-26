/**
 * Multilingual Translations for India-Wide Smart Bus Platform
 * English, Hindi (हिन्दी), Bengali (বাংলা)
 */

export type SupportedLanguage = 'en' | 'hi' | 'bn';

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    app_title: 'YatraBus India',
    app_tagline: 'Smart Transport Directory & Community Live Tracking',
    nav_home: 'Home',
    nav_routes: 'Routes',
    nav_stops: 'Nearby Stops',
    nav_contribute: 'Contribute',
    nav_admin: 'Admin Portal',
    nav_track: 'Live Track',

    search_from_label: 'From (Station / Stop / Locality)',
    search_to_label: 'To (Destination Place)',
    search_placeholder: 'Type city, stop, or terminal name...',
    search_btn: 'Find Buses',
    swap_btn: 'Swap Origin and Destination',
    recent_searches: 'Recent Searches',
    clear_recent: 'Clear History',
    nearby_stops_title: 'Nearby Bus Stops & Terminals',
    popular_routes_title: 'Popular Verified Routes',
    no_results_found: 'No verified direct bus found for this route.',
    suggest_missing_prompt: 'Help other passengers by submitting this missing bus or route!',

    // Verification Badges
    badge_admin_verified: 'Verified Official',
    badge_community: 'Community Corroborated',
    badge_unverified: 'Unverified',
    badge_disputed: 'Disputed Timetable',
    badge_disrupted: 'Service Disruption',

    // Status & Tracking
    status_live_gps: 'Live GPS',
    status_estimated: 'Estimated',
    status_last_known: 'Last Known',
    status_unavailable: 'Location Unavailable',
    confidence_high: 'High Confidence',
    confidence_moderate: 'Moderate Confidence',
    confidence_low: 'Low Confidence',

    // Journey Confirmation & Consent
    prompt_travelling_title: 'Are you travelling on this bus?',
    prompt_travelling_desc: 'Help other passengers find buses more reliably. With your permission, your phone can contribute anonymous location updates while you confirm your journey. Search works completely without sharing location.',
    btn_yes_travelling: 'Yes, I am travelling',
    btn_not_now: 'Not now',
    btn_no: 'No',
    tracking_active_banner: 'You are helping other passengers by sharing live journey updates.',
    btn_stop_sharing: 'Stop Sharing Location',
    consent_notice: 'Your privacy is protected. No account required. Personal movement histories are never made public.',

    // Contribution Forms
    contrib_title: 'Community Contribution',
    contrib_subtitle: 'Keep Indian bus timetables accurate and up-to-date for everyone without registering.',
    contrib_tab_add_bus: 'Add Missing Bus',
    contrib_tab_add_stop: 'Add Bus Stop',
    contrib_tab_timetable: 'Timetable Correction',
    contrib_tab_disruption: 'Report Disruption',
    form_bus_name: 'Bus Name / Fleet Title',
    form_route_number: 'Route Number',
    form_operator: 'Operator / State Transport',
    form_stop_name: 'Stop Name / Landmark',
    form_state: 'State',
    form_district: 'District',
    form_departure_time: 'Scheduled Departure (IST)',
    form_arrival_time: 'Scheduled Arrival (IST)',
    form_notes: 'Additional Details / Notes',
    btn_submit_contrib: 'Submit for Review',
    ref_id_label: 'Your Tracking Reference ID:',
    dup_warning_title: 'Possible Duplicate Detected!',
    dup_warning_desc: 'We found an existing bus or route that looks very similar. Please review before proceeding.',

    // Admin
    admin_login_title: 'Administrator Sign-In',
    admin_dashboard_title: 'Transport Control Dashboard',
    admin_queue_title: 'Pending Community Submissions',
    admin_rules_title: 'Smart Automation Rules',
    admin_audit_title: 'Audit Logs & Rollback',
    btn_approve: 'Approve & Publish',
    btn_reject: 'Reject',
    btn_merge: 'Merge Duplicate',

    // Common
    minutes: 'mins',
    km: 'km',
    rupees: '₹',
    stops: 'stops',
    frequency: 'Every',
    close: 'Close',
    view_route_details: 'View Route & Stops',
    route_map: 'Route Map',
    departure: 'Departure',
    arrival: 'Arrival',
    duration: 'Duration'
  },

  hi: {
    app_title: 'यात्रा बस इंडिया',
    app_tagline: 'भारत का स्मार्ट बस डायरेक्टरी और लाइव ट्रैकिंग प्लेटफॉर्म',
    nav_home: 'होम',
    nav_routes: 'रूट खोजें',
    nav_stops: 'आसपास के स्टॉप',
    nav_contribute: 'योगदान दें',
    nav_admin: 'एडमिन पोर्टल',
    nav_track: 'लाइव ट्रैक',

    search_from_label: 'कहाँ से (स्टॉप / स्टेशन / इलाका)',
    search_to_label: 'कहाँ तक (गंतव्य स्थान)',
    search_placeholder: 'शहर, बस स्टैंड या स्टेशन का नाम लिखें...',
    search_btn: 'बसें खोजें',
    swap_btn: 'स्थान बदलें',
    recent_searches: 'हाल की खोजें',
    clear_recent: 'इतिहास साफ़ करें',
    nearby_stops_title: 'आसपास के बस स्टॉप और टर्मिनल',
    popular_routes_title: 'प्रमुख सत्यापित बस रूट',
    no_results_found: 'इस रूट के लिए कोई सत्यापित सीधी बस नहीं मिली।',
    suggest_missing_prompt: 'अन्य यात्रियों की मदद के लिए इस छूटी हुई बस की जानकारी जोड़ें!',

    badge_admin_verified: 'सत्यापित आधिकारिक',
    badge_community: 'समुदाय द्वारा पुष्ट',
    badge_unverified: 'असत्यापित',
    badge_disputed: 'विवादित समय सारणी',
    badge_disrupted: 'रूट में बाधा',

    status_live_gps: 'लाइव जीपीएस',
    status_estimated: 'अनुमानित समय',
    status_last_known: 'अंतिम ज्ञात स्थान',
    status_unavailable: 'स्थान अनुपलब्ध',
    confidence_high: 'उच्च विश्वसनीयता',
    confidence_moderate: 'मध्यम विश्वसनीयता',
    confidence_low: 'निम्न विश्वसनीयता',

    prompt_travelling_title: 'क्या आप इस बस में यात्रा कर रहे हैं?',
    prompt_travelling_desc: 'अन्य यात्रियों की मदद करें। आपकी अनुमति से, आपकी यात्रा की पुष्टि करते समय आपका फोन लाइव अपडेट साझा कर सकता है। खोज बिना लोकेशन साझा किए भी काम करती है।',
    btn_yes_travelling: 'हाँ, मैं यात्रा कर रहा हूँ',
    btn_not_now: 'अभी नहीं',
    btn_no: 'नहीं',
    tracking_active_banner: 'आप लाइव यात्रा अपडेट साझा करके अन्य यात्रियों की मदद कर रहे हैं।',
    btn_stop_sharing: 'लोकेशन साझा करना बंद करें',
    consent_notice: 'आपकी गोपनीयता सुरक्षित है। कोई खाता आवश्यक नहीं है। व्यक्तिगत यात्रा कभी सार्वजनिक नहीं की जाती।',

    contrib_title: 'समुदाय योगदान',
    contrib_subtitle: 'बिना लॉगिन किए बस समय सारणी को सटीक और अद्यतित बनाए रखने में मदद करें।',
    contrib_tab_add_bus: 'नई बस जोड़ें',
    contrib_tab_add_stop: 'नया स्टॉप जोड़ें',
    contrib_tab_timetable: 'समय में संशोधन',
    contrib_tab_disruption: 'बाधा की रिपोर्ट करें',
    form_bus_name: 'बस का नाम / नंबर',
    form_route_number: 'रूट नंबर',
    form_operator: 'ऑपरेटर / परिवहन निगम',
    form_stop_name: 'स्टॉप का नाम / लैंडमार्क',
    form_state: 'राज्य',
    form_district: 'ज़िला',
    form_departure_time: 'प्रस्थान समय (IST)',
    form_arrival_time: 'पहुंचने का समय (IST)',
    form_notes: 'अतिरिक्त विवरण / टिप्पणी',
    btn_submit_contrib: 'समीक्षा के लिए भेजें',
    ref_id_label: 'आपका संदर्भ ट्रैकिंग आईडी:',
    dup_warning_title: 'संभावित डुप्लिकेट मिला!',
    dup_warning_desc: 'एक मिलती-जुलती बस या रूट पहले से मौजूद है। कृपया जांचें।',

    admin_login_title: 'व्यवस्थापक लॉगिन',
    admin_dashboard_title: 'परिवहन नियंत्रण डैशबोर्ड',
    admin_queue_title: 'लंबित समुदाय योगदान',
    admin_rules_title: 'स्मार्ट स्वचालन नियम',
    admin_audit_title: 'ऑडिट लॉग और रोलबैक',
    btn_approve: 'स्वीकार करें और प्रकाशित करें',
    btn_reject: 'अस्वीकार करें',
    btn_merge: 'विलय करें',

    minutes: 'मिनट',
    km: 'किमी',
    rupees: '₹',
    stops: 'स्टॉप',
    frequency: 'प्रत्येक',
    close: 'बंद करें',
    view_route_details: 'रूट और स्टॉप विवरण देखें',
    route_map: 'रूट का नक्शा',
    departure: 'प्रस्थान',
    arrival: 'आगमन',
    duration: 'समय'
  },

  bn: {
    app_title: 'যাত্রাবাস ইন্ডিয়া',
    app_tagline: 'ভারতের স্মার্ট বাস ডিরেক্টরি ও লাইভ ট্র্যাকিং প্ল্যাটফর্ম',
    nav_home: 'হোম',
    nav_routes: 'রুট খুঁজুন',
    nav_stops: 'কাছের বাস স্টপ',
    nav_contribute: 'অবদান রাখুন',
    nav_admin: 'অ্যাডমিন পোর্টাল',
    nav_track: 'লাইভ ট্র্যাক',

    search_from_label: 'কোথা থেকে (বাস স্ট্যান্ড / স্টেশন)',
    search_to_label: 'কোথায় যাবেন (গন্তব্য)',
    search_placeholder: 'শহর বা বাস স্ট্যান্ডের নাম লিখুন...',
    search_btn: 'বাস খুঁজুন',
    swap_btn: 'স্থান অদলবদল করুন',
    recent_searches: 'সাম্প্রতিক অনুসন্ধান',
    clear_recent: 'মুছে ফেলুন',
    nearby_stops_title: 'কাছের বাস টার্মিনাল ও স্টপ',
    popular_routes_title: 'জনপ্রিয় বাস রুট',
    no_results_found: 'এই রুটে সরাসরি কোনো বাস পাওয়া যায়নি।',
    suggest_missing_prompt: 'অন্য যাত্রীদের সাহায্য করতে এই বাসের তথ্য যুক্ত করুন!',

    badge_admin_verified: 'সরকারি যাচাইকৃত',
    badge_community: 'যাত্রীদের দ্বারা নিশ্চিত',
    badge_unverified: 'অযাচাইকৃত',
    badge_disputed: 'বিরোধপূর্ণ সময়সূচী',
    badge_disrupted: 'রুট ব্যাহত',

    status_live_gps: 'লাইভ জিপিএস',
    status_estimated: 'আনুমানিক সময়',
    status_last_known: 'সর্বশেষ অবস্থান',
    status_unavailable: 'অবস্থান পাওয়া যায়নি',
    confidence_high: 'উচ্চ নির্ভরযোগ্যতা',
    confidence_moderate: 'মাঝারি নির্ভরযোগ্যতা',
    confidence_low: 'কম নির্ভরযোগ্যতা',

    prompt_travelling_title: 'আপনি কি এই বাসে ভ্রমণ করছেন?',
    prompt_travelling_desc: 'অন্য যাত্রীদের সুবিধার্থে আপনার ফোন থেকে বেনামে লাইভ লোকেশন আপডেট পাঠাতে পারেন। লোকেশন না দিয়েও বাস অনুসন্ধান করা যাবে।',
    btn_yes_travelling: 'হ্যাঁ, আমি যাচ্ছি',
    btn_not_now: 'এখন নয়',
    btn_no: 'না',
    tracking_active_banner: 'আপনি লাইভ লোকেশন আপডেট দিয়ে অন্যান্য যাত্রীদের সাহায্য করছেন।',
    btn_stop_sharing: 'লোকেশন শেয়ার বন্ধ করুন',
    consent_notice: 'আপনার গোপনীয়তা সুরক্ষিত। ব্যক্তিগত তথ্য কখনো প্রকাশ করা হয় না।',

    contrib_title: 'নাগরিক অবদান',
    contrib_subtitle: 'লগইন ছাড়াই বাসের সময়সূচী সঠিক রাখতে সাহায্য করুন।',
    contrib_tab_add_bus: 'নতুন বাস যোগ করুন',
    contrib_tab_add_stop: 'নতুন স্টপ যোগ করুন',
    contrib_tab_timetable: 'সময়সূচী সংশোধন',
    contrib_tab_disruption: 'সমস্যার রিপোর্ট করুন',
    form_bus_name: 'বাসের নাম / নম্বর',
    form_route_number: 'রুট নম্বর',
    form_operator: 'অপারেটর / নিগম',
    form_stop_name: 'বাস স্টপের নাম / ল্যান্ডমার্ক',
    form_state: 'রাজ্য',
    form_district: 'জেলা',
    form_departure_time: 'ছাড়ার সময় (IST)',
    form_arrival_time: 'পৌঁছানোর সময় (IST)',
    form_notes: 'অতিরিক্ত বিবরণ',
    btn_submit_contrib: 'পর্যালোচনার জন্য জমা দিন',
    ref_id_label: 'আপনার ট্র্যাকিং রেফারেন্স আইডি:',
    dup_warning_title: 'অনুরূপ বাস ইতিমধ্যে বিদ্যমান!',
    dup_warning_desc: 'একটি খুব অনুরূপ বাস বা রুট খুঁজে পাওয়া গেছে। অনুগ্রহ করে যাচাই করুন।',

    admin_login_title: 'অ্যাডমিন লগইন',
    admin_dashboard_title: 'পরিবহন নিয়ন্ত্রণ ড্যাশবোর্ড',
    admin_queue_title: 'অপেক্ষমাণ জমা তথ্য',
    admin_rules_title: 'স্মার্ট অটোমেশন নিয়মাবলী',
    admin_audit_title: 'অডিট লগ ও রোলব্যাক',
    btn_approve: 'অনুমোদন ও প্রকাশ করুন',
    btn_reject: 'প্রত্যাখ্যান করুন',
    btn_merge: 'একত্রিত করুন',

    minutes: 'মিনিট',
    km: 'কিমি',
    rupees: '₹',
    stops: 'স্টপ',
    frequency: 'প্রতি',
    close: 'বন্ধ করুন',
    view_route_details: 'রুট ও স্টপ দেখুন',
    route_map: 'রুটের মানচিত্র',
    departure: 'প্রস্থান',
    arrival: 'গন্তব্য',
    duration: 'সময়'
  }
};

let currentLanguage: SupportedLanguage = 'en';

export function setLanguage(lang: SupportedLanguage) {
  if (TRANSLATIONS[lang]) {
    currentLanguage = lang;
    localStorage.setItem('yatrabus_lang', lang);
  }
}

export function getLanguage(): SupportedLanguage {
  const saved = localStorage.getItem('yatrabus_lang') as SupportedLanguage;
  if (saved && TRANSLATIONS[saved]) {
    currentLanguage = saved;
  }
  return currentLanguage;
}

export function t(key: string): string {
  const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}
