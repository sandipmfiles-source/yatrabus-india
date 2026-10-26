import { Place, Operator, Bus, Route, TimetableDeparture, AutomationRule } from '../../types';

export const SEED_PLACES: Place[] = [
  // --- DELHI NCT ---
  {
    id: 'plc-del-01',
    canonicalName: 'Kashmiri Gate ISBT',
    placeType: 'bus_terminal',
    state: 'Delhi',
    district: 'Central Delhi',
    subdivision: 'Civil Lines',
    latitude: 28.6675,
    longitude: 77.2285,
    sourceDataset: 'Open Transport Data / Govt Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'ISBT Kashmiri Gate' },
      { lang: 'hi', name: 'कश्मीरी गेट बस अड्डा' },
      { lang: 'bn', name: 'কাশ্মীরি গেট বাস টার্মিনাল' },
      { lang: 'en', name: 'Kashmere Gate Terminal', isTransliteration: true }
    ]
  },
  {
    id: 'plc-del-02',
    canonicalName: 'Anand Vihar ISBT',
    placeType: 'bus_terminal',
    state: 'Delhi',
    district: 'East Delhi',
    subdivision: 'Vivek Vihar',
    latitude: 28.6472,
    longitude: 77.3158,
    sourceDataset: 'Delhi Govt Transport',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Anand Vihar Terminal' },
      { lang: 'hi', name: 'आनंद विहार बस अड्डा' },
      { lang: 'bn', name: 'আনন্দ বিহার টার্মিনাল' }
    ]
  },
  {
    id: 'plc-del-03',
    canonicalName: 'Connaught Place',
    placeType: 'locality',
    state: 'Delhi',
    district: 'New Delhi',
    subdivision: 'Chanakyapuri',
    latitude: 28.6315,
    longitude: 77.2167,
    sourceDataset: 'Delhi Places Master',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'CP Shivaji Stadium' },
      { lang: 'hi', name: 'कनॉट प्लेस' },
      { lang: 'bn', name: 'কনট প্লেস' }
    ]
  },
  {
    id: 'plc-del-04',
    canonicalName: 'Mehrauli Terminal',
    placeType: 'bus_terminal',
    state: 'Delhi',
    district: 'South Delhi',
    subdivision: 'Hauz Khas',
    latitude: 28.5186,
    longitude: 77.1813,
    sourceDataset: 'Delhi Transport Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Mehrauli Bus Stand' },
      { lang: 'hi', name: 'महरौली बस टर्मिनल' },
      { lang: 'bn', name: 'মেহরাউলি বাস স্ট্যান্ড' }
    ]
  },
  {
    id: 'plc-del-05',
    canonicalName: 'Hauz Khas',
    placeType: 'bus_stop',
    state: 'Delhi',
    district: 'South Delhi',
    latitude: 28.5494,
    longitude: 77.2001,
    sourceDataset: 'Delhi Transport Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'hi', name: 'हौज़ खास' },
      { lang: 'bn', name: 'হৌজ খাস' }
    ]
  },
  {
    id: 'plc-del-06',
    canonicalName: 'AIIMS Bus Stop',
    placeType: 'bus_stop',
    state: 'Delhi',
    district: 'South Delhi',
    latitude: 28.5672,
    longitude: 77.2100,
    sourceDataset: 'Delhi Transport Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'hi', name: 'एम्स बस स्टॉप' },
      { lang: 'bn', name: 'এইমস বাস স্টপ' },
      { lang: 'en', name: 'Ansari Nagar AIIMS' }
    ]
  },
  {
    id: 'plc-del-07',
    canonicalName: 'Old Delhi Railway Station',
    placeType: 'bus_station',
    state: 'Delhi',
    district: 'North Delhi',
    latitude: 28.6619,
    longitude: 77.2304,
    sourceDataset: 'Delhi Transport Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'hi', name: 'पुरानी दिल्ली रेलवे स्टेशन' },
      { lang: 'bn', name: 'পুরানো দিল্লি রেল স্টেশন' },
      { lang: 'en', name: 'Chandni Chowk / Old Delhi' }
    ]
  },

  // --- MAHARASHTRA / MUMBAI & PUNE ---
  {
    id: 'plc-mum-01',
    canonicalName: 'Dadar Asiad Stand',
    placeType: 'bus_terminal',
    state: 'Maharashtra',
    district: 'Mumbai City',
    latitude: 19.0178,
    longitude: 72.8478,
    sourceDataset: 'Maharashtra Transport Open Data',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Dadar TT Circle' },
      { lang: 'hi', name: 'दादर बस स्टैंड' },
      { lang: 'bn', name: 'দাদার বাস স্ট্যান্ড' }
    ]
  },
  {
    id: 'plc-mum-02',
    canonicalName: 'Borivali Sukurwadi Stand',
    placeType: 'bus_terminal',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    latitude: 19.2294,
    longitude: 72.8572,
    sourceDataset: 'Maharashtra Transport Open Data',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Borivali West Station' },
      { lang: 'hi', name: 'बोरीवली सुकुरवाड़ी बस स्टैंड' },
      { lang: 'bn', name: 'বোরিভলি বাস স্ট্যান্ড' }
    ]
  },
  {
    id: 'plc-mum-03',
    canonicalName: 'Andheri West Bus Station',
    placeType: 'bus_station',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    latitude: 19.1197,
    longitude: 72.8464,
    sourceDataset: 'BEST Data',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'hi', name: 'अंधेरी पश्चिम' },
      { lang: 'bn', name: 'আন্ধেরি ওয়েস্ট' }
    ]
  },
  {
    id: 'plc-mum-04',
    canonicalName: 'Bandra Station Bus Stand',
    placeType: 'bus_stop',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    latitude: 19.0544,
    longitude: 72.8402,
    sourceDataset: 'BEST Data',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'hi', name: 'बांद्रा बस स्टैंड' },
      { lang: 'bn', name: 'বান্দ্রা স্টেশন' }
    ]
  },
  {
    id: 'plc-pun-01',
    canonicalName: 'Pune Swargate Bus Station',
    placeType: 'bus_terminal',
    state: 'Maharashtra',
    district: 'Pune',
    latitude: 18.5018,
    longitude: 73.8586,
    sourceDataset: 'MSRTC Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Swargate Terminal' },
      { lang: 'hi', name: 'पुणे स्वारगेट बस अड्डा' },
      { lang: 'bn', name: 'পুনে সারগেট' }
    ]
  },

  // --- WEST BENGAL / KOLKATA ---
  {
    id: 'plc-kol-01',
    canonicalName: 'Esplanade Bus Terminus',
    placeType: 'bus_terminal',
    state: 'West Bengal',
    district: 'Kolkata',
    subdivision: 'Kolkata Central',
    latitude: 22.5645,
    longitude: 88.3523,
    sourceDataset: 'WBTC Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Dharmatala Bus Stand' },
      { lang: 'bn', name: 'এসপ্ল্যানেড বাস টার্মিনাস (ধর্মতলা)' },
      { lang: 'hi', name: 'एस्प्लेनेड धर्मतला बस अड्डा' }
    ]
  },
  {
    id: 'plc-kol-02',
    canonicalName: 'Howrah Station Bus Stand',
    placeType: 'bus_station',
    state: 'West Bengal',
    district: 'Howrah',
    latitude: 22.5855,
    longitude: 88.3426,
    sourceDataset: 'WBTC Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'bn', name: 'হাওড়া স্টেশন বাস স্ট্যান্ড' },
      { lang: 'hi', name: 'हावड़ा स्टेशन बस स्टैंड' }
    ]
  },
  {
    id: 'plc-kol-03',
    canonicalName: 'Kolkata Airport Gate 1',
    placeType: 'bus_stop',
    state: 'West Bengal',
    district: 'North 24 Parganas',
    latitude: 22.6547,
    longitude: 88.4467,
    sourceDataset: 'WBTC Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'NSCB International Airport' },
      { lang: 'bn', name: 'কলকাতা এয়ারপোর্ট এক নম্বর গেট' },
      { lang: 'hi', name: 'कोलकाता हवाई अड्डा' }
    ]
  },
  {
    id: 'plc-kol-04',
    canonicalName: 'Ultadanga Hudco',
    placeType: 'bus_stop',
    state: 'West Bengal',
    district: 'Kolkata',
    latitude: 22.5973,
    longitude: 88.3934,
    sourceDataset: 'WBTC Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'bn', name: 'উল্টোডাঙা হুডকো' },
      { lang: 'hi', name: 'उल्टाडांगा हुडको' }
    ]
  },

  // --- KARNATAKA / BENGALURU ---
  {
    id: 'plc-blr-01',
    canonicalName: 'Kempegowda Bus Station (Majestic)',
    placeType: 'bus_terminal',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    latitude: 12.9774,
    longitude: 77.5714,
    sourceDataset: 'BMTC Open Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Majestic Bus Stand' },
      { lang: 'hi', name: 'केम्पेगौड़ा बस स्टेशन मैजेस्टिक' },
      { lang: 'bn', name: 'কেম্পেগৌড়া বাস স্টেশন ম্যাজেস্টিক' }
    ]
  },
  {
    id: 'plc-blr-02',
    canonicalName: 'Electronic City Toll Gate',
    placeType: 'bus_station',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    latitude: 12.8452,
    longitude: 77.6602,
    sourceDataset: 'BMTC Open Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'E-City Phase 1' },
      { lang: 'hi', name: 'इलेक्ट्रॉनिक सिटी' },
      { lang: 'bn', name: 'ইলেকট্রনিক সিটি' }
    ]
  },
  {
    id: 'plc-blr-03',
    canonicalName: 'Silk Board Junction',
    placeType: 'bus_stop',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    latitude: 12.9177,
    longitude: 77.6238,
    sourceDataset: 'BMTC Open Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Central Silk Board' },
      { lang: 'hi', name: 'सिल्क बोर्ड जंक्शन' },
      { lang: 'bn', name: 'সিল্ক বোর্ড' }
    ]
  },

  // --- TAMIL NADU / CHENNAI ---
  {
    id: 'plc-chn-01',
    canonicalName: 'Koyambedu CMBT',
    placeType: 'bus_terminal',
    state: 'Tamil Nadu',
    district: 'Chennai',
    latitude: 13.0694,
    longitude: 80.2056,
    sourceDataset: 'Chennai Transport Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Chennai Mofussil Bus Terminus' },
      { lang: 'hi', name: 'कोयम्बेडु बस टर्मिनस' },
      { lang: 'bn', name: 'কয়াম্বেদু বাস টার্মিনাল' }
    ]
  },
  {
    id: 'plc-chn-02',
    canonicalName: 'Tambaram Sanatorium Bus Stand',
    placeType: 'bus_station',
    state: 'Tamil Nadu',
    district: 'Chengalpattu',
    latitude: 12.9363,
    longitude: 80.1287,
    sourceDataset: 'Chennai Transport Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Tambaram MEPZ' },
      { lang: 'hi', name: 'तांबरम बस स्टैंड' },
      { lang: 'bn', name: 'তাম্বারাম' }
    ]
  },

  // --- UTTAR PRADESH / LUCKNOW ---
  {
    id: 'plc-lko-01',
    canonicalName: 'Lucknow Alambagh Bus Station',
    placeType: 'bus_terminal',
    state: 'Uttar Pradesh',
    district: 'Lucknow',
    latitude: 26.8188,
    longitude: 80.9061,
    sourceDataset: 'UPSRTC Directory',
    verificationStatus: 'admin_verified',
    lastUpdated: '2026-03-15T08:00:00Z',
    aliases: [
      { lang: 'en', name: 'Alambagh ISBT' },
      { lang: 'hi', name: 'लखनऊ आलमबाग बस स्टेशन' },
      { lang: 'bn', name: 'লখনউ আলমবাগ বাস স্ট্যান্ড' }
    ]
  }
];

