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
  ownerAadhaarHash:  'sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a',
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

const DEMO_TRIBAL_DLPI = {
  dlpiId:            'DLPI-UP-DAD-00006',
  khataNo:           '501',
  khasraNo:          '120/501',
  tehsilCode:        'DAD',
  districtCode:      'UP-GBN',
  ownerName:         'Ramkali Gond',
  ownerAadhaarHash:  'sha256:b4g9f3d2c8e1a7f0e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a',
  landType:          'Tribal_FRA',
  landTypeDesc:      'Tribal / forest rights patta',
  areaHectares:      2.1,
  encumbranceStatus: 'CLEAR',
  claimStatus:       'VERIFIED',
  transferLocked:    false,
  successionStatus:  null,
  jangananaFlags:    [],
  tribalProtection: {
    scheduleType:      'Schedule V',
    fraPatteNumber:    'FRA/DAD/2011/0088',
    gramSabhaVillage:  'Roja Yakubpur',
    gramSabhaId:       'GSBH-DAD-0007',
    protectionAct:     ['Constitution Art.244', 'FRA 2006 S.4', '5th Schedule'],
  },
  blockchainTxHash: '0xfabric-tx-t1r2i3b4a5l6g7u8a9r0',
  createdAt:        '2023-06-10T10:00:00Z',
  updatedAt:        '2025-12-01T08:00:00Z',
};

// My Parcels mock — returned for any citizen demo login
const DEMO_MY_PARCELS = [
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
    owner:             { name: 'Priya Kumar' },
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
    owner:             { name: 'Priya Kumar' },
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
    owner:             { name: 'Arun Sharma' },
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
    owner:             { name: 'Suresh Yadav' },
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
    owner:             { name: 'Meena Devi' },
    location:          { latitude: 28.5900, longitude: 77.4700 },
    valuation:         { circleRateINR: 720_000 },
    txHash:            '0xdemo_meena_tx',
    updatedAt:         '2026-06-20T09:00:00Z',
  },
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
    isTribal:         false,
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
    isTribal:         false,
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
    isTribal:         false,
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
    isTribal:         false,
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
    landType:         'Tribal_FRA',
    areaHectares:     0.6,
    encumbranceStatus:'CLEAR',
    claimStatus:      'CLAIM_SUBMITTED',
    submittedAt:      '2026-06-22T14:00:00Z',
    claimedAt:        '2026-06-22T14:00:00Z',
    eSignTxHash:      '0xesign-ramkali-m4n5o6',
    patwariName:      'Ramesh Yadav',
    scanId:           null,
    priority:         'URGENT',
    isTribal:         true,
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
      aadhaarHash:  'sha256:heir1ankur3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8',
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
      aadhaarHash:  'sha256:heir2nitin8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7',
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
      aadhaarHash:  'sha256:heir3neeta1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5',
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
  sellerAadhaarHash:   'sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a',
  buyerName:           'Rakesh Agarwal',
  buyerAadhaarHash:    'sha256:buyer1rakesh9d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0',
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

