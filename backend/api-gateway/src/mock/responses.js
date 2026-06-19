'use strict';
/**
 * Pre-scripted mock responses for all 8 demo scenes.
 * Keyed by chaincode function name. The demo NEVER breaks because
 * every external call returns from here in FABRIC_MODE=mock.
 */

const DEMO_DLPI = {
  dlpiId: 'DLPI-MH-SNN-00142',
  surveyNo: '142',
  tehsilCode: 'SNN',
  districtCode: 'MH-NSK',
  ownerName: 'Ramesh Dattatray Patil',
  ownerAadhaarHash: 'sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a',
  landType: 'Bagayat',
  areaHectares: 2.4,
  geojsonCID: 'QmSNN00142GeoJSON',
  surveyDocCID: 'QmSNN00142SurveyDoc',
  encumbranceStatus: 'CLEAR',
  transferLocked: false,
  successionStatus: null,
  jangananaFlags: [],
  blockchainTxHash: '0xfabric-tx-a1b2c3d4e5f6a7b8c9d0e1f2',
  createdAt: '2024-01-15T09:30:00Z',
  updatedAt: '2026-05-20T11:00:00Z',
};

const DEMO_TRIBAL_DLPI = {
  dlpiId: 'DLPI-MH-IGT-T0023',
  surveyNo: 'T-23',
  tehsilCode: 'IGT',
  districtCode: 'MH-NSK',
  ownerName: 'Mangal Ramji Bhil',
  ownerAadhaarHash: 'sha256:b4g9f3d2c8e1a7f0e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a',
  landType: 'Tribal_FRA',
  areaHectares: 1.8,
  geojsonCID: 'QmIGTT0023GeoJSON',
  surveyDocCID: 'QmIGTT0023SurveyDoc',
  encumbranceStatus: 'CLEAR',
  transferLocked: false,
  successionStatus: null,
  jangananaFlags: [],
  blockchainTxHash: '0xfabric-tx-t1r2i3b4a5l6g7u8a9r0',
  createdAt: '2023-06-10T10:00:00Z',
  updatedAt: '2025-12-01T08:00:00Z',
};

const DEMO_SUCCESSION_CASE = {
  caseId: 'SUC-DLPI-MH-SNN-00142-a1b2c3d4',
  dlpiId: 'DLPI-MH-SNN-00142',
  familyId: 'FAM-MH-SNN-00142-001',
  deceasedName: 'Ramesh Dattatray Patil',
  dateOfDeath: '2026-05-20',
  deathCertCID: 'QmDeathCertRamesh2026',
  crsRegistrationNo: 'CRS-NSK-2026-00541',
  applicableLaw: 'Hindu Succession Act 1956/2005',
  coparcenaryType: 'Mitakshara',
  heirs: [
    {
      heirId: 'HEIR-001',
      name: 'Arun Ramesh Patil',
      aadhaarHash: 'sha256:heir1arun3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8',
      relation: 'Son',
      gender: 'Male',
      dob: '1988-03-15',
      isAlive: true,
      isAdult: true,
      isNri: false,
      share: '1/3',
      shareDecimal: 0.3333,
      legalNote: null,
      hasConsented: false,
      hasObjected: false,
    },
    {
      heirId: 'HEIR-002',
      name: 'Vijay Ramesh Patil',
      aadhaarHash: 'sha256:heir2vijay8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7',
      relation: 'Son',
      gender: 'Male',
      dob: '1991-07-22',
      isAlive: true,
      isAdult: true,
      isNri: false,
      share: '1/3',
      shareDecimal: 0.3333,
      legalNote: null,
      hasConsented: false,
      hasObjected: false,
    },
    {
      heirId: 'HEIR-003',
      name: 'Sunita Ramesh Patil',
      aadhaarHash: 'sha256:heir3sunita1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5',
      relation: 'Daughter',
      gender: 'Female',
      dob: '1994-11-08',
      isAlive: true,
      isAdult: true,
      isNri: false,
      share: '1/3',
      shareDecimal: 0.3334,
      legalNote: 'Equal coparcenary rights per Hindu Succession (Amendment) Act 2005 Section 6(3). Daughters have same rights as sons by birth.',
      hasConsented: false,
      hasObjected: false,
    },
  ],
  totalHeirs: 3,
  status: 'AWAITING_CONSENTS',
  consentDeadline: '2026-07-10T09:30:00Z',
  aiComputationCID: 'QmCoparcenaryMapperOutputRamesh',
  aiConfidenceScore: 0.97,
  legalEdgeCases: [],
  initiatedAt: '2026-06-10T09:30:00Z',
  updatedAt: '2026-06-10T09:30:00Z',
};