export const SEED_OPERATORS: Operator[] = [
  {
    id: 'op-dtc',
    name: 'Delhi Transport Corporation (DTC)',
    shortCode: 'DTC',
    state: 'Delhi',
    serviceArea: 'Delhi NCR and Intercity Connections',
    contactPhone: '1800-11-8181',
    contactEmail: 'support@dtc.delhi.gov.in',
    isGovernment: true,
    verificationStatus: 'admin_verified'
  },
  {
    id: 'op-best',
    name: 'Brihanmumbai Electric Supply & Transport (BEST)',
    shortCode: 'BEST',
    state: 'Maharashtra',
    serviceArea: 'Greater Mumbai, Thane & Navi Mumbai',
    contactPhone: '1800-22-7550',
    contactEmail: 'traveldesk@bestundertaking.com',
    isGovernment: true,
    verificationStatus: 'admin_verified'
  },
  {
    id: 'op-wbtc',
    name: 'West Bengal Transport Corporation (WBTC)',
    shortCode: 'WBTC',
    state: 'West Bengal',
    serviceArea: 'Kolkata Metropolitan Area and Intercity Bengal',
    contactPhone: '1800-345-3929',
    contactEmail: 'info@wbtc.co.in',
    isGovernment: true,
    verificationStatus: 'admin_verified'
  },
  {
    id: 'op-bmtc',
    name: 'Bengaluru Metropolitan Transport Corporation (BMTC)',
    shortCode: 'BMTC',
    state: 'Karnataka',
    serviceArea: 'Bengaluru Metropolitan Region',
    contactPhone: '080-22483777',
    contactEmail: 'contact@mybmtc.com',
    isGovernment: true,
    verificationStatus: 'admin_verified'
  },
  {
    id: 'op-msrtc',
    name: 'Maharashtra State Road Transport Corporation (MSRTC)',
    shortCode: 'MSRTC',
    state: 'Maharashtra',
    serviceArea: 'Maharashtra Intercity & Rural Shivshahi',
    contactPhone: '1800-22-1250',
    contactEmail: 'msrtc@maharashtra.gov.in',
    isGovernment: true,
    verificationStatus: 'admin_verified'
  },
  {
    id: 'op-upsrtc',
    name: 'Uttar Pradesh State Road Transport Corporation (UPSRTC)',
    shortCode: 'UPSRTC',
    state: 'Uttar Pradesh',
    serviceArea: 'Uttar Pradesh State and Neighboring Regions',
    contactPhone: '1800-180-2877',
    contactEmail: 'helpline@upsrtc.com',
    isGovernment: true,
    verificationStatus: 'admin_verified'
  }
];

