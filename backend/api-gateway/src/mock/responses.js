'use strict';
/**
 * Pre-scripted mock responses for all 8 demo scenes — Noida/GBN pilot.
 * DLPI IDs: DLPI-UP-DAD-XXXXX (Dadri tehsil, Gautam Buddha Nagar)
 */

const DEMO_DLPI = {
  dlpiId:            'DLPI-UP-DAD-00100',
  khataNo:           '100',
  khasraNo:          '740/100',
  tehsilCode:        'DAD',
  districtCode:      'UP-GBN',
  ownerName:         'Deepak Narayan Singh',
  ownerAadhaarNumber:  'sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a',
  landType:          'Bhumidhari',
  landTypeDesc:      'Hereditary tenant with full rights',
  areaHectares:      2.4,
  encumbranceStatus: 'CLEAR',
  claimStatus:       'VERIFIED',
  transferLocked:    false,
  successionStatus:  null,
  jangananaFlags:    [],
  blockchainTxHash:  '0xfabric-tx-a1b2c3d4e5f6a7b8c9d0e1f2',
  createdAt:         '2024-01-15T09:30:00Z',
  updatedAt:         '2026-05-20T11:00:00Z',
};


// My Parcels mock — returned for any citizen demo login
const DEMO_MY_PARCELS = [
  // 5 Bihar Properties for Priya Kumar (999900010010)
  {
    dlpiId:            'DLPI-Bihar-PHU-00101',
    khataNo:           '401',
    khasraNo:          '101',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Residential',
    landTypeDesc:      'Residential plot',
    areaHectares:      0.15,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    location:          { latitude: 25.5510, longitude: 85.0810 },
    valuation:         { circleRateINR: 4_500_000 },
    txHash:            '0xdemo_bihar1_tx',
    updatedAt:         '2026-05-10T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00102',
    khataNo:           '401',
    khasraNo:          '102',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.22,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    location:          { latitude: 25.5525, longitude: 85.0830 },
    valuation:         { circleRateINR: 2_200_000 },
    txHash:            '0xdemo_bihar2_tx',
    updatedAt:         '2026-06-15T08:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00103',
    khataNo:           '402',
    khasraNo:          '103',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Residential',
    landTypeDesc:      'Residential plot',
    areaHectares:      0.08,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    location:          { latitude: 25.5540, longitude: 85.0850 },
    valuation:         { circleRateINR: 2_400_000 },
    txHash:            '0xdemo_bihar3_tx',
    updatedAt:         '2026-06-01T00:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00104',
    khataNo:           '403',
    khasraNo:          '104',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.34,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    location:          { latitude: 25.5560, longitude: 85.0870 },
    valuation:         { circleRateINR: 3_400_000 },
    txHash:            '0xdemo_bihar4_tx',
    updatedAt:         '2026-04-20T14:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00105',
    khataNo:           '404',
    khasraNo:          '105',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Commercial',
    landTypeDesc:      'Commercial plot',
    areaHectares:      0.11,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    location:          { latitude: 25.5580, longitude: 85.0890 },
    valuation:         { circleRateINR: 5_500_000 },
    txHash:            '0xdemo_bihar5_tx',
    updatedAt:         '2026-06-20T09:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00109',
    khataNo:           '405',
    khasraNo:          '109',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      1.5,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    owners: [
      { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
      { name: 'Rakesh Agarwal', aadhaarNumber: '999900010011' }
    ],
    ownershipType:     'JOINT',
    location:          { latitude: 25.5600, longitude: 85.0900 },
    valuation:         { circleRateINR: 6_000_000 },
    txHash:            '0xdemo_bihar9_tx',
    updatedAt:         '2026-07-22T10:00:00Z',
  },

  // 3 Bihar Properties for Rakesh Agarwal (999900010011)
  {
    dlpiId:            'DLPI-Bihar-PHU-00106',
    khataNo:           '501',
    khasraNo:          '106',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.45,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Rakesh Agarwal', aadhaarNumber: '999900010011' },
    location:          { latitude: 25.5600, longitude: 85.0910 },
    valuation:         { circleRateINR: 1_850_000 },
    txHash:            '0xdemo_bihar6_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00107',
    khataNo:           '501',
    khasraNo:          '107',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Residential',
    landTypeDesc:      'Residential plot',
    areaHectares:      0.19,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Rakesh Agarwal', aadhaarNumber: '999900010011' },
    location:          { latitude: 25.5615, longitude: 85.0930 },
    valuation:         { circleRateINR: 950_000 },
    txHash:            '0xdemo_bihar7_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00108',
    khataNo:           '502',
    khasraNo:          '108',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.27,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Rakesh Agarwal', aadhaarNumber: '999900010011' },
    location:          { latitude: 25.5630, longitude: 85.0950 },
    valuation:         { circleRateINR: 1_250_000 },
    txHash:            '0xdemo_bihar8_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },

  // 3 Bihar Properties for Suresh Yadav (999900010012)
  {
    dlpiId:            'DLPI-Bihar-PHU-00109',
    khataNo:           '601',
    khasraNo:          '109',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.85,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Suresh Yadav', aadhaarNumber: '999900010012' },
    location:          { latitude: 25.5645, longitude: 85.0970 },
    valuation:         { circleRateINR: 4_250_000 },
    txHash:            '0xdemo_bihar9_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00110',
    khataNo:           '602',
    khasraNo:          '110',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Residential',
    landTypeDesc:      'Residential plot',
    areaHectares:      0.52,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Suresh Yadav', aadhaarNumber: '999900010012' },
    location:          { latitude: 25.5660, longitude: 85.0990 },
    valuation:         { circleRateINR: 2_600_000 },
    txHash:            '0xdemo_bihar10_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00111',
    khataNo:           '602',
    khasraNo:          '111',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.33,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Suresh Yadav', aadhaarNumber: '999900010012' },
    location:          { latitude: 25.5480, longitude: 85.0780 },
    valuation:         { circleRateINR: 1_650_000 },
    txHash:            '0xdemo_bihar11_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },

  // 2 Bihar Properties for Meena Devi (999900010013)
  {
    dlpiId:            'DLPI-Bihar-PHU-00112',
    khataNo:           '701',
    khasraNo:          '112',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Residential',
    landTypeDesc:      'Residential plot',
    areaHectares:      0.16,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Meena Devi', aadhaarNumber: '999900010013' },
    location:          { latitude: 25.5460, longitude: 85.0760 },
    valuation:         { circleRateINR: 800_000 },
    txHash:            '0xdemo_bihar12_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00113',
    khataNo:           '701',
    khasraNo:          '113',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.64,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Meena Devi', aadhaarNumber: '999900010013' },
    location:          { latitude: 25.5440, longitude: 85.0740 },
    valuation:         { circleRateINR: 3_200_000 },
    txHash:            '0xdemo_bihar13_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },

  // 2 Bihar Properties for Arun Kumar (999900010014)
  {
    dlpiId:            'DLPI-Bihar-PHU-00114',
    khataNo:           '801',
    khasraNo:          '114',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.41,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Arun Kumar', aadhaarNumber: '999900010014' },
    location:          { latitude: 25.5420, longitude: 85.0720 },
    valuation:         { circleRateINR: 2_050_000 },
    txHash:            '0xdemo_bihar14_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00115',
    khataNo:           '802',
    khasraNo:          '115',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Residential',
    landTypeDesc:      'Residential plot',
    areaHectares:      0.28,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Arun Kumar', aadhaarNumber: '999900010014' },
    location:          { latitude: 25.5400, longitude: 85.0700 },
    valuation:         { circleRateINR: 1_400_000 },
    txHash:            '0xdemo_bihar15_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },

  // 2 Bihar Government Properties
  {
    dlpiId:            'DLPI-Bihar-PHU-00116',
    khataNo:           '1001',
    khasraNo:          '116',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Government Land',
    landTypeDesc:      'Public land',
    areaHectares:      1.20,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Government of Bihar', aadhaarNumber: 'govt-land' },
    location:          { latitude: 25.5380, longitude: 85.0680 },
    valuation:         { circleRateINR: 6_000_000 },
    txHash:            '0xdemo_bihar16_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00117',
    khataNo:           '1001',
    khasraNo:          '117',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Government Land',
    landTypeDesc:      'Public land',
    areaHectares:      2.45,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Government of Bihar', aadhaarNumber: 'govt-land' },
    location:          { latitude: 25.5360, longitude: 85.0660 },
    valuation:         { circleRateINR: 12_250_000 },
    txHash:            '0xdemo_bihar17_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },

  // 3 Bihar Properties for dummy/unknown Aadhaar numbers
  {
    dlpiId:            'DLPI-Bihar-PHU-00118',
    khataNo:           '1002',
    khasraNo:          '118',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural plot',
    areaHectares:      0.95,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Deepak Narayan Singh', aadhaarNumber: '999900019999' },
    location:          { latitude: 25.5340, longitude: 85.0640 },
    valuation:         { circleRateINR: 4_750_000 },
    txHash:            '0xdemo_bihar18_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00119',
    khataNo:           '1003',
    khasraNo:          '119',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Residential',
    landTypeDesc:      'Residential plot',
    areaHectares:      0.77,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Amit Kumar', aadhaarNumber: '999900019999' },
    location:          { latitude: 25.5320, longitude: 85.0620 },
    valuation:         { circleRateINR: 3_850_000 },
    txHash:            '0xdemo_bihar19_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-Bihar-PHU-00120',
    khataNo:           '1004',
    khasraNo:          '120',
    tehsil:            'Phulwari Sharif',
    tehsilCode:        'PHU',
    district:          'Patna',
    state:             'Bihar',
    landType:          'Agricultural',
    landTypeDesc:      'Agricultural land',
    areaHectares:      0.48,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Vikram Singh', aadhaarNumber: '999900019999' },
    location:          { latitude: 25.5300, longitude: 85.0600 },
    valuation:         { circleRateINR: 2_400_000 },
    txHash:            '0xdemo_bihar20_tx',
    updatedAt:         '2026-07-29T10:00:00Z',
  },

  // Original Dadri, UP default properties (with explicit owner.aadhaarNumber bound!)
  {
    dlpiId:            'DLPI-UP-DAD-00001',
    khataNo:           '101',
    khasraNo:          '1842/101',
    tehsil:            'Dadri',
    tehsilCode:        'DAD',
    district:          'Gautam Buddha Nagar',
    state:             'Uttar Pradesh',
    landType:          'Residential',
    landTypeDesc:      'Residential plot / abadi',
    areaHectares:      0.025,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'VERIFIED',
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    location:          { latitude: 28.5706, longitude: 77.5413 },
    valuation:         { circleRateINR: 3_750_000 },
    txHash:            '0xdemo_priya1_tx',
    updatedAt:         '2026-05-10T10:00:00Z',
  },
  {
    dlpiId:            'DLPI-UP-DAD-00002',
    khataNo:           '102',
    khasraNo:          '1200/102',
    tehsil:            'Dadri',
    tehsilCode:        'DAD',
    district:          'Gautam Buddha Nagar',
    state:             'Uttar Pradesh',
    landType:          'Bhumidhari',
    landTypeDesc:      'Hereditary tenant with full rights',
    areaHectares:      1.2,
    encumbranceStatus: 'MORTGAGED',
    claimStatus:       'UNDER_REVIEW',
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    location:          { latitude: 28.5480, longitude: 77.5620 },
    valuation:         { circleRateINR: 1_440_000 },
    txHash:            '0xdemo_priya2_tx',
    updatedAt:         '2026-06-15T08:00:00Z',
  },
  {
    dlpiId:            'DLPI-UP-DAD-00003',
    khataNo:           '201',
    khasraNo:          '740/201',
    tehsil:            'Dadri',
    tehsilCode:        'DAD',
    district:          'Gautam Buddha Nagar',
    state:             'Uttar Pradesh',
    landType:          'Bhumidhari',
    landTypeDesc:      'Hereditary tenant with full rights',
    areaHectares:      2.4,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'SEEDED_UNVERIFIED',
    owner:             { name: 'Rakesh Agarwal', aadhaarNumber: '999900010011' },
    location:          { latitude: 28.6010, longitude: 77.4850 },
    valuation:         { circleRateINR: 2_880_000 },
    txHash:            '0xdemo_arun_tx',
    updatedAt:         '2026-06-01T00:00:00Z',
  },
  {
    dlpiId:            'DLPI-UP-DAD-00004',
    khataNo:           '301',
    khasraNo:          '999/301',
    tehsil:            'Dadri',
    tehsilCode:        'DAD',
    district:          'Gautam Buddha Nagar',
    state:             'Uttar Pradesh',
    landType:          'Residential',
    landTypeDesc:      'Residential plot / abadi',
    areaHectares:      0.04,
    encumbranceStatus: 'COURT_INJUNCTION',
    claimStatus:       'DISPUTED',
    disputeNote:       'Boundary encroachment alleged by adjacent plot owner. Civil suit filed in Dadri court (CS/2025/0441).',
    owner:             { name: 'Suresh Yadav', aadhaarNumber: '999900010012' },
    location:          { latitude: 28.5280, longitude: 77.6100 },
    valuation:         { circleRateINR: 4_800_000 },
    txHash:            '0xdemo_suresh_tx',
    updatedAt:         '2026-04-20T14:00:00Z',
  },
  {
    dlpiId:            'DLPI-UP-DAD-00005',
    khataNo:           '401',
    khasraNo:          '380/401',
    tehsil:            'Dadri',
    tehsilCode:        'DAD',
    district:          'Gautam Buddha Nagar',
    state:             'Uttar Pradesh',
    landType:          'Sirdar',
    landTypeDesc:      'Hereditary tenant with limited rights',
    areaHectares:      0.8,
    encumbranceStatus: 'CLEAR',
    claimStatus:       'CLAIM_SUBMITTED',
    owner:             { name: 'Meena Devi', aadhaarNumber: '999900010013' },
    location:          { latitude: 28.5900, longitude: 77.4700 },
    valuation:         { circleRateINR: 720_000 },
    txHash:            '0xdemo_meena_tx',
    updatedAt:         '2026-06-20T09:00:00Z',
  }
];

// Pending review mock — for officer dashboards
const DEMO_PENDING_REVIEW = [
  {
    dlpiId:           'DLPI-UP-DAD-00002',
    khataNo:          '102',
    khasraNo:         '1200/102',
    gram:             'Gharbara',
    tehsil:           'Dadri',
    district:         'Gautam Buddha Nagar',
    ownerName:        'Priya Kumar',
    landType:         'Bhumidhari',
    areaHectares:     1.2,
    encumbranceStatus:'CLEAR',
    claimStatus:      'UNDER_REVIEW',
    submittedAt:      '2026-06-15T08:00:00Z',
    claimedAt:        '2026-06-14T10:00:00Z',
    eSignTxHash:      '0xesign-priya-a1b2c3',
    patwariName:      'Ramesh Yadav',
    scanId:           null,
    priority:         'URGENT',
    isCoparcenary:    false,
    officerNotes:     '',
    verificationChecklist: {
      physicalInspection: false,
      documentVerified:   false,
      boundaryConfirmed:  false,
      encumbranceClear:   true,
    },
  },
  {
    dlpiId:           'DLPI-UP-DAD-00005',
    khataNo:          '401',
    khasraNo:         '380/401',
    gram:             'Sadarpur',
    tehsil:           'Dadri',
    district:         'Gautam Buddha Nagar',
    ownerName:        'Meena Devi',
    landType:         'Sirdar',
    areaHectares:     0.8,
    encumbranceStatus:'CLEAR',
    claimStatus:      'CLAIM_SUBMITTED',
    submittedAt:      '2026-06-20T09:00:00Z',
    claimedAt:        '2026-06-20T09:00:00Z',
    eSignTxHash:      '0xesign-meena-d4e5f6',
    patwariName:      'Ramesh Yadav',
    scanId:           null,
    priority:         'NORMAL',
    isCoparcenary:    false,
    officerNotes:     '',
    verificationChecklist: {
      physicalInspection: false,
      documentVerified:   false,
      boundaryConfirmed:  false,
      encumbranceClear:   true,
    },
  },
  {
    dlpiId:           'DLPI-UP-DAD-00042',
    khataNo:          '220',
    khasraNo:         '518/220',
    gram:             'Ranhera',
    tehsil:           'Dadri',
    district:         'Gautam Buddha Nagar',
    ownerName:        'Vinod Prasad',
    landType:         'Bhumidhari',
    areaHectares:     1.6,
    encumbranceStatus:'MORTGAGED',
    claimStatus:      'UNDER_REVIEW',
    submittedAt:      '2026-06-18T11:30:00Z',
    claimedAt:        '2026-06-17T15:00:00Z',
    eSignTxHash:      '0xesign-vinod-g7h8i9',
    patwariName:      'Ramesh Yadav',
    scanId:           'SCN-A1B2C3D4',
    priority:         'NORMAL',
    isCoparcenary:    false,
    officerNotes:     'Partial boundary dispute with neighbouring plot reported by villagers.',
    verificationChecklist: {
      physicalInspection: true,
      documentVerified:   true,
      boundaryConfirmed:  false,
      encumbranceClear:   false,
    },
  },
  {
    dlpiId:           'DLPI-UP-DAD-00087',
    khataNo:          '315',
    khasraNo:         '234/315',
    gram:             'Tilpata',
    tehsil:           'Dadri',
    district:         'Gautam Buddha Nagar',
    ownerName:        'Savita Tiwari',
    landType:         'Residential',
    areaHectares:     0.03,
    encumbranceStatus:'CLEAR',
    claimStatus:      'CI_APPROVED',
    submittedAt:      '2026-06-12T16:00:00Z',
    claimedAt:        '2026-06-11T09:00:00Z',
    eSignTxHash:      '0xesign-savita-j1k2l3',
    patwariName:      'Ramesh Yadav',
    scanId:           'SCN-E5F6G7H8',
    priority:         'NORMAL',
    isCoparcenary:    false,
    officerNotes:     'All documents verified. Plot within residential zone per Dadri master plan.',
    verificationChecklist: {
      physicalInspection: true,
      documentVerified:   true,
      boundaryConfirmed:  true,
      encumbranceClear:   true,
    },
  },
  {
    dlpiId:           'DLPI-UP-DAD-00020',
    khataNo:          '520',
    khasraNo:         '891/520',
    gram:             'Bisrakh',
    tehsil:           'Dadri',
    district:         'Gautam Buddha Nagar',
    ownerName:        'Ramkali Gond',
    areaHectares:     0.6,
    encumbranceStatus:'CLEAR',
    claimStatus:      'CLAIM_SUBMITTED',
    submittedAt:      '2026-06-22T14:00:00Z',
    claimedAt:        '2026-06-22T14:00:00Z',
    eSignTxHash:      '0xesign-ramkali-m4n5o6',
    patwariName:      'Ramesh Yadav',
    scanId:           null,
    priority:         'URGENT',
    isCoparcenary:    false,
    officerNotes:     'FRA claim — TribalGuard block active. Transfer restricted per Schedule V.',
    verificationChecklist: {
      physicalInspection: false,
      documentVerified:   false,
      boundaryConfirmed:  false,
      encumbranceClear:   true,
    },
  },
];

const DEMO_SUCCESSION_CASE = {
  caseId:          'SUC-DLPI-UP-DAD-00100-a1b2c3d4',
  dlpiId:          'DLPI-UP-DAD-00100',
  familyId:        'FAM-UP-DAD-00100-001',
  deceasedName:    'Deepak Narayan Singh',
  dateOfDeath:     '2026-05-20',
  deathCertCID:    'QmDeathCertDeepaK2026',
  crsRegistrationNo: 'CRS-GBN-2026-00541',
  applicableLaw:   'Hindu Succession Act 1956/2005',
  coparcenaryType: 'Mitakshara',
  heirs: [
    {
      heirId:       'HEIR-001',
      name:         'Ankur Singh',
      aadhaarNumber:  'sha256:heir1ankur3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8',
      relation:     'Son',
      gender:       'Male',
      dob:          '1988-03-15',
      isAlive:      true,
      isAdult:      true,
      isNri:        false,
      share:        '1/3',
      shareDecimal: 0.3333,
      legalNote:    null,
      hasConsented: false,
      hasObjected:  false,
    },
    {
      heirId:       'HEIR-002',
      name:         'Nitin Singh',
      aadhaarNumber:  'sha256:heir2nitin8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7',
      relation:     'Son',
      gender:       'Male',
      dob:          '1991-07-22',
      isAlive:      true,
      isAdult:      true,
      isNri:        false,
      share:        '1/3',
      shareDecimal: 0.3333,
      legalNote:    null,
      hasConsented: false,
      hasObjected:  false,
    },
    {
      heirId:       'HEIR-003',
      name:         'Neeta Singh',
      aadhaarNumber:  'sha256:heir3neeta1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5',
      relation:     'Daughter',
      gender:       'Female',
      dob:          '1994-11-08',
      isAlive:      true,
      isAdult:      true,
      isNri:        false,
      share:        '1/3',
      shareDecimal: 0.3334,
      legalNote:    'Equal coparcenary rights per Hindu Succession (Amendment) Act 2005 Section 6(3). Daughters have same rights as sons by birth.',
      hasConsented: false,
      hasObjected:  false,
    },
  ],
  totalHeirs:          3,
  status:              'AWAITING_CONSENTS',
  consentDeadline:     '2026-07-10T09:30:00Z',
  aiComputationCID:    'QmCoparcenaryMapperOutputDeepaK',
  aiConfidenceScore:   0.97,
  legalEdgeCases:      [],
  initiatedAt:         '2026-06-10T09:30:00Z',
  updatedAt:           '2026-06-10T09:30:00Z',
};

const DEMO_TRANSFER = {
  transferId:          'TXF-DLPI-UP-DAD-00100-b2c3d4e5',
  dlpiId:              'DLPI-UP-DAD-00100',
  sellerAadhaarNumber:   'sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a',
  buyerName:           'Rakesh Agarwal',
  buyerAadhaarNumber:    'sha256:buyer1rakesh9d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0',
  declaredValueINR:    4_800_000,
  oracleValueINR:      5_200_000,
  stampDutyINR:        208_000,
  status:              'AWAITING_CONSENT',
  fraudScore:          0.12,
  fraudSignals:        [],
  nationalLockAcquired:true,
  lockExpiry:          '2026-06-11T09:30:00Z',
  consentSeller:       false,
  consentBuyer:        false,
  initiatedAt:         '2026-06-10T09:00:00Z',
};


const DEMO_MUTATION = {
  mutationId:              'MUT-DLPI-UP-DAD-00100-d4e5f6a7',
  dlpiId:                  'DLPI-UP-DAD-00100',
  mutationType:            'Virasat (Inheritance)',
  mutationTypeCode:        'Inheritance',
  officerName:             'Ramesh Yadav',
  officerRank:             'Patwari',
  officerHash:             'sha256:officer1ramesh3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a',
  currentOwnerName:        'Deepak Narayan Singh',
  currentOwnerAadhaarNumber: 'sha256:owner1deepak3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9',
  newOwnerName:            'Ankur Singh',
  newOwnerAadhaarNumber:     'sha256:heir1ankur3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8',
  reason:                  'Death of Deepak Narayan Singh (CRS Reg: CRS-GBN-2026-00541). Son Ankur Singh is primary legal heir under Hindu Succession Act 1956.',
  supportingCID:           'QmDeathCertDeepaK2026Khatauni',
  courtOrderNo:            null,
  status:                  'ALERT_SENT',
  alertSentAt:             '2026-06-10T09:31:04Z',
  alertElapsedSeconds:     64,
  slaMet:                  true,
  requiresPublicNotice:    true,
  publicNoticePeriodDays:  30,
  objectionDeadline:       '2026-07-10T09:30:00Z',
  ownerConsentAt:          null,
  ownerObjectionAt:        null,
  objectionReason:         null,
  executedAt:              null,
  executedTxHash:          null,
  initiatedAt:             '2026-06-10T09:30:00Z',
  telegramAlerts: [
    {
      channel:    'TELEGRAM',
      recipient:  'Deepak Narayan Singh (family)',
      chatId:     '@bhumichain_alerts',
      message:    '⚠️ BhumiChain Alert: Virasat mutation initiated on DLPI-UP-DAD-00100 (Deepak Narayan Singh, Dadri). New claimant: Ankur Singh. Object by 10-Jul-2026. Reply OBJECT to this message or visit bhumi.up.gov.in.',
      sentAt:     '2026-06-10T09:31:04Z',
      delivered:  true,
    },
    {
      channel:    'TELEGRAM',
      recipient:  'Patwari Ramesh Yadav',
      chatId:     '@bhumichain_officers',
      message:    '✅ Mutation MUT-DLPI-UP-DAD-00100-d4e5f6a7 initiated. Alert delivered in 64s (SLA: 60s met). Objection window: 30 days.',
      sentAt:     '2026-06-10T09:31:05Z',
      delivered:  true,
    },
    {
      channel:    'TELEGRAM',
      recipient:  'Neighbour: Rakesh Agarwal (DLPI-UP-DAD-00003)',
      chatId:     '@bhumichain_alerts',
      message:    '📢 Public Notice: Land mutation on adjacent parcel DLPI-UP-DAD-00100 in Gharbara, Dadri. View: bhumi.up.gov.in/mutation/MUT-DLPI-UP-DAD-00100-d4e5f6a7',
      sentAt:     '2026-06-10T09:31:06Z',
      delivered:  true,
    },
  ],
  timeline: [
    { step: 'INITIATED',      label: 'Mutation Initiated',    actor: 'Ramesh Yadav (Patwari)',     at: '2026-06-10T09:30:00Z', done: true },
    { step: 'ALERT_SENT',     label: 'Owner + Neighbours Alerted', actor: 'BhumiChain (Telegram)', at: '2026-06-10T09:31:04Z', done: true },
    { step: 'CONSENT',        label: 'Owner Consent / Objection',  actor: 'Pending',               at: null,                   done: false },
    { step: 'EXECUTED',       label: 'Mutation Executed',     actor: 'Pending',                    at: null,                   done: false },
  ],
};

const DEMO_MUTATION_LIST = [
  DEMO_MUTATION,
  {
    mutationId:              'MUT-DLPI-UP-DAD-00042-e5f6a7b8',
    dlpiId:                  'DLPI-UP-DAD-00042',
    mutationType:            'Bikri (Sale)',
    mutationTypeCode:        'Sale',
    officerName:             'Ramesh Yadav',
    officerRank:             'Patwari',
    currentOwnerName:        'Vinod Prasad',
    newOwnerName:            'Suresh Mehta',
    reason:                  'Registered sale deed No. GBN-SD-2026-14821. Buyer: Suresh Mehta s/o Mahesh Mehta.',
    supportingCID:           'QmSaleDeedVinod2026',
    status:                  'CONSENT_GIVEN',
    alertSentAt:             '2026-06-18T10:00:00Z',
    alertElapsedSeconds:     42,
    slaMet:                  true,
    requiresPublicNotice:    false,
    publicNoticePeriodDays:  15,
    objectionDeadline:       '2026-07-03T10:00:00Z',
    ownerConsentAt:          '2026-06-19T08:30:00Z',
    ownerObjectionAt:        null,
    objectionReason:         null,
    executedAt:              null,
    executedTxHash:          null,
    initiatedAt:             '2026-06-18T09:58:00Z',
    telegramAlerts: [
      {
        channel: 'TELEGRAM', recipient: 'Vinod Prasad', delivered: true,
        message: '✅ BhumiChain: Sale mutation on DLPI-UP-DAD-00042 — Your eSign consent recorded. Mutation pending execution.',
        sentAt: '2026-06-19T08:30:02Z',
      },
    ],
    timeline: [
      { step: 'INITIATED',  label: 'Mutation Initiated',    at: '2026-06-18T09:58:00Z', done: true },
      { step: 'ALERT_SENT', label: 'Owner Alerted',         at: '2026-06-18T10:00:00Z', done: true },
      { step: 'CONSENT',    label: 'Consent Given',         at: '2026-06-19T08:30:00Z', done: true },
      { step: 'EXECUTED',   label: 'Awaiting Execution',    at: null,                   done: false },
    ],
  },
];

const DEMO_AUCTION_ACTIVE = {
  auctionId:        'AUC-DLPI-UP-DAD-00088-f1a2b3c4',
  dlpiId:           'DLPI-UP-DAD-00088',
  auctionType:      'COURT_ORDERED',
  title:            'Khasra 312/2A — Dadri Tehsil',
  description:      'Court-ordered sale pursuant to SBI loan foreclosure. Khasra 312/2A, village Dankaur, Dadri tehsil. Bhumidhari title.',
  ownerName:        'Rajan Mishra',
  khasraNo:         '312/2A',
  areaHectares:     0.25,
  landType:         'Bhumidhari',
  reservePrice:     2_500_000,
  currentBid:       2_750_000,
  totalBids:        4,
  auctionEnd:       new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
  status:           'ACTIVE',
  authorizedBy:     'Civil Judge (Sr. Div.), Gautam Buddha Nagar — Order No. CS/2025/0471',
  caseRef:          'CS No. 2025/0471, GBN Civil Court',
  encumbranceSince: '2024-03-15',
  encumbranceType:  'MORTGAGE',
  lender:           'State Bank of India, Dadri Branch',
  loanAmountINR:    2_200_000,
  cersaiRegNo:      'CERSAI-UP-DAD-2024-00781',
  isAntiCollude:    true,
};

const DEMO_AUCTION_UPCOMING = {
  auctionId:        'AUC-DLPI-UP-DAD-00115-g2b3c4d5',
  dlpiId:           'DLPI-UP-DAD-00115',
  auctionType:      'GOVT_DISPOSAL',
  title:            'Govt. Reserved — Plot 7, Sector 12, Dadri',
  description:      'UP Government disposal of surplus agricultural land. Khasra 598, village Jewar, Dadri tehsil.',
  ownerName:        'Government of Uttar Pradesh',
  khasraNo:         '598',
  areaHectares:     2.10,
  landType:         'Govt_Reserved',
  reservePrice:     8_500_000,
  currentBid:       null,
  totalBids:        0,
  auctionEnd:       new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
  status:           'UPCOMING',
  authorizedBy:     'District Collector, Gautam Buddha Nagar — Order DM/2026/0234',
  caseRef:          'DM Order 2026/0234',
  encumbranceSince: null,
  encumbranceType:  null,
  lender:           null,
  loanAmountINR:    null,
  cersaiRegNo:      null,
  isAntiCollude:    true,
};

const DEMO_EC = {
  ecId:              'EC-DLPI-UP-DAD-00100-e5f6a7b8',
  dlpiId:            'DLPI-UP-DAD-00100',
  ownerName:         'Deepak Narayan Singh',
  reportPeriodFrom:  '2010-01-01',
  reportPeriodTo:    '2026-06-10',
  encumbrances:      [],
  summary:           'CLEAR — No active encumbrances, mortgages, injunctions, or attachments on this parcel.',
  qrVerificationHash:'ec-qr-sha256:f7e8d9c0b1a2f3e4d5c6b7a8',
  validUntil:        '2026-06-11T09:45:00Z',
  generatedAt:       '2026-06-10T09:45:00Z',
  generationTimeMs:  18400,
};

const DEMO_WS_EVENTS = {
  scene2_dlpi_created: {
    event: 'DLPICreated',
    payload: {
      dlpiId:    'DLPI-UP-DAD-00100',
      ownerName: 'Deepak Narayan Singh',
      txHash:    '0xfabric-tx-a1b2c3d4e5f6',
      message:   'Land parcel DLPI-UP-DAD-00100 recorded on BhumiChain',
    },
  },
  scene3_death_detected: {
    event: 'HeirNotificationRequired',
    payload: {
      caseId:      'SUC-DLPI-UP-DAD-00100-a1b2c3d4',
      dlpiId:      'DLPI-UP-DAD-00100',
      deceasedName:'Deepak Narayan Singh',
      heirs:       DEMO_SUCCESSION_CASE.heirs,
      applicableLaw:'Hindu Succession Act 1956/2005',
      message:     'Death certificate verified. 3 heirs identified. Notifications dispatched via SMS & WhatsApp.',
    },
  },
  scene3_mutation_alert: {
    event: 'MutationAlert',
    payload: {
      mutationId:              'MUT-DLPI-UP-DAD-00100-d4e5f6a7',
      dlpiId:                  'DLPI-UP-DAD-00100',
      alertSentWithinSeconds:  64,
      slaMet:                  true,
      message:                 '⚠️ Mutation initiated on your land parcel. You have 30 days to raise objection.',
    },
  },
  scene4_transfer_initiated: {
    event: 'TransferInitiated',
    payload: {
      transferId:           'TXF-DLPI-UP-DAD-00100-b2c3d4e5',
      dlpiId:               'DLPI-UP-DAD-00100',
      nationalLockAcquired: true,
      message:              'National parcel lock acquired. Transfer initiated. Awaiting multi-party consent.',
    },
  },
  scene5_dual_sale_rejected: {
    event: 'TransferRejected',
    payload: {
      dlpiId:       'DLPI-UP-DAD-00100',
      reason:       'NATIONAL_LOCK_ACTIVE',
      message:      '🚫 REJECTED — Parcel DLPI-UP-DAD-00100 is under national transfer lock since 09:00 today. This is a DUPLICATE SALE attempt.',
      fraudScore:   0.94,
      autoRejected: true,
    },
  },
  scene7_bhumi_gpt: {
    event: 'BhumiGPTResponse',
    payload: {
      query:      'क्या मेरी जमीन पर मेरी बेटी का अधिकार है?',
      response:   'हाँ। हिंदू उत्तराधिकार (संशोधन) अधिनियम 2005 की धारा 6(3) के अनुसार, पुत्री जन्म से ही मिताक्षरा सहदायिकी संपत्ति में सहदायिक है। उसका अधिकार पुत्र के समान है।',
      language:   'hi',
      confidence: 0.98,
    },
  },
};

let MOCK_SCANS = [];
let MOCK_SUCCESSION_CASES = [];

module.exports = {
  DEMO_DLPI,
  DEMO_MY_PARCELS,
  DEMO_PENDING_REVIEW,
  DEMO_SUCCESSION_CASE,
  DEMO_TRANSFER,
  DEMO_MUTATION,
  DEMO_MUTATION_LIST,
  DEMO_EC,
  DEMO_AUCTION_ACTIVE,
  DEMO_AUCTION_UPCOMING,
  DEMO_WS_EVENTS,

  getMockResponse(chaincode, fn, args = []) {
    const key = `${chaincode}::${fn}`;
    switch (key) {

      // ── DLPI reads ──────────────────────────────────────────────────────────
      case 'dlpi::GetParcelsByAadhaar': {
        const hash = args[0];
        const rawAadhaar = (args[1] || '').replace(/\D/g, '');
        
        // Dynamic search in DEMO_MY_PARCELS by owner's Aadhaar
        const matchingParcels = DEMO_MY_PARCELS.filter(p => {
          const oH = (p.owner?.aadhaarNumber || '').replace(/\D/g, '');
          return oH && (oH === rawAadhaar || oH === hash);
        });

        // Determine owner name
        let ownerName = 'Unknown Owner';
        if (matchingParcels.length > 0) {
          ownerName = matchingParcels[0].owner?.name || matchingParcels[0].ownerName || ownerName;
        } else {
          const fallbackMap = {
            '999900010010': 'Priya Kumar',
            '999900010011': 'Rakesh Agarwal',
            '999900010012': 'Suresh Yadav',
            '999900010013': 'Meena Devi',
            '999900010014': 'Arun Kumar',
            '999900010015': 'Sunita Kumar',
          };
          ownerName = fallbackMap[rawAadhaar] || ownerName;
        }

        return { ownerName, parcels: matchingParcels };
      }

      case 'dlpi::GetDLPI': {
        if (args[0] === 'DLPI-UP-DAD-00006') return DEMO_TRIBAL_DLPI;
        const p = DEMO_PENDING_REVIEW.find(x => x.dlpiId === args[0]) || DEMO_MY_PARCELS.find(x => x.dlpiId === args[0]);
        if (p) {
          return {
            ...p,
            ownerAadhaarHash: p.ownerAadhaarHash || 'sha256:default-owner-hash',
            ownerName: p.ownerName || p.owner?.name || 'Unknown Owner'
          };
        }
        return DEMO_DLPI;
      }

      case 'dlpi::GetDLPIHistory':
        return [
          { txId: '0xfabric-tx-000001', timestamp: '2024-01-15T09:30:00Z', action: 'DLPI_CREATED',        actor: 'Revenue Dept (Vijay Singh, Patwari)' },
          { txId: '0xfabric-tx-000002', timestamp: '2025-03-10T11:20:00Z', action: 'ENCUMBRANCE_ADDED',    actor: 'SBI Noida Branch' },
          { txId: '0xfabric-tx-000003', timestamp: '2025-09-01T14:00:00Z', action: 'ENCUMBRANCE_RELEASED', actor: 'SBI Noida Branch' },
        ];

      case 'dlpi::GetAllParcels': {
        return DEMO_MY_PARCELS;
      }

      case 'dlpi::QueryDLPIsByOwner':
      case 'dlpi::GetMyParcels': {
        const fs = require('fs');
        const ownerHash = args[0] || '';
        const userRaw   = args[1] || '';
        const userName  = (args[2] || '').toLowerCase();
        
        let dynamicScans = [...MOCK_SCANS];
        // Read executed mock cases to persist property mutations across restarts
        try {
          const cases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json'));
          cases.filter(c => c.status === 'EXECUTED' || c.status === 'AUTO_MUTATED' || c.status === 'COMPLETED' || c.status === 'TEHSILDAR_APPROVED').forEach(sc => {
            if (sc && sc.heirs) {
              if (!dynamicScans.find(s => s.dlpiId === sc.dlpiId)) {
                 const parcel = JSON.parse(JSON.stringify(DEMO_DLPI));
                 parcel.dlpiId = sc.dlpiId;
                 parcel.initialOwners = sc.heirs.map(h => ({
                   name: h.name,
                   aadhaarNumber: h.aadhaarNumber || h.aadhaar || '',
                   aadhaar: h.aadhaar || h.aadhaarNumber || '',
                   share: h.share || h.finalShare || `1/${sc.heirs.length}`,
                   shareDecimal: h.shareDecimal || h.finalShareDec || (1.0 / sc.heirs.length)
                 }));
                 parcel.claimStatus = 'VERIFIED';
                 dynamicScans.push(parcel);
              } else {
                 const existing = dynamicScans.find(s => s.dlpiId === sc.dlpiId);
                 if (existing) {
                   existing.initialOwners = sc.heirs.map(h => ({
                     name: h.name,
                     aadhaarNumber: h.aadhaarNumber || h.aadhaar || '',
                     aadhaar: h.aadhaar || h.aadhaarNumber || '',
                     share: h.share || h.finalShare || `1/${sc.heirs.length}`,
                     shareDecimal: h.shareDecimal || h.finalShareDec || (1.0 / sc.heirs.length)
                   }));
                 }
              }
            }
          });
        } catch(e) {}

        // Filter dynamicScans to include parcels where this citizen is an owner
        const myScans = dynamicScans.filter(s => {
          const ownersList = s.initialOwners || s.owners || [];
          if (!Array.isArray(ownersList) || ownersList.length === 0) return false;
          return ownersList.some(o => {
            const oHash = o.aadhaarNumber || '';
            const oRaw  = o.aadhaar || '';
            const oName = (o.name || '').toLowerCase();
            if (oHash && (oHash === ownerHash || oHash === userRaw)) return true;
            if (oRaw && (oRaw === ownerHash || oRaw === userRaw)) return true;
            if (userName && oName && oName.length > 2 && (oName.includes(userName) || userName.includes(oName))) return true;
            if (userRaw === '999900010010' && oName.includes('priya')) return true;
            if (userRaw === '999900010015' && oName.includes('sunita')) return true;
            if (userRaw === '999900010012' && oName.includes('suresh')) return true;
            if (ownerHash === '999900010012' && oName.includes('suresh')) return true;
            return false;
          });
        });
        // Check if atomic clear history was triggered
        let isCleared = false;
        try { if (fs.existsSync('/tmp/bhumichain_history_cleared.json')) isCleared = true; } catch(e) {}
        let seededParcels = [];
        try { seededParcels = JSON.parse(fs.readFileSync('/tmp/bhumichain_seeded_parcels.json', 'utf8')); } catch(e) {}
        
        let atomicClaims = {};
        try { atomicClaims = JSON.parse(fs.readFileSync('/tmp/bhumichain_atomic_claims.json', 'utf8')); } catch(e) {}

        const mySeeded = Array.isArray(seededParcels) ? seededParcels.filter(p => {
          if (atomicClaims[p.dlpiId]) {
            const claim = atomicClaims[p.dlpiId];
            if (claim.heirs && Array.isArray(claim.heirs)) {
              return claim.heirs.some(h => (h.aadhaarNumber && (h.aadhaarNumber === ownerHash || h.aadhaarNumber === userRaw)) || (h.aadhaar && (h.aadhaar === ownerHash || h.aadhaar === userRaw)) || ((h.name || '').toLowerCase().includes(userName) && userName.length > 1));
            }
            return (claim.aadhaarNumber && (claim.aadhaarNumber.includes(ownerHash) || claim.aadhaarNumber.includes(userRaw))) ||
                   ((claim.claimedBy || '').toLowerCase().includes(userName) && userName.length > 1);
          }
          const ownersList = p.owners || [];
          return ownersList.some(o => (o.aadhaarNumber && (o.aadhaarNumber === ownerHash || o.aadhaarNumber === userRaw)) || (o.aadhaar && (o.aadhaar === ownerHash || o.aadhaar === userRaw)) || ((o.name || '').toLowerCase().includes(userName) && userName.length > 1)) ||
                 (userRaw === '999900010010' && (p.ownerName || '').toLowerCase().includes('priya')) ||
                 (userRaw === '999900010015' && (p.ownerName || '').toLowerCase().includes('sunita'));
        }) : [];

        const demoParcels = !isCleared
          ? DEMO_MY_PARCELS.filter(p => {
              const oHash = (p.owner?.aadhaarNumber || '').replace(/\D/g, '');
              const userHashClean = ownerHash.replace(/\D/g, '');
              const userRawClean  = userRaw.replace(/\D/g, '');
              const oName = (p.ownerName || p.owner?.name || '').toLowerCase();
              
              if (oHash && (oHash === userHashClean || oHash === userRawClean)) return true;
              
              // Mock name-based fallbacks for general users
              if (userRawClean === '999900010010' && oName.includes('priya')) return true;
              if (userRawClean === '999900010015' && oName.includes('sunita')) return true;
              if (userRawClean === '999900010012' && oName.includes('suresh')) return true;
              return false;
            }).filter(p => !myScans.find(s => s.dlpiId === p.dlpiId) && !atomicClaims[p.dlpiId])
          : [];
        const claimedDemoParcels = DEMO_MY_PARCELS.filter(p => {
          if (atomicClaims[p.dlpiId]) {
            const claim = atomicClaims[p.dlpiId];
            if (claim.heirs && Array.isArray(claim.heirs)) {
              return claim.heirs.some(h => (h.aadhaarNumber && (h.aadhaarNumber === ownerHash || h.aadhaarNumber === userRaw)) || (h.aadhaar && (h.aadhaar === ownerHash || h.aadhaar === userRaw)) || ((h.name || '').toLowerCase().includes(userName) && userName.length > 1));
            }
            return (claim.aadhaarNumber && (claim.aadhaarNumber.includes(ownerHash) || claim.aadhaarNumber.includes(userRaw))) ||
                   ((claim.claimedBy || '').toLowerCase().includes(userName) && userName.length > 1) ||
                   (userRaw === '999900010015' && (claim.claimedBy || '').toLowerCase().includes('sunita'));
          }
          return false;
        });

        // Also check if any succession case directly matched this heir and executed
        let myExecutedCasesParcels = [];
        try {
          const mCases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json', 'utf8')) || [];
          mCases.filter(c => (c.status === 'EXECUTED' || c.status === 'AUTO_MUTATED' || c.status === 'COMPLETED' || c.status === 'TEHSILDAR_APPROVED') && c.heirs && c.heirs.some(h => (h.aadhaarNumber && (h.aadhaarNumber === ownerHash || h.aadhaarNumber === userRaw)) || (h.aadhaar && (h.aadhaar === ownerHash || h.aadhaar === userRaw)) || ((h.name || '').toLowerCase().includes(userName) && userName.length > 1))).forEach(sc => {
            if (!demoParcels.find(p => p.dlpiId === sc.dlpiId) && !claimedDemoParcels.find(p => p.dlpiId === sc.dlpiId) && !myScans.find(p => p.dlpiId === sc.dlpiId) && !mySeeded.find(p => p.dlpiId === sc.dlpiId)) {
              myExecutedCasesParcels.push({
                ...DEMO_DLPI,
                dlpiId: sc.dlpiId,
                claimStatus: 'OWNER_VERIFIED',
                ownerName: sc.heirs.map(h => `${h.name} (${h.share || 'Heir'})`).join(', '),
                owners: sc.heirs
              });
            }
          });
        } catch(e) {}

        return demoParcels.concat(claimedDemoParcels).concat(myScans).concat(mySeeded).concat(myExecutedCasesParcels);
      }

      case 'dlpi::GetPendingReview': {
        const fs = require('fs');
        let isCleared = false;
        try { if (fs.existsSync('/tmp/bhumichain_history_cleared.json')) isCleared = true; } catch(e) {}
        return isCleared ? [] : DEMO_PENDING_REVIEW;
      }

      // ── DLPI writes ─────────────────────────────────────────────────────────
      case 'dlpi::CreateDLPI': {
        const parsed = JSON.parse(args[0]);
        const callerRole = args[1] || 'patwari';
        const initialStatus = callerRole === 'citizen' ? 'CLAIM_SUBMITTED' : 'VERIFIED';
        
        const newParcel = {
          dlpiId:            parsed.dlpiId,
          khataNo:           parsed.khataNo || '101',
          khasraNo:          parsed.khasraNo || '101/1',
          gram:              parsed.village || parsed.gram || 'Gharbara',
          tehsil:            parsed.tehsil || 'Dadri',
          district:          parsed.district || 'Gautam Buddha Nagar',
          ownerName:         parsed.ownerName,
          ownerAadhaarHash:  parsed.ownerAadhaarHash,
          landType:          parsed.landType,
          areaHectares:      parsed.areaHectares,
          encumbranceStatus: 'CLEAR',
          claimStatus:       initialStatus,
          submittedAt:       new Date().toISOString(),
          claimedAt:         new Date().toISOString(),
          priority:          'NORMAL',
          isTribal:          false,
          isCoparcenary:     false,
          scanId:            parsed.scanId || null,
          officerNotes:      '',
          verificationChecklist: {
            physicalInspection: false,
            documentVerified:   false,
            boundaryConfirmed:  false,
            encumbranceClear:   true,
          }
        };

        if (callerRole === 'citizen') {
          DEMO_PENDING_REVIEW.push(newParcel);
        }

        DEMO_MY_PARCELS.push({
          dlpiId:            parsed.dlpiId,
          khataNo:           parsed.khataNo || '101',
          khasraNo:          parsed.khasraNo || '101/1',
          tehsil:            parsed.tehsil || 'Dadri',
          district:          parsed.district || 'Gautam Buddha Nagar',
          state:             'Uttar Pradesh',
          landType:          parsed.landType,
          areaHectares:      parsed.areaHectares,
          encumbranceStatus: 'CLEAR',
          claimStatus:       initialStatus,
          owner:             { name: parsed.ownerName },
          location:          { latitude: 28.5706, longitude: 77.5413 },
          valuation:         { circleRateINR: 12000 * parsed.areaHectares },
          txHash:            `0xcreate_dlpi_${Date.now()}`
        });

        return { dlpiId: parsed.dlpiId, claimStatus: initialStatus, success: true };
      }

      case 'dlpi::BulkSeed':
        return { seeded: args[0] ? JSON.parse(args[0]).length : 0, status: 'SEEDED_UNVERIFIED' };

      case 'dlpi::ClaimParcel': {
        const p = DEMO_PENDING_REVIEW.find(x => x.dlpiId === args[0]);
        if (p) p.claimStatus = 'CLAIM_SUBMITTED';
        const myP = DEMO_MY_PARCELS.find(x => x.dlpiId === args[0]);
        if (myP) myP.claimStatus = 'CLAIM_SUBMITTED';
        return { dlpiId: args[0], claimStatus: 'CLAIM_SUBMITTED', eSignTxHash: args[1], claimedAt: new Date().toISOString() };
      }

      case 'dlpi::SubmitForReview': {
        const p = DEMO_PENDING_REVIEW.find(x => x.dlpiId === args[0]);
        if (p) p.claimStatus = 'UNDER_REVIEW';
        const myP = DEMO_MY_PARCELS.find(x => x.dlpiId === args[0]);
        if (myP) myP.claimStatus = 'UNDER_REVIEW';
        return { dlpiId: args[0], claimStatus: 'UNDER_REVIEW', submittedAt: new Date().toISOString() };
      }

      case 'dlpi::CIReview': {
        const p = DEMO_PENDING_REVIEW.find(x => x.dlpiId === args[0]);
        if (p) p.claimStatus = 'CI_APPROVED';
        const myP = DEMO_MY_PARCELS.find(x => x.dlpiId === args[0]);
        if (myP) myP.claimStatus = 'CI_APPROVED';
        return { dlpiId: args[0], claimStatus: 'CI_APPROVED', reviewedAt: new Date().toISOString() };
      }

      case 'dlpi::Circle OfficerApprove': {
        const p = DEMO_PENDING_REVIEW.find(x => x.dlpiId === args[0]);
        if (p) p.claimStatus = 'VERIFIED';
        const myP = DEMO_MY_PARCELS.find(x => x.dlpiId === args[0]);
        if (myP) myP.claimStatus = 'VERIFIED';
        return { dlpiId: args[0], claimStatus: 'VERIFIED', approvedAt: new Date().toISOString() };
      }

      case 'dlpi::DisputeParcel':
        return { dlpiId: args[0], claimStatus: 'DISPUTED', disputedAt: new Date().toISOString() };

      case 'dlpi::RejectParcel': {
        const p = DEMO_PENDING_REVIEW.find(x => x.dlpiId === args[0]);
        if (p) p.claimStatus = 'REJECTED';
        const myP = DEMO_MY_PARCELS.find(x => x.dlpiId === args[0]);
        if (myP) myP.claimStatus = 'REJECTED';
        return { dlpiId: args[0], claimStatus: 'REJECTED', rejectedAt: new Date().toISOString() };
      }

      // ── Lease chaincodes ────────────────────────────────────────────────────
      case 'lease::InitiateLease':
        return {
          leaseId: args[0],
          dlpiId: args[1],
          ownerAadhaar: args[2],
          tenantAadhaar: args[3],
          rentAmount: parseInt(args[4]),
          durationMonths: parseInt(args[5]),
          signatures: { owner: args[6] },
          status: 'INITIATED',
          initiatedAt: new Date().toISOString()
        };
      case 'lease::SignLease':
        return {
          leaseId: args[0],
          tenantAadhaar: args[1],
          signatures: { tenant: args[2] },
          tenantName: args[3],
          status: 'ACTIVE',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + (parseInt(args[5] || '12') * 30 * 24 * 60 * 60 * 1000)).toISOString()
        };

      // ── Other chaincodes ────────────────────────────────────────────────────
      case 'property-transfer::InitiateTransfer':
        return {
          transferId: DEMO_TRANSFER.transferId, status: 'AWAITING_CONSENT',
          oracleValueINR: DEMO_TRANSFER.oracleValueINR, stampDutyINR: DEMO_TRANSFER.stampDutyINR,
          fraudScore: 0.12, nationalLockAcquired: true,
          lockExpiry: new Date(Date.now() + 86400000).toISOString(),
          consentSeller: false, consentBuyer: false, initiatedAt: new Date().toISOString(),
          ...DEMO_TRANSFER,
        };
      case 'property-transfer::GetTransferProposal':
      case 'property-transfer::GetTransfer': {
        try {
          const fs = require('fs');
          const mockT = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_transfers.json', 'utf8'));
          if (Array.isArray(mockT)) {
            const found = mockT.find(t => t.transferId === args[0]);
            if (found) return { ...DEMO_TRANSFER, ...found };
          }
        } catch(e) {}
        return DEMO_TRANSFER;
      }
      case 'property-transfer::ApproveByPatwari':
        return { success: true, status: 'PENDING_CI_APPROVAL' };
      case 'property-transfer::ApproveByCI':
        return { success: true, status: 'PENDING_SRO_EXECUTION' };
      case 'property-transfer::ApproveBySRO':
        return { success: true, status: 'PENDING_CO_APPROVAL' };
      case 'property-transfer::ApproveByCircle Officer':
        return { success: true, status: 'COMPLETED' };
      case 'property-transfer::RecordConsent':
        return { transferId: args[0], partyType: args[1], consentedAt: new Date().toISOString(), status: 'CONSENT_RECORDED' };
      case 'property-transfer::RecordFraudScore':
        return { transferId: args[0], fraudScore: parseFloat(args[1]), recorded: true };
      case 'property-transfer::ConfirmStampDutyPayment':
        return { transferId: args[0], upiRefNo: args[1], stampDutyVerified: true, status: 'STAMP_DUTY_PAID' };
      case 'property-transfer::ExecuteTransfer':
        return { transferId: args[0], newTitleCID: args[1], status: 'EXECUTED', txHash: `0xfabric-tx-transfer-${Date.now()}`, executedAt: new Date().toISOString() };
      case 'property-transfer::RejectTransfer':
        return { transferId: args[0], reason: args[1], status: 'REJECTED', rejectedAt: new Date().toISOString() };
      case 'property-transfer::QueryPendingTransfers':
      case 'property-transfer::GetAllTransfers': {
        const fs = require('fs');
        if (fs.existsSync('/tmp/bhumichain_history_cleared.json')) return [];
        return [DEMO_TRANSFER];
      }
      case 'mutation-manager::CreateMutation': {
        const data = JSON.parse(args[0]);
        const id = `MUT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const newMut = {
          mutationId: id,
          dlpiId: data.landDetails?.plotNumber ? `DLPI-UP-DAD-${String(data.landDetails.plotNumber).padStart(5, '0')}` : 'DLPI-UP-DAD-00100',
          mutationType: data.mutationType,
          officerName: data.officerName || data.applicantDetails?.fullName || 'Citizen',
          officerRank: data.officerRank || 'Citizen',
          currentOwnerName: data.previousOwnerDetails?.fullName || 'Deepak Narayan Singh',
          newOwnerName: data.newOwnerDetails?.fullName || 'Ankur Singh',
          reason: data.reason || `${data.mutationType} mutation requested.`,
          supportingCID: data.supportingCID || 'QmDummyCIDDocuments',
          status: data.status || 'Pending at Patwari',
          initiatedAt: new Date().toISOString(),
          applicantDetails: data.applicantDetails,
          landDetails: data.landDetails,
          previousOwnerDetails: data.previousOwnerDetails,
          newOwnerDetails: data.newOwnerDetails,
          dynamicFields: data.dynamicFields,
          rejectionReason: null,
          objectionReason: null,
          history: data.history || [
            { step: 'SUBMITTED', label: 'Mutation Submitted', actor: data.applicantDetails?.fullName || 'Citizen', at: new Date().toISOString() }
          ],
          timeline: [
            { step: 'SUBMITTED', label: 'Submitted', actor: data.applicantDetails?.fullName || 'Citizen', at: new Date().toISOString(), done: true },
            { step: 'PATWARI', label: 'Pending Patwari', actor: 'Patwari', at: null, done: false },
            { step: 'KANUNGO', label: 'Pending Kanungo', actor: 'Kanungo', at: null, done: false },
            { step: 'TEHSILDAR', label: 'Pending Circle Officer', actor: 'Circle Officer', at: null, done: false }
          ],
          telegramAlerts: []
        };
        DEMO_MUTATION_LIST.push(newMut);
        return newMut;
      }
      case 'mutation-manager::InitiateMutation': {
        // Fallback or legacy support
        const id = `MUT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const newMut = {
          mutationId: id,
          dlpiId: args[0],
          mutationType: args[1],
          officerName: args[2],
          officerRank: args[4] || 'Patwari',
          currentOwnerName: 'Deepak Narayan Singh',
          newOwnerName: args[5],
          reason: args[7],
          supportingCID: args[8],
          status: 'Pending at Patwari',
          initiatedAt: new Date().toISOString(),
          history: [
            { step: 'SUBMITTED', label: 'Mutation Initiated', actor: args[2], at: new Date().toISOString() }
          ],
          timeline: [
            { step: 'SUBMITTED', label: 'Submitted', actor: args[2], at: new Date().toISOString(), done: true },
            { step: 'PATWARI', label: 'Pending Patwari', actor: 'Patwari', at: null, done: false },
            { step: 'KANUNGO', label: 'Pending Kanungo', actor: 'Kanungo', at: null, done: false },
            { step: 'TEHSILDAR', label: 'Pending Circle Officer', actor: 'Circle Officer', at: null, done: false }
          ],
          telegramAlerts: []
        };
        DEMO_MUTATION_LIST.push(newMut);
        return newMut;
      }
      case 'mutation-manager::GetMutation':
        return DEMO_MUTATION_LIST.find(m => m.mutationId === args[0]) || DEMO_MUTATION;
      case 'mutation-manager::GetMutationsByDLPI':
        return DEMO_MUTATION_LIST.filter(m => m.dlpiId === args[0]);
      case 'mutation-manager::QueryPendingMutations':
      case 'mutation-manager::GetAllMutations': {
        const fs = require('fs');
        let isCleared = false;
        try { if (fs.existsSync('/tmp/bhumichain_history_cleared.json')) isCleared = true; } catch(e) {}
        let dMuts = [];
        try { dMuts = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json')); } catch(e) {}
        const initial = isCleared ? [] : DEMO_MUTATION_LIST;
        return [...initial, ...dMuts];
      }
      case 'mutation-manager::RecordOwnerAlertDelivery':
        return { mutationId: args[0], channel: args[1], deliveredAt: args[2], recorded: true };
      case 'mutation-manager::RecordOwnerConsent': {
        const m = DEMO_MUTATION_LIST.find(x => x.mutationId === args[0]);
        if (m) {
          m.status = 'CONSENT_GIVEN';
          if (!m.history) m.history = [];
          m.history.push({ step: 'CONSENT', label: 'Owner Consent Given', actor: 'Owner', at: new Date().toISOString() });
        }
        return { mutationId: args[0], status: 'CONSENT_GIVEN', consentAt: new Date().toISOString() };
      }
      case 'mutation-manager::RecordOwnerObjection': {
        const m = DEMO_MUTATION_LIST.find(x => x.mutationId === args[0]);
        if (m) {
          m.status = 'OBJECTION_FILED';
          m.objectionReason = args[2] || 'Objection raised';
          if (!m.history) m.history = [];
          m.history.push({ step: 'OBJECTION_FILED', label: 'Objection Filed by Owner', actor: 'Owner', at: new Date().toISOString() });
          const step = m.timeline?.find(t => t.step === 'TEHSILDAR');
          if (step) {
            step.done = true;
            step.at = new Date().toISOString();
            step.label = 'Objection Filed';
          }
        }
        return { mutationId: args[0], status: 'OBJECTION_FILED', objectionAt: new Date().toISOString() };
      }
      case 'mutation-manager::UpdateMutationStatus': {
        const m = DEMO_MUTATION_LIST.find(x => x.mutationId === args[0]);
        if (!m) return { error: 'MUTATION_NOT_FOUND' };
        const newStatus = args[1];
        const actorName = args[2];
        const rejectionReason = args[3] || null;
        
        m.status = newStatus;
        const at = new Date().toISOString();
        if (!m.history) m.history = [];
        m.history.push({
          step: newStatus.toUpperCase().replace(/ /g, '_'),
          label: `Mutation status: ${newStatus}`,
          actor: actorName,
          at
        });

        if (!m.timeline) {
          m.timeline = [
            { step: 'SUBMITTED', label: 'Submitted', actor: 'Citizen', at: m.initiatedAt || at, done: true },
            { step: 'PATWARI', label: 'Pending Patwari', actor: 'Patwari', at: null, done: false },
            { step: 'KANUNGO', label: 'Pending Kanungo', actor: 'Kanungo', at: null, done: false },
            { step: 'TEHSILDAR', label: 'Pending Circle Officer', actor: 'Circle Officer', at: null, done: false }
          ];
        }

        if (newStatus === 'Pending at Kanungo') {
          const step = m.timeline.find(t => t.step === 'PATWARI');
          if (step) { step.done = true; step.at = at; step.actor = actorName; step.label = 'Patwari Approved'; }
        } else if (newStatus === 'Pending at Circle Officer') {
          const step = m.timeline.find(t => t.step === 'KANUNGO');
          if (step) { step.done = true; step.at = at; step.actor = actorName; step.label = 'Kanungo Approved'; }
        } else if (newStatus === 'Approved') {
          const step = m.timeline.find(t => t.step === 'TEHSILDAR');
          if (step) { step.done = true; step.at = at; step.actor = actorName; step.label = 'Circle Officer Approved'; }
          // Update Jamabandi records
          if (m.dlpiId) {
            const p = DEMO_MY_PARCELS.find(x => x.dlpiId === m.dlpiId);
            if (p) {
              p.owner = { name: m.newOwnerName };
              p.ownerName = m.newOwnerName;
            }
            if (DEMO_DLPI.dlpiId === m.dlpiId) {
              DEMO_DLPI.ownerName = m.newOwnerName;
            }
          }
        } else if (newStatus === 'Rejected') {
          m.rejectionReason = rejectionReason;
          const step = m.timeline.find(t => !t.done);
          if (step) {
            step.done = true;
            step.at = at;
            step.actor = actorName;
            step.label = `Rejected by ${actorName}`;
          }
        } else if (newStatus === 'Objection Filed') {
          m.objectionReason = rejectionReason; // Save objection text here
          const step = m.timeline.find(t => t.step === 'TEHSILDAR');
          if (step) {
            step.done = true;
            step.at = at;
            step.actor = actorName;
            step.label = 'Objection Filed';
          }
        }
        return m;
      }
      case 'mutation-manager::ExecuteMutation':
        return { mutationId: args[0], status: 'EXECUTED', executedAt: new Date().toISOString(), txHash: `0xmut-exec-${Date.now()}` };
      case 'uttaradhikar::InitiateSuccessionByDeathCert':
      case 'uttaradhikar::InitiateSuccession': {
        const caseId = `SUC-${args[0]}-${Date.now().toString(16)}`;
        let heirs = [];
        try {
          if (args.length >= 10 && args[9]) {
            heirs = JSON.parse(args[9]);
            if (heirs.length > 0) {
              const fraction = `1/${heirs.length}`;
              const decimal = 1.0 / heirs.length;
              heirs = heirs.map(h => ({
                ...h,
                share: fraction,
                finalShare: fraction,
                shareDecimal: decimal,
                finalShareDec: decimal
              }));
            }
          }
        } catch (e) {}
        const newCase = {
          caseId,
          dlpiId: args[0],
          familyId: args[1],
          deceasedName: args[2],
          deceasedAadhaarNumber: args[3],
          dateOfDeath: args[4],
          deathCertCID: args[5],
          crsRegistrationNo: args[6],
          applicableLaw: args[8] || 'Hindu Succession Act 1956/2005',
          status: 'AWAITING_CONSENTS',
          heirs: heirs,
          totalHeirs: heirs.length,
          consentDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          aiComputationCID: args[11] || 'QmDynamicHeirComputation',
          aiConfidenceScore: parseFloat(args[12] || '1.0'),
          initiatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const fs = require('fs');
        let cases = [];
        try { cases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json')); } catch(e) {}
        cases.push(newCase);
        fs.writeFileSync('/tmp/bhumichain_mock_cases.json', JSON.stringify(cases));
        return { caseId, status: 'HEIRS_IDENTIFIED' };
      }
      case 'uttaradhikar::GetSuccessionCase': {
        const fs = require('fs');
        let cases = [];
        try { cases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json')); } catch(e) {}
        try {
          const bCases = JSON.parse(fs.readFileSync('/tmp/bhumichain_succession_cases.json'));
          cases = [...cases, ...Object.values(bCases || {})];
        } catch(e) {}
        return cases.find(c => c.caseId === args[0]) || (cases.length > 0 ? cases[cases.length - 1] : DEMO_SUCCESSION_CASE);
      }
      case 'uttaradhikar::GetSuccessionByDLPI': {
        const fs = require('fs');
        let cases = [];
        try { cases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json')); } catch(e) {}
        try {
          const bCases = JSON.parse(fs.readFileSync('/tmp/bhumichain_succession_cases.json'));
          cases = [...cases, ...Object.values(bCases || {})];
        } catch(e) {}
        const activeCase = cases.find(c => c.dlpiId === args[0]);
        return activeCase ? [activeCase] : [];
      }
      case 'uttaradhikar::QueryPendingSuccessions': {
        const fs = require('fs');
        if (fs.existsSync('/tmp/bhumichain_history_cleared.json')) return [];
        let cases = [];
        try { cases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json')); } catch(e) {}
        try {
          const bCases = JSON.parse(fs.readFileSync('/tmp/bhumichain_succession_cases.json'));
          cases = [...cases, ...Object.values(bCases || {})];
        } catch(e) {}
        return cases.filter(c => c && ['AWAITING_CONSENTS', 'HEIR_CONSENT_PENDING', 'PENDING_CO_APPROVAL', 'ALL_CONSENTED', 'PENDING_CO', 'SUCCESSION_PENDING_CO', 'COURT_REFERRED'].includes(c.status));
      }
      case 'uttaradhikar::GetMyPendingSuccessions': {
        const myHashRaw = String(args[0] || '').replace(/\D/g, '');
        const myHash = args[0];
        const fs = require('fs');
        let cases = [];
        try { cases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json')); } catch(e) {}
        try {
          const bCases = JSON.parse(fs.readFileSync('/tmp/bhumichain_succession_cases.json'));
          cases = [...cases, ...Object.values(bCases || {})];
        } catch(e) {}
        return cases.filter(c => {
          if (!['AWAITING_CONSENTS', 'HEIR_CONSENT_PENDING'].includes(c.status)) return false;
          const me = c.heirs?.find(h => {
            const hAadhaar = String(h.aadhaarNumber || h.aadhaar || '').replace(/\D/g, '');
            if (hAadhaar && myHashRaw && hAadhaar === myHashRaw) return true;
            if (h.aadhaarNumber === myHash) return true;
            const nameLower = (h.name || '').toLowerCase();
            if (myHash === '999900010010' && nameLower.includes('priya')) return true;
            if (myHash === '999900010015' && nameLower.includes('sunita')) return true;
            if (myHash === '999900010012' && nameLower.includes('suresh')) return true;
            return false;
          });
          return me && !me.hasConsented;
        });
      }
      case 'uttaradhikar::RecordHeirConsent': {
        const fs = require('fs');
        let cases = [];
        try { cases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json')); } catch(e) {}
        const sc = cases.find(c => c && c.caseId === args[0]);
        let returnedStatus = 'CONSENT_RECORDED';
        if (sc && sc.heirs) {
          const heir = sc.heirs.find(h => h.aadhaarNumber === args[1] || h.aadhaar === args[1] || (args[1] && (String(args[1]).replace(/\D/g, '') === String(h.aadhaar || h.aadhaarNumber).replace(/\D/g, ''))));
          if (heir) {
            heir.hasConsented = true;
            heir.consentedAt = new Date().toISOString();
            heir.eSignTxHash = args[2];
          }
          if (sc.heirs.every(h => h.hasConsented)) {
            sc.status = 'PENDING_CO';
            returnedStatus = 'PENDING_CO_APPROVAL';
          }
          fs.writeFileSync('/tmp/bhumichain_mock_cases.json', JSON.stringify(cases, null, 2));
        }
        return { caseId: args[0], heirAadhaarNumber: args[1], eSignTxHash: args[2], consentedAt: new Date().toISOString(), status: returnedStatus };
      }
      case 'uttaradhikar::ExecuteSuccession': {
        const fs = require('fs');
        let cases = [];
        try { cases = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_cases.json')); } catch(e) {}
        const sc = cases.find(c => c.caseId === args[0]);
        if (sc && sc.heirs) {
          sc.status = 'EXECUTED';
          fs.writeFileSync('/tmp/bhumichain_mock_cases.json', JSON.stringify(cases));
          // Find the parcel in MOCK_SCANS and replace initialOwners
          let parcel = MOCK_SCANS.find(p => p.dlpiId === sc.dlpiId);
          if (!parcel) {
            parcel = JSON.parse(JSON.stringify(DEMO_DLPI));
            parcel.dlpiId = sc.dlpiId; // Just in case
            MOCK_SCANS.push(parcel);
          }
          if (parcel) {
            parcel.initialOwners = sc.heirs.map(h => ({
              name: h.name,
              aadhaarNumber: h.aadhaarNumber,
              share: h.share || h.finalShare,
              shareDecimal: h.shareDecimal || h.finalShareDec
            }));
            parcel.claimStatus = 'VERIFIED';
          }
          
          // Auto-generate a mutation for this succession
          const mutId = `MUT-${sc.dlpiId}-${Date.now().toString(16)}`;
          const newMut = {
            mutationId: mutId,
            dlpiId: sc.dlpiId,
            mutationType: 'Virasat (Inheritance)',
            mutationTypeCode: 'Inheritance',
            officerName: 'Amit Saxena (Auto)',
            officerHash: 'tehsildar-hash',
            officerRank: 'Circle Officer',
            currentOwnerName: sc.deceasedName,
            newOwnerName: sc.heirs.map(h => h.name).join(', '),
            status: 'ALERT_SENT',
            slaMet: true,
            requiresPublicNotice: true,
            publicNoticePeriodDays: 30,
            objectionDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            initiatedAt: new Date().toISOString(),
            timeline: [
              { step: 'INITIATED', label: 'Mutation Initiated', actor: 'System (Auto)', at: new Date().toISOString(), done: true },
              { step: 'ALERT_SENT', label: 'Owner Alerted', actor: 'BhumiChain', at: new Date().toISOString(), done: true }
            ]
          };
          let dMuts = [];
          try { dMuts = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json')); } catch(e) {}
          dMuts.push(newMut);
          fs.writeFileSync('/tmp/bhumichain_dynamic_mutations.json', JSON.stringify(dMuts));
        }
        return { caseId: args[0], status: 'EXECUTED', executedAt: new Date().toISOString(), txHash: `0xsuc-exec-${Date.now()}` };
      }
      case 'uttaradhikar::RecordHeirObjection':
        return { caseId: args[0], heirAadhaarNumber: args[1], reason: args[2], objectedAt: new Date().toISOString(), status: 'OBJECTION_FILED' };
      case 'uttaradhikar::RecordHeirNotification':
        return { caseId: args[0], channel: args[1], deliveredAt: new Date().toISOString(), recorded: true };
      case 'bhumi-auction::GetAllAuctions':
        return [DEMO_AUCTION_ACTIVE, DEMO_AUCTION_UPCOMING];
      case 'bhumi-auction::GetAuction':
        if (args[0] === DEMO_AUCTION_UPCOMING.auctionId) return DEMO_AUCTION_UPCOMING;
        return DEMO_AUCTION_ACTIVE;
      case 'bhumi-auction::PlaceSealedBid':
        return {
          auctionId: args[0],
          bidSealHash: `bid-seal-${Date.now().toString(36).toUpperCase()}`,
          bidAmountINR: parseInt(args[1]),
          sealedAt: new Date().toISOString(),
          revealAt: DEMO_AUCTION_ACTIVE.auctionEnd,
          status: 'SEALED',
        };
      case 'bhumi-auction::GetAuctionBids':
        return [
          { bidderHash: 'sha256:bid-anon-1', sealedAt: '2026-06-30T08:15:00Z', status: 'SEALED' },
          { bidderHash: 'sha256:bid-anon-2', sealedAt: '2026-06-30T09:00:00Z', status: 'SEALED' },
          { bidderHash: 'sha256:bid-anon-3', sealedAt: '2026-06-30T10:30:00Z', status: 'SEALED' },
          { bidderHash: 'sha256:bid-anon-4', sealedAt: '2026-06-30T11:45:00Z', status: 'SEALED' },
        ];
      case 'encumbrance::GenerateEC':
        return DEMO_EC;

      case 'dlpi::CreateDLPI':
        const input = JSON.parse(args[0]);
        input.claimStatus = input.sourceType === 'RECORD_SCAN_AI' ? 'SCAN_PENDING_SRO' : 'SEEDED_UNVERIFIED';
        input.encumbranceStatus = 'CLEAR';
        // Add fake submittedAt for sorting in queue
        input.submittedAt = new Date().toISOString();
        // Give it ownerName derived from initialOwners
        input.ownerName = input.initialOwners && input.initialOwners.length > 0 ? input.initialOwners[0].name : 'Unknown';
        MOCK_SCANS.push(input);
        return { success: true, txId: `mock-tx-${Date.now()}` };

      case 'dlpi::QueryPendingScans':
        return MOCK_SCANS.filter(s => s.claimStatus === args[0]);

      case 'dlpi::ApproveScanSRO':
        const scanSro = MOCK_SCANS.find(s => s.dlpiId === args[0]);
        if (scanSro) scanSro.claimStatus = 'SCAN_PENDING_CO';
        return { success: true };

      case 'dlpi::ApproveScanCircle Officer':
        const scanTehsil = MOCK_SCANS.find(s => s.dlpiId === args[0]);
        if (scanTehsil) scanTehsil.claimStatus = 'SEEDED_UNVERIFIED';
        return { success: true };

      default:
        return { success: true, txId: `mock-tx-${Date.now()}` };
    }
  },
};
