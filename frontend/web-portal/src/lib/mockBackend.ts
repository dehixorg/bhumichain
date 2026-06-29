export const DEMO_MY_PARCELS = [
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
    valuation:         { circleRateINR: 3750000 },
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
    valuation:         { circleRateINR: 1440000 },
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
    valuation:         { circleRateINR: 2880000 },
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
    valuation:         { circleRateINR: 4800000 },
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
    valuation:         { circleRateINR: 720000 },
    txHash:            '0xdemo_meena_tx',
    updatedAt:         '2026-06-20T09:00:00Z',
  },
];

export const DEMO_PENDING_REVIEW = [
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
    priority:         'URGENT',
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
    priority:         'NORMAL',
    verificationChecklist: {
      physicalInspection: false,
      documentVerified:   false,
      boundaryConfirmed:  false,
      encumbranceClear:   true,
    },
  },
];

export const DEMO_DLPI = {
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

const DEMO_PERSONAS: Record<string, any> = {
  tehsildar: {
    role: 'tehsildar', name: 'Amit Saxena',
    aadhaarHash: 'sha256:tehsildar999900010001',
    jurisdictionCode: 'GBN-DAD', tehsilCode: 'DAD',
  },
  circle_inspector: {
    role: 'circle_inspector', name: 'Rajesh Verma',
    aadhaarHash: 'sha256:circle999900010002',
    jurisdictionCode: 'GBN-DAD', circleCode: 'DAD-C1',
    patwariCodes: ['DAD-P1', 'DAD-P2', 'DAD-P3'], tehsilCode: 'DAD',
  },
  patwari: {
    role: 'patwari', name: 'Vijay Singh',
    aadhaarHash: 'sha256:patwari999900010003',
    jurisdictionCode: 'GBN-DAD', patwariCode: 'DAD-P1',
    villageCodes: ['DAD-001', 'DAD-002', 'DAD-003'], tehsilCode: 'DAD',
  },
  citizen: {
    role: 'citizen', name: 'Priya Kumar',
    aadhaarHash: 'sha256:citizen999900010010',
  },
  citizen_buyer: {
    role: 'citizen', name: 'Arun Sharma',
    aadhaarHash: 'sha256:citizenbuyer999900010011',
  },
  citizen_heir1: {
    role: 'citizen', name: 'Suresh Yadav',
    aadhaarHash: 'sha256:citizenheir1999900010012',
  },
  citizen_heir2: {
    role: 'citizen', name: 'Meena Devi',
    aadhaarHash: 'sha256:citizenheir2999900010013',
  },
};

const state = {
  myParcels: [...DEMO_MY_PARCELS],
  pendingReview: [...DEMO_PENDING_REVIEW],
  mutations: [
    {
      mutationId:              'MUT-DLPI-UP-DAD-00100-d4e5f6a7',
      dlpiId:                  'DLPI-UP-DAD-00100',
      mutationType:            'Virasat (Inheritance)',
      mutationTypeCode:        'Inheritance',
      officerName:             'Ramesh Yadav',
      officerRank:             'Patwari',
      currentOwnerName:        'Deepak Narayan Singh',
      newOwnerName:            'Ankur Singh',
      reason:                  'Death of Deepak Narayan Singh. Son Ankur Singh is primary legal heir.',
      status:                  'ALERT_SENT',
      alertSentAt:             '2026-06-10T09:31:04Z',
      alertElapsedSeconds:     64,
      slaMet:                  true,
      requiresPublicNotice:    true,
      initiatedAt:             '2026-06-10T09:30:00Z',
    }
  ]
};

export async function handleMockApi(path: string, options: RequestInit): Promise<Response> {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body as string) : {};

  console.log(`[MOCK API] ${method} ${path}`, body);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  if (path === '/api/auth/request-otp') {
    return jsonResponse({ success: true, maskedPhone: 'XXXXXX1234', message: 'OTP sent' });
  }

  if (path === '/api/auth/verify-otp' || path === '/api/auth/officer-login') {
    const isOfficer = path.includes('officer-login');
    const user = isOfficer ? DEMO_PERSONAS['patwari'] : DEMO_PERSONAS['citizen'];
    // Fake JWT payload for frontend to parse
    const payload = { ...user, exp: Math.floor(Date.now() / 1000) + 3600 };
    const fakeToken = `header.${btoa(JSON.stringify(payload))}.signature`;
    return jsonResponse({ token: fakeToken, user });
  }

  if (path === '/api/auth/demo-token') {
    const persona = DEMO_PERSONAS[body.persona] || DEMO_PERSONAS['citizen'];
    const payload = { ...persona, demo: true, exp: Math.floor(Date.now() / 1000) + 3600 };
    const fakeToken = `header.${btoa(JSON.stringify(payload))}.signature`;
    return jsonResponse({ token: fakeToken, user: persona });
  }

  if (path === '/api/auth/esign') {
    return jsonResponse({
      eSignTxHash: '0xmock-esign-hash-' + Date.now(),
      signedAt: new Date().toISOString()
    });
  }

  if (path === '/api/dlpi/my-parcels') {
    return jsonResponse(state.myParcels);
  }

  if (path === '/api/dlpi/pending-review') {
    return jsonResponse(state.pendingReview);
  }

  if (path.match(/^\/api\/dlpi\/[^\/]+$/)) {
    return jsonResponse(DEMO_DLPI);
  }

  if (path.match(/^\/api\/dlpi\/[^\/]+\/claim$/)) {
    const dlpiId = path.split('/')[3];
    const parcel = state.myParcels.find(p => p.dlpiId === dlpiId);
    if (parcel) {
      parcel.claimStatus = 'CLAIM_SUBMITTED';
    }
    return jsonResponse({ dlpiId, claimStatus: 'CLAIM_SUBMITTED', eSignTxHash: body.eSignTxHash });
  }

  if (path.match(/^\/api\/dlpi\/[^\/]+\/submit-for-review$/)) {
    const dlpiId = path.split('/')[3];
    const parcel = state.myParcels.find(p => p.dlpiId === dlpiId);
    if (parcel) {
      parcel.claimStatus = 'UNDER_REVIEW';
    }
    return jsonResponse({ dlpiId, claimStatus: 'UNDER_REVIEW' });
  }

  if (path.match(/^\/api\/dlpi\/[^\/]+\/tehsildar-approve$/)) {
    const dlpiId = path.split('/')[3];
    state.pendingReview = state.pendingReview.filter(p => p.dlpiId !== dlpiId);
    return jsonResponse({ dlpiId, claimStatus: 'VERIFIED' });
  }

  if (path === '/api/mutation') {
    return jsonResponse(state.mutations);
  }

  if (path.match(/^\/api\/mutation\/[^\/]+$/)) {
    return jsonResponse(state.mutations[0]);
  }

  return jsonResponse({ error: 'MOCK_NOT_FOUND', message: 'Mock route not implemented' }, 404);
}