export const SEED_BUSES: Bus[] = [
  {
    id: 'bus-dtc-502-01',
    name: 'DTC Low Floor AC 502',
    operatorId: 'op-dtc',
    registrationNumber: 'DL 1P C 8492',
    vehicleType: 'electric',
    status: 'active',
    verificationStatus: 'admin_verified',
    features: ['ac', 'low_floor', 'charging_point', 'cctv'],
    createdDate: '2026-01-10T00:00:00Z',
    updatedDate: '2026-03-20T00:00:00Z'
  },
  {
    id: 'bus-best-203-01',
    name: 'BEST Tejaswini Express 203',
    operatorId: 'op-best',
    registrationNumber: 'MH 01 BR 3314',
    vehicleType: 'electric',
    status: 'active',
    verificationStatus: 'admin_verified',
    features: ['ac', 'low_floor', 'ladies_seat'],
    createdDate: '2026-01-10T00:00:00Z',
    updatedDate: '2026-03-20T00:00:00Z'
  },
  {
    id: 'bus-wbtc-c8-01',
    name: 'WBTC Airport AC C-8',
    operatorId: 'op-wbtc',
    registrationNumber: 'WB 04 G 9102',
    vehicleType: 'ac_volvo',
    status: 'active',
    verificationStatus: 'admin_verified',
    features: ['ac', 'luggage_rack', 'wifi'],
    createdDate: '2026-01-10T00:00:00Z',
    updatedDate: '2026-03-20T00:00:00Z'
  },
  {
    id: 'bus-bmtc-500d-01',
    name: 'BMTC Vajra 500-D',
    operatorId: 'op-bmtc',
    registrationNumber: 'KA 01 F 7729',
    vehicleType: 'ac_volvo',
    status: 'active',
    verificationStatus: 'admin_verified',
    features: ['ac', 'low_floor', 'charging_point'],
    createdDate: '2026-01-10T00:00:00Z',
    updatedDate: '2026-03-20T00:00:00Z'
  },
  {
    id: 'bus-upsrtc-exp-01',
    name: 'UPSRTC Janrath AC Express',
    operatorId: 'op-upsrtc',
    registrationNumber: 'UP 32 CZ 4401',
    vehicleType: 'express',
    status: 'active',
    verificationStatus: 'admin_verified',
    features: ['ac', 'pushback_seats', 'reading_light'],
    createdDate: '2026-01-10T00:00:00Z',
    updatedDate: '2026-03-20T00:00:00Z'
  }
];