const DEMO_TRANSFER = {
  transferId: 'TXF-DLPI-MH-SNN-00142-b2c3d4e5',
  dlpiId: 'DLPI-MH-SNN-00142',
  sellerAadhaarHash: 'sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a',
  buyerName: 'Suresh Balaji Deshmukh',
  buyerAadhaarHash: 'sha256:buyer1suresh9d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0',
  declaredValueINR: 4800000,
  oracleValueINR: 5200000,
  stampDutyINR: 208000,
  status: 'AWAITING_CONSENT',
  fraudScore: 0.12,
  fraudSignals: [],
  nationalLockAcquired: true,
  lockExpiry: '2026-06-11T09:30:00Z',
  consentSeller: false,
  consentBuyer: false,
  initiatedAt: '2026-06-10T09:00:00Z',
};

const DEMO_TRIBAL_REJECTION = {
  dlpiId: 'DLPI-MH-IGT-T0023',
  attemptId: 'TGA-DLPI-MH-IGT-T0023-c3d4e5f6',
  isTribalParcel: true,
  scheduleType: 'V',
  community: 'Bhil',
  decision: 'HARD_REJECTED',
  rejectionCode: 'SCHEDULE_V_NON_TRIBAL',
  rejectionReason:
    'HARD REJECT — Parcel DLPI-MH-IGT-T0023 is located in a Fifth Schedule (Scheduled Area) in ' +
    'Igatpuri tehsil, Nashik district, Maharashtra. Buyer is not a registered Scheduled Tribe member. ' +
    'Transfer of tribal land to non-tribal persons in Scheduled Areas is VOID AB INITIO per Supreme ' +
    'Court ruling in Samatha v. State of AP (1997) 8 SCC 191. No revenue officer, SRO, or digital ' +
    'signature can authorise this transaction.',
  legalCitations: [
    'Constitution of India, Fifth Schedule, Para 5(2) — Transfer of immovable property by or among members of a Scheduled Tribe in a Scheduled Area requires Governor\'s sanction',
    'Samatha v. State of Andhra Pradesh (1997) 8 SCC 191 — Supreme Court held that transfer of tribal land to non-tribals in Fifth Schedule areas is unconstitutional and void ab initio',
    'Maharashtra Land Revenue Code, Section 36A — Tribal land in Scheduled Areas cannot be transferred to non-tribal without written permission of Collector',
    'Forest Rights Act 2006, Section 4(5) — No eviction or displacement of forest dwelling Scheduled Tribes without recognition of forest rights',
  ],
  responseTimeMs: 147,
};

const DEMO_MUTATION = {
  mutationId: 'MUT-DLPI-MH-SNN-00142-d4e5f6a7',
  dlpiId: 'DLPI-MH-SNN-00142',
  mutationType: 'Inheritance',
  officerName: 'Prakash Nana Kulkarni',
  officerRank: 'Circle Officer',
  status: 'ALERT_SENT',
  alertSentAt: '2026-06-10T09:31:04Z',
  alertElapsedSeconds: 64,
  slaMet: true,
  requiresPublicNotice: true,
  publicNoticePeriodDays: 30,
  initiatedAt: '2026-06-10T09:30:00Z',
};

const DEMO_EC = {
  ecId: 'EC-DLPI-MH-SNN-00142-e5f6a7b8',
  dlpiId: 'DLPI-MH-SNN-00142',
  ownerName: 'Ramesh Dattatray Patil',
  reportPeriodFrom: '2010-01-01',
  reportPeriodTo: '2026-06-10',
  encumbrances: [],
  summary: 'CLEAR — No active encumbrances, mortgages, injunctions, or attachments on this parcel.',
  qrVerificationHash: 'ec-qr-sha256:f7e8d9c0b1a2f3e4d5c6b7a8',
  validUntil: '2026-06-11T09:45:00Z',
  generatedAt: '2026-06-10T09:45:00Z',
  generationTimeMs: 18400,
};

