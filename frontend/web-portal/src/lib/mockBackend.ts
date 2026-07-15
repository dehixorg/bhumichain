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
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    owners:            [{ name: 'Priya Kumar', aadhaarNumber: '999900010010', aadhaarHash: '999900010010', share: '1/1', shareDecimal: 1.0, isVerified: true }],
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
    owner:             { name: 'Priya Kumar', aadhaarNumber: '999900010010' },
    owners:            [{ name: 'Priya Kumar', aadhaarNumber: '999900010010', aadhaarHash: '999900010010', share: '1/1', shareDecimal: 1.0, isVerified: true }],
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
    owner:             { name: 'Rakesh Agarwal', aadhaarNumber: '999900010009' },
    owners:            [{ name: 'Rakesh Agarwal', aadhaarNumber: '999900010009', aadhaarHash: '999900010009', share: '1/1', shareDecimal: 1.0, isVerified: true }],
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
    owner:             { name: 'Suresh Yadav', aadhaarNumber: '999900010012' },
    owners:            [{ name: 'Suresh Yadav', aadhaarNumber: '999900010012', aadhaarHash: '999900010012', share: '1/1', shareDecimal: 1.0, isVerified: true }],
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
    owner:             { name: 'Meena Devi', aadhaarNumber: '999900010005' },
    owners:            [{ name: 'Meena Devi', aadhaarNumber: '999900010005', aadhaarHash: '999900010005', share: '1/1', shareDecimal: 1.0, isVerified: true }],
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
  ownerName:         'Hi User',
  owner:             { name: 'Hi User', aadhaarNumber: '111122223333' },
  owners:            [{ name: 'Hi User', aadhaarNumber: '111122223333', aadhaarHash: '111122223333', share: '1/1', shareDecimal: 1.0, isVerified: true }],
  ownerAadhaarHash:  '111122223333',
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
    aadhaarNumber: '999900010001', aadhaar: '999900010001', aadhaarHash: '999900010001',
    jurisdictionCode: 'GBN-DAD', tehsilCode: 'DAD',
  },
  circle_inspector: {
    role: 'circle_inspector', name: 'Rajesh Verma',
    aadhaarNumber: '999900010002', aadhaar: '999900010002', aadhaarHash: '999900010002',
    jurisdictionCode: 'GBN-DAD', circleCode: 'DAD-C1',
    patwariCodes: ['DAD-P1', 'DAD-P2', 'DAD-P3'], tehsilCode: 'DAD',
  },
  patwari: {
    role: 'patwari', name: 'Vijay Singh',
    aadhaarNumber: '999900010003', aadhaar: '999900010003', aadhaarHash: '999900010003',
    jurisdictionCode: 'GBN-DAD', patwariCode: 'DAD-P1',
    villageCodes: ['DAD-001', 'DAD-002', 'DAD-003'], tehsilCode: 'DAD',
  },
  citizen: {
    role: 'citizen', name: 'Priya Kumar',
    aadhaarNumber: '999900010010', aadhaar: '999900010010', aadhaarHash: '999900010010',
  },
  citizen_buyer: {
    role: 'citizen', name: 'Rakesh Agarwal',
    aadhaarNumber: '999900010009', aadhaar: '999900010009', aadhaarHash: '999900010009',
  },
  suresh_yadav: {
    role: 'citizen', name: 'Suresh Yadav',
    aadhaarNumber: '999900010012', aadhaar: '999900010012', aadhaarHash: '999900010012',
  },
  citizen_heir1: {
    role: 'citizen', name: 'Suresh Yadav',
    aadhaarNumber: '999900010012', aadhaar: '999900010012', aadhaarHash: '999900010012',
  },
  citizen_heir2: {
    role: 'citizen', name: 'Sunita Kumar',
    aadhaarNumber: '999900010015', aadhaar: '999900010015', aadhaarHash: '999900010015',
  },
};