export const SEED_ROUTES: Route[] = [
  // Delhi Route 502
  {
    id: 'rt-del-502',
    routeNumber: '502',
    name: 'Mehrauli Terminal to Old Delhi Railway Station',
    operatorId: 'op-dtc',
    originPlaceId: 'plc-del-04',
    originName: 'Mehrauli Terminal',
    destinationPlaceId: 'plc-del-07',
    destinationName: 'Old Delhi Railway Station',
    direction: 'up',
    durationMinutes: 65,
    distanceKm: 21.4,
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    status: 'active',
    verificationStatus: 'admin_verified',
    firstDepartureTime: '05:30',
    lastDepartureTime: '22:45',
    frequencyMinutes: 15,
    polyline: [
      [28.5186, 77.1813],
      [28.5340, 77.1910],
      [28.5494, 77.2001], // Hauz Khas
      [28.5672, 77.2100], // AIIMS
      [28.6000, 77.2120],
      [28.6315, 77.2167], // Connaught Place
      [28.6500, 77.2250],
      [28.6619, 77.2304]  // Old Delhi
    ],
    stops: [
      {
        routeId: 'rt-del-502',
        stopId: 'plc-del-04',
        stopName: 'Mehrauli Terminal',
        stopSequence: 1,
        arrivalOffsetMinutes: 0,
        departureOffsetMinutes: 0,
        distanceFromOriginKm: 0.0,
        latitude: 28.5186,
        longitude: 77.1813
      },
      {
        routeId: 'rt-del-502',
        stopId: 'plc-del-05',
        stopName: 'Hauz Khas',
        stopSequence: 2,
        arrivalOffsetMinutes: 16,
        departureOffsetMinutes: 18,
        distanceFromOriginKm: 4.8,
        latitude: 28.5494,
        longitude: 77.2001
      },
      {
        routeId: 'rt-del-502',
        stopId: 'plc-del-06',
        stopName: 'AIIMS Bus Stop',
        stopSequence: 3,
        arrivalOffsetMinutes: 28,
        departureOffsetMinutes: 30,
        distanceFromOriginKm: 8.2,
        latitude: 28.5672,
        longitude: 77.2100
      },
      {
        routeId: 'rt-del-502',
        stopId: 'plc-del-03',
        stopName: 'Connaught Place',
        stopSequence: 4,
        arrivalOffsetMinutes: 48,
        departureOffsetMinutes: 50,
        distanceFromOriginKm: 15.6,
        latitude: 28.6315,
        longitude: 77.2167
      },
      {
        routeId: 'rt-del-502',
        stopId: 'plc-del-07',
        stopName: 'Old Delhi Railway Station',
        stopSequence: 5,
        arrivalOffsetMinutes: 65,
        departureOffsetMinutes: 65,
        distanceFromOriginKm: 21.4,
        latitude: 28.6619,
        longitude: 77.2304
      }
    ]
  },

  // Mumbai Route 203
  {
    id: 'rt-mum-203',
    routeNumber: '203',
    name: 'Borivali Sukurwadi to Dadar Asiad Stand',
    operatorId: 'op-best',
    originPlaceId: 'plc-mum-02',
    originName: 'Borivali Sukurwadi Stand',
    destinationPlaceId: 'plc-mum-01',
    destinationName: 'Dadar Asiad Stand',
    direction: 'up',
    durationMinutes: 75,
    distanceKm: 28.2,
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    status: 'active',
    verificationStatus: 'admin_verified',
    firstDepartureTime: '05:45',
    lastDepartureTime: '23:15',
    frequencyMinutes: 12,
    polyline: [
      [19.2294, 72.8572],
      [19.1800, 72.8500],
      [19.1197, 72.8464], // Andheri West
      [19.0800, 72.8420],
      [19.0544, 72.8402], // Bandra
      [19.0300, 72.8430],
      [19.0178, 72.8478]  // Dadar
    ],
    stops: [
      {
        routeId: 'rt-mum-203',
        stopId: 'plc-mum-02',
        stopName: 'Borivali Sukurwadi Stand',
        stopSequence: 1,
        arrivalOffsetMinutes: 0,
        departureOffsetMinutes: 0,
        distanceFromOriginKm: 0.0,
        latitude: 19.2294,
        longitude: 72.8572
      },
      {
        routeId: 'rt-mum-203',
        stopId: 'plc-mum-03',
        stopName: 'Andheri West Bus Station',
        stopSequence: 2,
        arrivalOffsetMinutes: 32,
        departureOffsetMinutes: 34,
        distanceFromOriginKm: 13.5,
        latitude: 19.1197,
        longitude: 72.8464
      },
      {
        routeId: 'rt-mum-203',
        stopId: 'plc-mum-04',
        stopName: 'Bandra Station Bus Stand',
        stopSequence: 3,
        arrivalOffsetMinutes: 54,
        departureOffsetMinutes: 56,
        distanceFromOriginKm: 22.0,
        latitude: 19.0544,
        longitude: 72.8402
      },
      {
        routeId: 'rt-mum-203',
        stopId: 'plc-mum-01',
        stopName: 'Dadar Asiad Stand',
        stopSequence: 4,
        arrivalOffsetMinutes: 75,
        departureOffsetMinutes: 75,
        distanceFromOriginKm: 28.2,
        latitude: 19.0178,
        longitude: 72.8478
      }
    ]
  },

  // Kolkata Route C-8
  {
    id: 'rt-kol-c8',
    routeNumber: 'C-8',
    name: 'Esplanade to Kolkata Airport Gate 1',
    operatorId: 'op-wbtc',
    originPlaceId: 'plc-kol-01',
    originName: 'Esplanade Bus Terminus',
    destinationPlaceId: 'plc-kol-03',
    destinationName: 'Kolkata Airport Gate 1',
    direction: 'up',
    durationMinutes: 50,
    distanceKm: 17.5,
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    status: 'active',
    verificationStatus: 'admin_verified',
    firstDepartureTime: '06:00',
    lastDepartureTime: '22:00',
    frequencyMinutes: 20,
    polyline: [
      [22.5645, 88.3523],
      [22.5800, 88.3750],
      [22.5973, 88.3934], // Ultadanga
      [22.6250, 88.4200],
      [22.6547, 88.4467]  // Airport
    ],
    stops: [
      {
        routeId: 'rt-kol-c8',
        stopId: 'plc-kol-01',
        stopName: 'Esplanade Bus Terminus',
        stopSequence: 1,
        arrivalOffsetMinutes: 0,
        departureOffsetMinutes: 0,
        distanceFromOriginKm: 0.0,
        latitude: 22.5645,
        longitude: 88.3523
      },
      {
        routeId: 'rt-kol-c8',
        stopId: 'plc-kol-04',
        stopName: 'Ultadanga Hudco',
        stopSequence: 2,
        arrivalOffsetMinutes: 22,
        departureOffsetMinutes: 24,
        distanceFromOriginKm: 8.5,
        latitude: 22.5973,
        longitude: 88.3934
      },
      {
        routeId: 'rt-kol-c8',
        stopId: 'plc-kol-03',
        stopName: 'Kolkata Airport Gate 1',
        stopSequence: 3,
        arrivalOffsetMinutes: 50,
        departureOffsetMinutes: 50,
        distanceFromOriginKm: 17.5,
        latitude: 22.6547,
        longitude: 88.4467
      }
    ]
  },

  // Bengaluru Route 500-D
  {
    id: 'rt-blr-500d',
    routeNumber: '500-D',
    name: 'Kempegowda Majestic to Electronic City Toll Gate',
    operatorId: 'op-bmtc',
    originPlaceId: 'plc-blr-01',
    originName: 'Kempegowda Bus Station (Majestic)',
    destinationPlaceId: 'plc-blr-02',
    destinationName: 'Electronic City Toll Gate',
    direction: 'up',
    durationMinutes: 60,
    distanceKm: 23.0,
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    status: 'active',
    verificationStatus: 'admin_verified',
    firstDepartureTime: '05:15',
    lastDepartureTime: '23:30',
    frequencyMinutes: 10,
    polyline: [
      [12.9774, 77.5714],
      [12.9400, 77.5950],
      [12.9177, 77.6238], // Silk Board
      [12.8700, 77.6450],
      [12.8452, 77.6602]  // Electronic City
    ],
    stops: [
      {
        routeId: 'rt-blr-500d',
        stopId: 'plc-blr-01',
        stopName: 'Kempegowda Bus Station (Majestic)',
        stopSequence: 1,
        arrivalOffsetMinutes: 0,
        departureOffsetMinutes: 0,
        distanceFromOriginKm: 0.0,
        latitude: 12.9774,
        longitude: 77.5714
      },
      {
        routeId: 'rt-blr-500d',
        stopId: 'plc-blr-03',
        stopName: 'Silk Board Junction',
        stopSequence: 2,
        arrivalOffsetMinutes: 35,
        departureOffsetMinutes: 37,
        distanceFromOriginKm: 13.8,
        latitude: 12.9177,
        longitude: 77.6238
      },
      {
        routeId: 'rt-blr-500d',
        stopId: 'plc-blr-02',
        stopName: 'Electronic City Toll Gate',
        stopSequence: 3,
        arrivalOffsetMinutes: 60,
        departureOffsetMinutes: 60,
        distanceFromOriginKm: 23.0,
        latitude: 12.8452,
        longitude: 77.6602
      }
    ]
  }
];