const DEMO_TRIBAL_REJECTION = {
  dlpiId:          'DLPI-UP-DAD-00006',
  attemptId:       'TGA-DLPI-UP-DAD-00006-c3d4e5f6',
  isTribalParcel:  true,
  scheduleType:    'V',
  community:       'Gond',
  decision:        'HARD_REJECTED',
  rejectionCode:   'SCHEDULE_V_NON_TRIBAL',
  rejectionReason:
    'HARD REJECT — Parcel DLPI-UP-DAD-00006 is located in a Fifth Schedule (Scheduled Area) in ' +
    'Dadri tehsil, Gautam Buddha Nagar district, Uttar Pradesh. Buyer is not a registered Scheduled Tribe member. ' +
    'Transfer of tribal land to non-tribal persons in Scheduled Areas is VOID AB INITIO per Supreme ' +
    'Court ruling in Samatha v. State of AP (1997) 8 SCC 191. No revenue officer, SRO, or digital ' +
    'signature can authorise this transaction.',
  legalCitations: [
    "Constitution of India, Fifth Schedule, Para 5(2) — Transfer of immovable property by or among members of a Scheduled Tribe in a Scheduled Area requires Governor's sanction",
    "Samatha v. State of Andhra Pradesh (1997) 8 SCC 191 — Supreme Court held that transfer of tribal land to non-tribals in Fifth Schedule areas is unconstitutional and void ab initio",
    "UP Zamindari Abolition and Land Reforms Act 1950, Section 157-B — Tribal land in Scheduled Areas cannot be transferred to non-tribal without Collector's permission",
    "Forest Rights Act 2006, Section 4(5) — No eviction or displacement of forest dwelling Scheduled Tribes without recognition of forest rights",
  ],
  responseTimeMs: 147,
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
  currentOwnerAadhaarHash: 'sha256:owner1deepak3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9',
  newOwnerName:            'Ankur Singh',
  newOwnerAadhaarHash:     'sha256:heir1ankur3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8',
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
      recipient:  'Neighbour: Arun Sharma (DLPI-UP-DAD-00003)',
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
  scene6_tribal_rejected: {
    event:   'TribalTransferHardRejected',
    payload: DEMO_TRIBAL_REJECTION,
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

module.exports = {
  DEMO_DLPI,
  DEMO_TRIBAL_DLPI,
  DEMO_MY_PARCELS,
  DEMO_PENDING_REVIEW,
  DEMO_SUCCESSION_CASE,
  DEMO_TRANSFER,
  DEMO_TRIBAL_REJECTION,
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
      case 'dlpi::GetDLPI':
        if (args[0] === 'DLPI-UP-DAD-00006') return DEMO_TRIBAL_DLPI;
        return DEMO_DLPI;

      case 'dlpi::GetDLPIHistory':
        return [
          { txId: '0xfabric-tx-000001', timestamp: '2024-01-15T09:30:00Z', action: 'DLPI_CREATED',        actor: 'Revenue Dept (Vijay Singh, Patwari)' },
          { txId: '0xfabric-tx-000002', timestamp: '2025-03-10T11:20:00Z', action: 'ENCUMBRANCE_ADDED',    actor: 'SBI Noida Branch' },
          { txId: '0xfabric-tx-000003', timestamp: '2025-09-01T14:00:00Z', action: 'ENCUMBRANCE_RELEASED', actor: 'SBI Noida Branch' },
        ];

      case 'dlpi::GetMyParcels':
        return DEMO_MY_PARCELS;

      case 'dlpi::GetPendingReview':
        return DEMO_PENDING_REVIEW;

      // ── DLPI writes ─────────────────────────────────────────────────────────
      case 'dlpi::BulkSeed':
        return { seeded: args[0] ? JSON.parse(args[0]).length : 0, status: 'SEEDED_UNVERIFIED' };

      case 'dlpi::ClaimParcel':
        return { dlpiId: args[0], claimStatus: 'CLAIM_SUBMITTED', eSignTxHash: args[1], claimedAt: new Date().toISOString() };

      case 'dlpi::SubmitForReview':
        return { dlpiId: args[0], claimStatus: 'UNDER_REVIEW', submittedAt: new Date().toISOString() };

      case 'dlpi::CIReview':
        return { dlpiId: args[0], claimStatus: 'CI_APPROVED', reviewedAt: new Date().toISOString() };

      case 'dlpi::TehsildarApprove':
        return { dlpiId: args[0], claimStatus: 'VERIFIED', approvedAt: new Date().toISOString() };

      case 'dlpi::DisputeParcel':
        return { dlpiId: args[0], claimStatus: 'DISPUTED', disputedAt: new Date().toISOString() };

      case 'dlpi::RejectParcel':
        return { dlpiId: args[0], claimStatus: 'REJECTED', rejectedAt: new Date().toISOString() };

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
      case 'property-transfer::GetTransfer':
        return DEMO_TRANSFER;
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
      case 'property-transfer::GetAllTransfers':
        return [DEMO_TRANSFER];
      case 'mutation-manager::InitiateMutation':
        return { mutationId: DEMO_MUTATION.mutationId, status: 'ALERT_SENT', alertSentAt: new Date().toISOString(), slaMet: true };
      case 'mutation-manager::GetMutation':
        return DEMO_MUTATION;
      case 'mutation-manager::GetMutationsByDLPI':
        return DEMO_MUTATION_LIST.filter(m => m.dlpiId === args[0]);
      case 'mutation-manager::GetAllMutations':
        return DEMO_MUTATION_LIST;
      case 'mutation-manager::RecordOwnerAlertDelivery':
        return { mutationId: args[0], channel: args[1], deliveredAt: args[2], recorded: true };
      case 'mutation-manager::RecordOwnerConsent':
        return { mutationId: args[0], status: 'CONSENT_GIVEN', consentAt: new Date().toISOString() };
      case 'mutation-manager::RecordOwnerObjection':
        return { mutationId: args[0], status: 'OBJECTION_FILED', objectionAt: new Date().toISOString() };
      case 'mutation-manager::ExecuteMutation':
        return { mutationId: args[0], status: 'EXECUTED', executedAt: new Date().toISOString(), txHash: `0xmut-exec-${Date.now()}` };
      case 'uttaradhikar::InitiateSuccession':
        return { caseId: DEMO_SUCCESSION_CASE.caseId, status: 'HEIRS_IDENTIFIED' };
      case 'uttaradhikar::GetSuccessionCase':
        return DEMO_SUCCESSION_CASE;
      case 'uttaradhikar::GetSuccessionByDLPI':
        return args[0] === DEMO_SUCCESSION_CASE.dlpiId ? [DEMO_SUCCESSION_CASE] : [];
      case 'uttaradhikar::QueryPendingSuccessions':
        return [DEMO_SUCCESSION_CASE];
      case 'uttaradhikar::RecordHeirConsent':
        return { caseId: args[0], heirAadhaarHash: args[1], eSignTxHash: args[2], consentedAt: new Date().toISOString(), status: 'CONSENT_RECORDED' };
      case 'uttaradhikar::RecordHeirObjection':
        return { caseId: args[0], heirAadhaarHash: args[1], reason: args[2], objectedAt: new Date().toISOString(), status: 'OBJECTION_FILED' };
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

      case 'tribal-guard::CheckTransfer':
        return DEMO_TRIBAL_REJECTION;
      case 'encumbrance::GenerateEC':
        return DEMO_EC;

      default:
        return { success: true, txId: `mock-tx-${Date.now()}` };
    }
  },
};