// Pre-scripted WebSocket events for demo scenes (fired by mock trigger endpoint)
const DEMO_WS_EVENTS = {
  scene2_dlpi_created: {
    event: 'DLPICreated',
    payload: {
      dlpiId: 'DLPI-MH-SNN-00142',
      ownerName: 'Ramesh Dattatray Patil',
      txHash: '0xfabric-tx-a1b2c3d4e5f6',
      message: 'Land parcel DLPI-MH-SNN-00142 recorded on BhumiChain',
    },
  },
  scene3_death_detected: {
    event: 'HeirNotificationRequired',
    payload: {
      caseId: 'SUC-DLPI-MH-SNN-00142-a1b2c3d4',
      dlpiId: 'DLPI-MH-SNN-00142',
      deceasedName: 'Ramesh Dattatray Patil',
      heirs: DEMO_SUCCESSION_CASE.heirs,
      applicableLaw: 'Hindu Succession Act 1956/2005',
      message: 'Death certificate verified. 3 heirs identified. Notifications dispatched via SMS & WhatsApp.',
    },
  },
  scene3_mutation_alert: {
    event: 'MutationAlert',
    payload: {
      mutationId: 'MUT-DLPI-MH-SNN-00142-d4e5f6a7',
      dlpiId: 'DLPI-MH-SNN-00142',
      alertSentWithinSeconds: 64,
      slaMet: true,
      message: '⚠️ Mutation initiated on your land parcel. You have 30 days to raise objection.',
    },
  },
  scene4_transfer_initiated: {
    event: 'TransferInitiated',
    payload: {
      transferId: 'TXF-DLPI-MH-SNN-00142-b2c3d4e5',
      dlpiId: 'DLPI-MH-SNN-00142',
      nationalLockAcquired: true,
      message: 'National parcel lock acquired. Transfer initiated. Awaiting multi-party consent.',
    },
  },
  scene5_dual_sale_rejected: {
    event: 'TransferRejected',
    payload: {
      dlpiId: 'DLPI-MH-SNN-00142',
      reason: 'NATIONAL_LOCK_ACTIVE',
      message: '🚫 REJECTED — Parcel DLPI-MH-SNN-00142 is under national transfer lock since 09:00 today. This is a DUPLICATE SALE attempt.',
      fraudScore: 0.94,
      autoRejected: true,
    },
  },
  scene6_tribal_rejected: {
    event: 'TribalTransferHardRejected',
    payload: DEMO_TRIBAL_REJECTION,
  },
  scene7_bhumi_gpt: {
    event: 'BhumiGPTResponse',
    payload: {
      query: 'माझ्या जमिनीवर मुलीचा अधिकार आहे का?',
      response: 'होय. हिंदू वारसा (सुधारणा) अधिनियम 2005 च्या कलम 6(3) नुसार, मुलगी जन्मापासूनच मिताक्षरा कोपार्सनरी मालमत्तेत सहवारस आहे. मुलाइतकाच तिचा अधिकार आहे.',
      language: 'mr',
      confidence: 0.98,
    },
  },
};

module.exports = {
  DEMO_DLPI,
  DEMO_TRIBAL_DLPI,
  DEMO_SUCCESSION_CASE,
  DEMO_TRANSFER,
  DEMO_TRIBAL_REJECTION,
  DEMO_MUTATION,
  DEMO_EC,
  DEMO_WS_EVENTS,

  // Lookup helper: return mock response for a chaincode function call
  getMockResponse(chaincode, fn, args = []) {
    const key = `${chaincode}::${fn}`;
    switch (key) {
      case 'dlpi::GetDLPI':
        if (args[0] === 'DLPI-MH-IGT-T0023') return DEMO_TRIBAL_DLPI;
        return DEMO_DLPI;
      case 'dlpi::GetDLPIHistory':
        return [
          { txId: '0xfabric-tx-000001', timestamp: '2024-01-15T09:30:00Z', action: 'DLPI_CREATED', actor: 'Revenue Dept' },
          { txId: '0xfabric-tx-000002', timestamp: '2025-03-10T11:20:00Z', action: 'ENCUMBRANCE_ADDED', actor: 'SBI Nashik Branch' },
          { txId: '0xfabric-tx-000003', timestamp: '2025-09-01T14:00:00Z', action: 'ENCUMBRANCE_RELEASED', actor: 'SBI Nashik Branch' },
        ];
      case 'property-transfer::InitiateTransfer':
        return { transferId: DEMO_TRANSFER.transferId, status: 'AWAITING_CONSENT' };
      case 'property-transfer::GetTransfer':
        return DEMO_TRANSFER;
      case 'mutation-manager::InitiateMutation':
        return { mutationId: DEMO_MUTATION.mutationId, status: 'ALERT_SENT' };
      case 'mutation-manager::GetMutation':
        return DEMO_MUTATION;
      case 'uttaradhikar::InitiateSuccession':
        return { caseId: DEMO_SUCCESSION_CASE.caseId, status: 'HEIRS_IDENTIFIED' };
      case 'uttaradhikar::GetSuccessionCase':
        return DEMO_SUCCESSION_CASE;
      case 'tribal-guard::CheckTransfer':
        return DEMO_TRIBAL_REJECTION;
      case 'encumbrance::GenerateEC':
        return DEMO_EC;
      default:
        return { success: true, txId: `mock-tx-${Date.now()}` };
    }
  },
};