export const SEED_TIMETABLES: TimetableDeparture[] = [
  // Delhi 502 Departures
  {
    id: 'tt-del-502-01',
    routeId: 'rt-del-502',
    busId: 'bus-dtc-502-01',
    tripCode: 'DTC-502-M1',
    departureTime: '07:30',
    arrivalTime: '08:35',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vehicleType: 'electric',
    fareInRupees: 25,
    isConfirmed: true,
    version: 1,
    lastVerifiedDate: '2026-03-25T10:00:00Z'
  },
  {
    id: 'tt-del-502-02',
    routeId: 'rt-del-502',
    busId: 'bus-dtc-502-01',
    tripCode: 'DTC-502-M2',
    departureTime: '09:00',
    arrivalTime: '10:05',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vehicleType: 'electric',
    fareInRupees: 25,
    isConfirmed: true,
    version: 1,
    lastVerifiedDate: '2026-03-25T10:00:00Z'
  },
  {
    id: 'tt-del-502-03',
    routeId: 'rt-del-502',
    busId: 'bus-dtc-502-01',
    tripCode: 'DTC-502-E1',
    departureTime: '17:15',
    arrivalTime: '18:20',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vehicleType: 'electric',
    fareInRupees: 25,
    isConfirmed: true,
    version: 1,
    lastVerifiedDate: '2026-03-25T10:00:00Z'
  },

  // Mumbai 203 Departures
  {
    id: 'tt-mum-203-01',
    routeId: 'rt-mum-203',
    busId: 'bus-best-203-01',
    tripCode: 'BEST-203-01',
    departureTime: '08:15',
    arrivalTime: '09:30',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vehicleType: 'electric',
    fareInRupees: 20,
    isConfirmed: true,
    version: 1,
    lastVerifiedDate: '2026-03-24T12:00:00Z'
  },
  {
    id: 'tt-mum-203-02',
    routeId: 'rt-mum-203',
    busId: 'bus-best-203-01',
    tripCode: 'BEST-203-02',
    departureTime: '18:00',
    arrivalTime: '19:15',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vehicleType: 'electric',
    fareInRupees: 20,
    isConfirmed: true,
    version: 1,
    lastVerifiedDate: '2026-03-24T12:00:00Z'
  },

  // Kolkata C-8 Departures
  {
    id: 'tt-kol-c8-01',
    routeId: 'rt-kol-c8',
    busId: 'bus-wbtc-c8-01',
    tripCode: 'WBTC-C8-01',
    departureTime: '08:00',
    arrivalTime: '08:50',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vehicleType: 'ac_volvo',
    fareInRupees: 50,
    isConfirmed: true,
    version: 1,
    lastVerifiedDate: '2026-03-22T09:00:00Z'
  },
  {
    id: 'tt-kol-c8-02',
    routeId: 'rt-kol-c8',
    busId: 'bus-wbtc-c8-01',
    tripCode: 'WBTC-C8-02',
    departureTime: '15:30',
    arrivalTime: '16:20',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vehicleType: 'ac_volvo',
    fareInRupees: 50,
    isConfirmed: true,
    version: 1,
    lastVerifiedDate: '2026-03-22T09:00:00Z'
  },

  // Bengaluru 500-D Departures
  {
    id: 'tt-blr-500d-01',
    routeId: 'rt-blr-500d',
    busId: 'bus-bmtc-500d-01',
    tripCode: 'BMTC-500D-01',
    departureTime: '08:30',
    arrivalTime: '09:30',
    operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    vehicleType: 'ac_volvo',
    fareInRupees: 45,
    isConfirmed: true,
    version: 1,
    lastVerifiedDate: '2026-03-25T14:00:00Z'
  }
];