const state = {
  myParcels: [...DEMO_MY_PARCELS],
  pendingReview: [...DEMO_PENDING_REVIEW],
  // Shared in-memory succession store — persists across page loads within same browser session
  pendingSuccessions: [] as any[],
  pendingTransfers: [] as any[],
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
    let user = isOfficer ? DEMO_PERSONAS['patwari'] : DEMO_PERSONAS['citizen'];
    if (!isOfficer) {
      const digits = (body.aadhaarNumber || '').replace(/\D/g, '');
      if (digits) {
        const existing = Object.values(DEMO_PERSONAS).find((p: any) => p.aadhaarHash === digits || p.aadhaar === digits || p.aadhaarNo === digits) as any;
        if (existing) {
          user = existing;
        } else {
          // Check if any property in state.myParcels was seeded/added for this Aadhaar
          const assigned = state.myParcels.find(p => {
            const owners = (p as any).owners || (p as any).initialOwners || [];
            return owners.some((o: any) => o.aadhaarHash === digits || o.aadhaar === digits || o.aadhaarNo === digits);
          });
          const ownerName = assigned ? (((assigned as any).owners || (assigned as any).initialOwners)?.[0]?.name || 'Hi User') : 'Hi User';
          user = {
            role: 'citizen',
            name: ownerName,
            aadhaarHash: digits,
            aadhaar: digits,
            aadhaarRaw: digits,
            aadhaarNo: digits,
          };
          DEMO_PERSONAS[`citizen_${digits}`] = user;
        }
      }
    }
    // Fake JWT payload for frontend to parse
    const payload = { ...user, exp: Math.floor(Date.now() / 1000) + 3600 };
    const fakeToken = `mock.${btoa(JSON.stringify(payload))}.mock`;
    return jsonResponse({ token: fakeToken, user });
  }

  if (path === '/api/auth/demo-token') {
    const persona = DEMO_PERSONAS[body.persona] || DEMO_PERSONAS['citizen'];
    const payload = { ...persona, demo: true, exp: Math.floor(Date.now() / 1000) + 3600 };
    const fakeToken = `mock.${btoa(JSON.stringify(payload))}.mock`;
    return jsonResponse({ token: fakeToken, user: persona });
  }

  if (path === '/api/auth/esign') {
    return jsonResponse({
      eSignTxHash: '0xmock-esign-hash-' + Date.now(),
      signedAt: new Date().toISOString()
    });
  }

  if ((path === '/api/dlpi/seed' || path === '/api/dlpi') && method === 'POST') {
    const { dlpiId, surveyNumber, khasraNo, gram, tehsil, district, areaHectares, landType, owners, ownerName, ownerAadhaar } = body;
    const newParcel = {
      dlpiId: dlpiId || `DLPI-UP-${tehsil || 'DAD'}-${Math.floor(10000 + Math.random() * 90000)}`,
      surveyNumber: surveyNumber || '101/2',
      khasraNo: khasraNo || '101',
      gram: gram || 'Bhangel',
      tehsil: tehsil || 'Dadri',
      district: district || 'Gautam Buddha Nagar',
      state: 'Uttar Pradesh',
      areaHectares: Number(areaHectares || 1.25),
      landType: landType || 'Agricultural',
      encumbranceStatus: 'CLEAR',
      claimStatus: 'SEEDED_UNVERIFIED',
      owners: owners || [
        {
          aadhaarHash: (ownerAadhaar || '').replace(/\D/g, ''),
          aadhaar: (ownerAadhaar || '').replace(/\D/g, ''),
          name: ownerName || 'Hi User',
          share: '1/1',
          shareDecimal: 1.0,
          ownerSince: new Date().toISOString(),
          isVerified: false,
        }
      ],
      updatedAt: new Date().toISOString(),
    };
    state.myParcels.push(newParcel as any);
    return jsonResponse(newParcel);
  }

  if (path === '/api/dlpi/my-parcels') {
    // Get the currently logged-in user from the auth header
    const authHeader = (options.headers as Record<string, string>)?.['Authorization'] || '';
    const tokenPayload = authHeader.startsWith('Bearer mock.') ? JSON.parse(atob(authHeader.split('.')[1])) : null;
    const myAadhaar = tokenPayload?.aadhaarNumber || tokenPayload?.aadhaarHash || tokenPayload?.aadhaar || tokenPayload?.aadhaarNo || '';
    // Filter to only return parcels that belong to this user
    const myParcels = myAadhaar
      ? state.myParcels.filter(p => {
          const owners = (p as any).owners || (p as any).initialOwners || [];
          if (owners.length > 0) return owners.some((o: any) => o.aadhaarNumber === myAadhaar || o.aadhaarHash === myAadhaar || o.aadhaar === myAadhaar || o.aadhaarNo === myAadhaar || (o.name && o.name === tokenPayload?.name));
          // Fallback: check by name for demo parcels
          const persona = Object.values(DEMO_PERSONAS).find((p: any) => p.aadhaarNumber === myAadhaar || p.aadhaarHash === myAadhaar || p.aadhaar === myAadhaar) as any;
          return persona && (p as any).owner?.name === persona.name;
        })
      : state.myParcels;
    return jsonResponse(myParcels);
  }

  if (path === '/api/dlpi/pending-review') {
    return jsonResponse(state.pendingReview);
  }

  if (path.match(/^\/api\/dlpi\/[^\/]+$/)) {
    const dlpiId = path.split('/')[3];
    const parcel = state.myParcels.find(p => p.dlpiId === dlpiId) || DEMO_DLPI;
    return jsonResponse(parcel);
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

  if (path.match(/^\/api\/dlpi\/[^\/]+\/ci-review$/)) {
    const dlpiId = path.split('/')[3];
    const parcel = state.myParcels.find(p => p.dlpiId === dlpiId);
    if (parcel) {
      parcel.claimStatus = 'CI_APPROVED';
    }
    return jsonResponse({ dlpiId, claimStatus: 'CI_APPROVED' });
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

  // ── Succession routes ───────────────────────────────────────────────────────

  if (path === '/api/succession/initiate' && method === 'POST') {
    const { dlpiId, deceasedName, heirs } = body;
    const caseId = 'SUC-' + dlpiId + '-' + Math.random().toString(36).slice(2, 8);
    const successionCase = {
      caseId,
      dlpiId,
      deceasedName,
      status: 'AWAITING_CONSENTS',
      heirs: (heirs || []).map((h: any, i: number) => ({
        heirId: `HEIR-DYN-${i+1}`,
        name: h.name || 'Unknown',
        aadhaarHash: (h.aadhaar || '').replace(/\D/g, ''), // normalize — store raw digits
        hasConsented: false,
        hasObjected: false,
        finalShare: `1/${heirs.length}`,
        finalShareDec: 1 / heirs.length,
      })),
      createdAt: new Date().toISOString(),
    };
    state.pendingSuccessions.push(successionCase);
    return jsonResponse({ caseId, status: 'AWAITING_CONSENTS', heirs: successionCase.heirs });
  }

  if (path === '/api/succession/my-pending' && method === 'GET') {
    // Parse the logged-in user's Aadhaar from the Bearer mock token
    const authHeader = (options.headers as Record<string, string>)?.['Authorization'] || '';
    const tokenPayload = authHeader.startsWith('Bearer mock.') ? JSON.parse(atob(authHeader.split('.')[1])) : null;
    const myAadhaar = (tokenPayload?.aadhaarNumber || tokenPayload?.aadhaarHash || '').replace(/\D/g, '');
    const pending = state.pendingSuccessions.filter(sc => {
      if (sc.status !== 'AWAITING_CONSENTS') return false;
      const heir = sc.heirs?.find((h: any) => h.aadhaarHash.replace(/\D/g, '') === myAadhaar);
      return heir && !heir.hasConsented;
    });
    return jsonResponse(pending);
  }

  if (path.match(/^\/api\/succession\/[^\/]+\/consent$/) && method === 'POST') {
    const caseId = path.split('/')[3];
    const { heirAadhaarHash } = body;
    const sc = state.pendingSuccessions.find(c => c.caseId === caseId);
    if (sc) {
      const heir = sc.heirs?.find((h: any) => h.aadhaarHash.replace(/\D/g, '') === (heirAadhaarHash || '').replace(/\D/g, ''));
      if (heir) heir.hasConsented = true;
      const allConsented = sc.heirs?.every((h: any) => h.hasConsented);
      if (allConsented) sc.status = 'PENDING_TEHSILDAR_APPROVAL';
    }
    return jsonResponse({ caseId, status: sc?.status || 'AWAITING_CONSENTS' });
  }

  if (path.match(/^\/api\/succession\/[^\/]+\/execute$/) && method === 'POST') {
    const caseId = path.split('/')[3];
    const sc = state.pendingSuccessions.find(c => c.caseId === caseId);
    if (!sc) return jsonResponse({ error: 'CASE_NOT_FOUND' }, 404);

    sc.status = 'COMPLETED';

    // Atomically mutate DLPI property in state.myParcels
    const parcel = state.myParcels.find(p => p.dlpiId === sc.dlpiId);
    if (parcel && sc.heirs && sc.heirs.length > 0) {
      const newOwners = sc.heirs.map((h: any) => ({
        name: h.name || 'Legal Heir',
        aadhaarNumber: (h.aadhaarHash || '').replace(/\D/g, ''),
        aadhaarHash: (h.aadhaarHash || '').replace(/\D/g, ''),
        share: h.finalShare || `1/${sc.heirs.length}`,
        shareDecimal: h.finalShareDec || (1.0 / sc.heirs.length),
        ownerSince: new Date().toISOString(),
        isVerified: true
      }));
      (parcel as any).owners = newOwners;
      (parcel as any).owner = { name: newOwners[0].name, aadhaarNumber: newOwners[0].aadhaarNumber };
      (parcel as any).ownershipType = newOwners.length > 1 ? 'JOINT' : 'SOLE';
      (parcel as any).encumbranceStatus = 'CLEAR';
    }

    return jsonResponse(sc);
  }

  if (path.match(/^\/api\/succession\/[^\/]+$/) && method === 'GET') {
    const caseId = path.split('/')[3];
    const sc = state.pendingSuccessions.find(c => c.caseId === caseId);
    if (sc) return jsonResponse(sc);
    return jsonResponse({ error: 'CASE_NOT_FOUND' }, 404);
  }

  // ── Property Transfer (Real & Atomic with Aadhaar Numbers) ──────────────────

  if (path === '/api/transfer/initiate' && method === 'POST') {
    const { dlpiId, buyerName, declaredValueINR } = body;
    const sellerAadhaarNumber = (body.sellerAadhaarNumber || body.sellerAadhaar || body.sellerAadhaarHash || '').replace(/\D/g, '');
    const buyerAadhaarNumber = (body.buyerAadhaarNumber || body.buyerAadhaar || body.buyerAadhaarHash || '').replace(/\D/g, '');

    if (!sellerAadhaarNumber || !buyerAadhaarNumber) {
      return jsonResponse({ error: 'VALIDATION_ERROR', message: 'Seller Aadhaar Number and Buyer Aadhaar Number (exact 12 digits) are required.' }, 400);
    }

    // Verify seller ownership ("make sure seller must have property before sell")
    const parcel = state.myParcels.find(p => p.dlpiId === dlpiId);
    if (!parcel) {
      return jsonResponse({ error: 'PARCEL_NOT_FOUND', message: `Property ${dlpiId} not found on the blockchain.` }, 404);
    }

    const owners = (parcel as any).owners || [];
    const isOwner = owners.some((o: any) => {
      const oNum = (o.aadhaarNumber || o.aadhaarHash || o.aadhaar || '').replace(/\D/g, '');
      return oNum === sellerAadhaarNumber || (o.name && o.name === body.sellerName);
    });

    if (!isOwner) {
      return jsonResponse({
        error: 'OWNERSHIP_DENIED',
        message: `Seller (Aadhaar: ${sellerAadhaarNumber}) is not the registered owner of property ${dlpiId}. Only the verified owner can initiate a sale.`
      }, 403);
    }

    if ((parcel as any).transferLocked || (parcel as any).encumbranceStatus === 'UNDER_TRANSFER') {
      return jsonResponse({ error: 'TRANSFER_LOCKED', message: `Property ${dlpiId} is already locked for an ongoing transfer or dispute.` }, 403);
    }

    // Lock property during atomic transfer
    (parcel as any).transferLocked = true;
    (parcel as any).encumbranceStatus = 'UNDER_TRANSFER';

    const transferId = 'TRF-' + dlpiId + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const sellerName = (parcel as any).owner?.name || owners[0]?.name || body.sellerName || 'Seller';

    const newTransfer = {
      transferId,
      dlpiId,
      sellerName,
      sellerAadhaarNumber,
      buyerName: buyerName || 'Buyer',
      buyerAadhaarNumber,
      declaredValueINR: Number(declaredValueINR || 0),
      status: 'PENDING_BUYER_CONSENT', // notification sent to buyer
      initiatedAt: new Date().toISOString(),
      sellers: [{ name: sellerName, aadhaarNumber: sellerAadhaarNumber }],
      buyers: [{ name: buyerName || 'Buyer', aadhaarNumber: buyerAadhaarNumber }],
      history: [
        { action: 'INITIATED', actor: sellerName, timestamp: new Date().toISOString(), status: 'PENDING_BUYER_CONSENT', note: `Property sale initiated at ₹${declaredValueINR}` }
      ]
    };

    state.pendingTransfers.push(newTransfer);
    return jsonResponse(newTransfer, 201);
  }

  if (path === '/api/transfer/my-pending' && method === 'GET') {
    const authHeader = (options.headers as Record<string, string>)?.['Authorization'] || '';
    const tokenPayload = authHeader.startsWith('Bearer mock.') ? JSON.parse(atob(authHeader.split('.')[1])) : null;
    const myAadhaar = (tokenPayload?.aadhaarNumber || tokenPayload?.aadhaarHash || tokenPayload?.aadhaar || '').replace(/\D/g, '');
    const myName = tokenPayload?.name || '';

    // Return transfers waiting for this buyer's eSign
    const pendingBuyer = state.pendingTransfers.filter(t => {
      if (t.status !== 'PENDING_BUYER_CONSENT') return false;
      return t.buyerAadhaarNumber === myAadhaar || (myName && t.buyerName === myName);
    });
    return jsonResponse(pendingBuyer);
  }

  if (path === '/api/transfer/pending/all' && method === 'GET') {
    // Return all non-completed transfers for officer dashboard queue
    return jsonResponse(state.pendingTransfers.filter(t => t.status !== 'COMPLETED' && t.status !== 'REJECTED'));
  }

  if (path.match(/^\/api\/transfer\/[^\/]+\/consent$/) && method === 'POST') {
    const transferId = path.split('/')[3];
    const { partyType } = body;
    const transfer = state.pendingTransfers.find(t => t.transferId === transferId);
    if (!transfer) return jsonResponse({ error: 'TRANSFER_NOT_FOUND' }, 404);

    if (partyType === 'BUYER' || !partyType) {
      transfer.status = 'PENDING_PATWARI_APPROVAL'; // Moves to Patwari
      transfer.history.push({
        action: 'BUYER_ESIGNED',
        actor: transfer.buyerName,
        timestamp: new Date().toISOString(),
        status: 'PENDING_PATWARI_APPROVAL',
        note: 'Buyer consented and eSigned purchase agreement.'
      });
    }
    return jsonResponse(transfer);
  }

  if (path.match(/^\/api\/transfer\/[^\/]+\/approve\/patwari$/) && method === 'POST') {
    const transferId = path.split('/')[3];
    const transfer = state.pendingTransfers.find(t => t.transferId === transferId);
    if (!transfer) return jsonResponse({ error: 'TRANSFER_NOT_FOUND' }, 404);

    transfer.status = 'PENDING_KANUNGO_APPROVAL'; // Moves to Kanungo
    transfer.history.push({
      action: 'PATWARI_APPROVED',
      actor: 'Patwari (Officer)',
      timestamp: new Date().toISOString(),
      status: 'PENDING_KANUNGO_APPROVAL',
      note: 'Patwari verified land records and physical boundaries.'
    });
    return jsonResponse(transfer);
  }

  if ((path.match(/^\/api\/transfer\/[^\/]+\/approve\/ci$/) || path.match(/^\/api\/transfer\/[^\/]+\/approve\/kanungo$/)) && method === 'POST') {
    const transferId = path.split('/')[3];
    const transfer = state.pendingTransfers.find(t => t.transferId === transferId);
    if (!transfer) return jsonResponse({ error: 'TRANSFER_NOT_FOUND' }, 404);

    transfer.status = 'PENDING_TEHSILDAR_APPROVAL'; // Moves to Tehsildar
    transfer.history.push({
      action: 'KANUNGO_APPROVED',
      actor: 'Kanungo / CI (Officer)',
      timestamp: new Date().toISOString(),
      status: 'PENDING_TEHSILDAR_APPROVAL',
      note: 'Kanungo secondary verification completed.'
    });
    return jsonResponse(transfer);
  }

  if ((path.match(/^\/api\/transfer\/[^\/]+\/approve\/tehsildar$/) || path.match(/^\/api\/transfer\/[^\/]+\/approve\/sro$/)) && method === 'POST') {
    const transferId = path.split('/')[3];
    const transfer = state.pendingTransfers.find(t => t.transferId === transferId);
    if (!transfer) return jsonResponse({ error: 'TRANSFER_NOT_FOUND' }, 404);

    // ATOMIC TRANSFER OF PROPERTY OWNERSHIP
    const parcel = state.myParcels.find(p => p.dlpiId === transfer.dlpiId);
    if (parcel) {
      (parcel as any).owner = { name: transfer.buyerName, aadhaarNumber: transfer.buyerAadhaarNumber };
      (parcel as any).owners = [{
        name: transfer.buyerName,
        aadhaarNumber: transfer.buyerAadhaarNumber,
        aadhaarHash: transfer.buyerAadhaarNumber,
        share: '1/1',
        shareDecimal: 1.0,
        ownerSince: new Date().toISOString(),
        isVerified: true
      }];
      (parcel as any).encumbranceStatus = 'CLEAR';
      (parcel as any).transferLocked = false;
      (parcel as any).updatedAt = new Date().toISOString();
    }

    transfer.status = 'COMPLETED';
    transfer.history.push({
      action: 'TEHSILDAR_EXECUTED',
      actor: 'Tehsildar (Magistrate)',
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
      note: `Atomic mutation complete. Ownership transferred to ${transfer.buyerName}.`
    });
    return jsonResponse(transfer);
  }

  if (path.match(/^\/api\/transfer\/[^\/]+\/history$/) && method === 'GET') {
    const transferId = path.split('/')[3];
    const transfer = state.pendingTransfers.find(t => t.transferId === transferId);
    return jsonResponse(transfer?.history || []);
  }

  if (path.match(/^\/api\/transfer\/[^\/]+$/) && method === 'GET') {
    const transferId = path.split('/')[3];
    const transfer = state.pendingTransfers.find(t => t.transferId === transferId);
    if (!transfer) return jsonResponse({ error: 'TRANSFER_NOT_FOUND' }, 404);
    return jsonResponse(transfer);
  }

  return jsonResponse({ error: 'MOCK_NOT_FOUND', message: 'Mock route not implemented' }, 404);
}