export const SEED_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: 'rule-gps-freshness',
    name: 'GPS Observation Freshness Filter',
    description: 'Reject live GPS classification if timestamp is older than threshold',
    category: 'freshness',
    thresholdValue: 300, // 300 seconds (5 mins)
    isEnabled: true
  },
  {
    id: 'rule-gps-accuracy',
    name: 'Horizontal GPS Accuracy Ceiling',
    description: 'Reject tracking updates with horizontal error radius exceeding meters',
    category: 'tracking',
    thresholdValue: 50, // 50 meters
    isEnabled: true
  },
  {
    id: 'rule-route-proximity',
    name: 'Route Proximity Corridor',
    description: 'Maximum allowable distance from bus route polyline before downgrading confidence',
    category: 'tracking',
    thresholdValue: 350, // 350 meters
    isEnabled: true
  },
  {
    id: 'rule-duplicate-similarity',
    name: 'Submission Duplicate Threshold',
    description: 'Similarity percentage above which community additions trigger duplicate warnings',
    category: 'moderation',
    thresholdValue: 80, // 80%
    isEnabled: true
  },
  {
    id: 'rule-auto-publish-policy',
    name: 'Conservative Auto-Publish Policy',
    description: 'Require administrator review for all public timetable alterations',
    category: 'verification',
    thresholdValue: false, // Do not auto-publish without review
    isEnabled: true
  },
  {
    id: 'rule-corroboration-count',
    name: 'Independent Corroboration Quorum',
    description: 'Minimum unique passenger sessions required to elevate to Community Corroborated',
    category: 'verification',
    thresholdValue: 3,
    isEnabled: true
  }
];
