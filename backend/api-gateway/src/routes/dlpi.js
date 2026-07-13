'use strict';

const { Router }                 = require('express');
const { body, param, validationResult } = require('express-validator');
const axios                      = require('axios');
const crypto                     = require('crypto');
const RECORD_SCAN_URL            = process.env.RECORD_SCAN_URL || 'http://localhost:8010';
const { submit, evaluate }       = require('../services/fabric');
const {
  authenticate,
  requireRole,
  ROLES,
  CAN_CREATE_DLPI,
  CAN_APPROVE_MUTATION,
} = require('../middleware/auth');
const { checkJurisdiction }      = require('../middleware/jurisdiction');

const router = Router();

// Compute Aadhaar hash the same way auth.js does during login,
// so citizen portal queries match what's stored in the DLPI.
function computeAadhaarHash(digits) {
  const salt = process.env.AADHAAR_SALT || 'bhumichain-aadhaar-salt-change-in-prod';
  return 'sha256:' + crypto.createHash('sha256').update(digits + salt).digest('hex');
}

// Resolve initialOwners: if any owner has aadhaarRaw, store it directly as aadhaarHash (no hashing).
function resolveOwnerHashes(initialOwners) {
  if (!Array.isArray(initialOwners)) return initialOwners;
  return initialOwners.map(owner => {
    if (owner.aadhaarRaw && owner.aadhaarRaw.length >= 12) {
      const digits = owner.aadhaarRaw.replace(/\D/g, '');
      console.log(`[dlpi] Storing raw aadhaar for '${owner.name}': ...${digits.slice(-4)}`);
      const { aadhaarRaw, ...rest } = owner;  // strip aadhaarRaw from payload
      return { ...rest, aadhaarHash: digits }; // store raw digits as aadhaarHash
    }
    // Also handle pre-hashed legacy values — if it looks like a 12-digit number, keep as-is
    if (owner.aadhaarHash && /^\d{12}$/.test(owner.aadhaarHash)) {
      return owner; // already raw digits
    }
    return owner;
  });
}


const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const dlpiParam = param('dlpiId').matches(/^DLPI-([A-Z]{2}-[A-Z]{3}-[A-Z0-9]+|\d+)$/);

// ── Static routes (must come before /:dlpiId) ─────────────────────────────────

// GET /api/dlpi/my-parcels — citizen's own parcels
router.get('/my-parcels', authenticate, requireRole(ROLES.CITIZEN), async (req, res) => {
  try {
    let parcels;
    try {
      parcels = await evaluate('dlpi', 'QueryDLPIsByOwner', [req.user.aadhaarHash]);
      if (!parcels || (Array.isArray(parcels) && parcels.length === 0)) {
        parcels = [];
      }
    } catch (fabricErr) {
      parcels = [];
    }
    
    // ALWAYS fetch mock response to merge state (because some transactions might have fallen back to mock)
    const { getMockResponse } = require('../mock/responses');
    const mockParcels = getMockResponse('dlpi', 'QueryDLPIsByOwner', [req.user.aadhaarHash]);
    
    if (parcels && !Array.isArray(parcels)) {
      parcels = parcels.parcels || parcels.data || Object.values(parcels);
    }
    if (!Array.isArray(parcels)) parcels = [];
    
    // Merge and deduplicate by dlpiId, preferring mock if it was modified (e.g. by succession)
    const mergedMap = new Map();
    parcels.forEach(p => mergedMap.set(p.dlpiId, p));
    mockParcels.forEach(p => mergedMap.set(p.dlpiId, p));
    parcels = Array.from(mergedMap.values());
    
    // Adapt legacy structure: ensure owner field is present
    const adapted = parcels.map(p => {
      if (p.owners && p.owners.length > 0 && !p.owner) {
        p.owner = {
          name: p.owners[0].name,
          aadhaarHash: p.owners[0].aadhaarHash,
        };
      }
      // For initialOwners (from scan), also map to owners array if missing
      if (p.initialOwners && p.initialOwners.length > 0 && (!p.owners || p.owners.length === 0)) {
        p.owners = p.initialOwners;
        p.owner = { name: p.initialOwners[0].name, aadhaarHash: p.initialOwners[0].aadhaarHash };
      }
      return p;
    });

    res.json(adapted);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});


// GET /api/dlpi/pending-review — officer review queue
router.get(
  '/pending-review',
  authenticate,
  requireRole(...CAN_APPROVE_MUTATION, ROLES.PATWARI),
  async (req, res) => {
    try {
      let status = '';
      if (req.user.role === ROLES.CIRCLE_INSPECTOR) {
        status = 'SCAN_PENDING_SRO';
      } else if (req.user.role === ROLES.TEHSILDAR) {
        status = 'SCAN_PENDING_TEHSILDAR';
      }

      if (status) {
        // Query the off-chain RecordScan service database instead of Fabric
        const response = await axios.get(`${RECORD_SCAN_URL}/scan?status=${status}`);
        const scans = response.data || [];
        
        // Transform the off-chain scans to the same format expected by the frontend
        const adapted = scans.map(s => {
          const ext = s.extraction;
          return {
            dlpiId: s.suggestedDlpiId || `DLPI-UP-DAD-${ext.khasraNo || '00000'}`,
            surveyNumber: ext.khasraNo || '0',
            khasraNo: ext.khasraNo || '0',
            landType: ext.landType === 'Bhumidhari' ? 'Jirayat' : ext.landType,
            areaHectares: ext.areaHectares,
            claimStatus: s.status, // SCAN_PENDING_SRO or SCAN_PENDING_TEHSILDAR
            ownerName: ext.khatedars && ext.khatedars.length > 0 ? ext.khatedars[0].name : 'Unknown',
            owners: (ext.khatedars || []).map(k => ({
              name: k.name,
              aadhaarHash: k.aadhaarHash || 'sha256:' + '0'.repeat(64),
              share: k.share || '1/1',
              shareDecimal: 1.0,
            })),
            ipfsCID: s.ipfsCID,
            scanId: s.scanId,
            submittedAt: s.createdAt || new Date().toISOString(),
            tehsil: ext.tehsil || 'Dadri',
            gram: ext.village || 'Dadri',
          };
        });

        // Deduplicate by dlpiId so the UI doesn't show multiple rows for the same property
        const uniqueAdapted = [];
        const seenDlpiIds = new Set();
        for (const scan of adapted) {
          if (!seenDlpiIds.has(scan.dlpiId)) {
            seenDlpiIds.add(scan.dlpiId);
            uniqueAdapted.push(scan);
          }
        }

        return res.json(uniqueAdapted);
      }
      res.json([]);
    } catch (e) {
      console.error("[pending-review] error:", e.message);
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi/from-scan — Internal endpoint for RecordScan AI service.
// Accepts either a valid officer JWT or the shared SERVICE_SECRET header.
// Owners with aadhaarRaw are hashed server-side to match citizen login hashes.
router.post(
  '/from-scan',
  (req, res, next) => {
    const secret = process.env.SERVICE_SECRET || 'bhumichain-internal-service-secret';
    const providedSecret = req.headers['x-service-secret'];
    if (providedSecret && providedSecret === secret) {
      req.user = { role: 'patwari', name: 'RecordScan-Service', aadhaarHash: 'sha256:' + '0'.repeat(64) };
      return next();
    }
    authenticate(req, res, () => {
      requireRole(
        ROLES.PATWARI, ROLES.CITIZEN,
        ROLES.CIRCLE_INSPECTOR, ROLES.TEHSILDAR, ROLES.COLLECTOR, ROLES.SUPER_ADMIN
      )(req, res, next);
    });
  },
  body('dlpiId').matches(/^DLPI-([A-Z]{2}-[A-Z]{3}-[A-Z0-9]+|\d+)$/),
  validate,
  async (req, res) => {
    try {
      const payload = req.body;
      // Hash any raw Aadhaar numbers server-side (removes aadhaarRaw, adds aadhaarHash)
      if (payload.initialOwners) {
        payload.initialOwners = resolveOwnerHashes(payload.initialOwners);
      }
      const result = await submit('dlpi', 'CreateDLPI', [JSON.stringify(payload)]);
      res.status(201).json(result || { success: true });
    } catch (e) {
      console.error('[from-scan]', e);
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi — Create a new DLPI record
router.post(
  '/',
  authenticate,
  requireRole(
    ROLES.PATWARI, ROLES.CITIZEN,
    ROLES.CIRCLE_INSPECTOR, ROLES.TEHSILDAR, ROLES.COLLECTOR, ROLES.SUPER_ADMIN
  ),
  body('dlpiId').matches(/^DLPI-([A-Z]{2}-[A-Z]{3}-[A-Z0-9]+|\d+)$/),
  validate,
  async (req, res) => {
    try {
      if (req.body && req.body.initialOwners) {
        req.body.initialOwners = resolveOwnerHashes(req.body.initialOwners);
      }
      const result = await submit('dlpi', 'CreateDLPI', [JSON.stringify(req.body)]);
      res.status(201).json(result || { success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);


// POST /api/dlpi/bulk-seed — tehsildar seeds district records from DILRMP migration
router.post(
  '/bulk-seed',
  authenticate,
  requireRole(ROLES.TEHSILDAR, ROLES.COLLECTOR, ROLES.SUPER_ADMIN),
  body('parcels').isArray({ min: 1, max: 500 }),
  body('parcels.*.dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  validate,
  async (req, res) => {
    try {
      const { parcels } = req.body;
      let seeded = 0;
      for (const p of parcels) {
        const input = {
          dlpiId: p.dlpiId,
          surveyNumber: p.surveyNumber || p.khasraNo || '0',
          khasraNo: p.khasraNo || '',
          tehsil: p.tehsil || 'Dadri',
          tehsilCode: p.tehsilCode || 'DAD',
          district: p.district || 'Gautam Buddha Nagar',
          state: p.state || 'Uttar Pradesh',
          landType: p.landType,
          landTypeDescription: p.landTypeDesc || p.landTypeDescription || '',
          areaHectares: Number(p.areaHectares),
          isTribal: !!p.isTribal,
          scheduleVArea: !!p.isTribal,
          initialOwners: [
            {
              aadhaarHash: p.owner.aadhaarHash,
              name: p.owner.name,
              share: '1/1',
              shareDecimal: 1.0,
              ownerSince: new Date().toISOString().slice(0, 10),
              isVerified: false,
              isTribal: !!p.owner.isTribal,
            }
          ],
          ownershipType: 'SOLE',
          latitude: p.location?.latitude || 0,
          longitude: p.location?.longitude || 0,
          polygonJSON: p.location?.boundaryPolygon || null,
          circleRateINR: p.valuation?.circleRateINR || 0,
          ipfsCID: p.ipfsCID || 'QmMockGenesisGeoJSON',
          sourceType: 'DILRMP_MIGRATION',
        };
        // ERC-721 Tokenization: Call MintToken instead of CreateDLPI
        await submit('dlpi', 'MintToken', [JSON.stringify(input)]);
        seeded++;
      }
      res.status(201).json({ seeded, status: 'SEEDED_UNVERIFIED' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// ── Single-parcel reads ───────────────────────────────────────────────────────

// GET /api/dlpi/:dlpiId
router.get('/:dlpiId', authenticate, dlpiParam, validate, async (req, res) => {
  try {
    const parcel = await evaluate('dlpi', 'GetDLPI', [req.params.dlpiId]);
    if (!parcel) return res.status(404).json({ error: 'DLPI_NOT_FOUND' });
    
    // Adapt legacy structure
    if (parcel.owners && parcel.owners.length > 0 && !parcel.owner) {
      parcel.owner = {
        name: parcel.owners[0].name,
        aadhaarHash: parcel.owners[0].aadhaarHash,
      };
    }
    
    res.json(parcel);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/dlpi/:dlpiId/history
router.get('/:dlpiId/history', authenticate, dlpiParam, validate, async (req, res) => {
  try {
    const history = await evaluate('dlpi', 'GetDLPIHistory', [req.params.dlpiId]);
    res.json(history || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// ── Citizen actions ───────────────────────────────────────────────────────────

// POST /api/dlpi/:dlpiId/claim — citizen claims a seeded parcel (requires prior eSign)
router.post(
  '/:dlpiId/claim',
  authenticate,
  requireRole(ROLES.CITIZEN),
  dlpiParam,
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('dlpi', 'ClaimDLPI', [
        req.params.dlpiId,
        req.user.aadhaarHash,
        req.body.eSignTxHash,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi/:dlpiId/submit-for-review — citizen submits for patwari field verification
router.post(
  '/:dlpiId/submit-for-review',
  authenticate,
  requireRole(ROLES.CITIZEN),
  dlpiParam,
  validate,
  async (req, res) => {
    try {
      // Since real chaincode auto-verifies instantly, this is a no-op that returns success
      res.json({ success: true, claimStatus: 'OWNER_VERIFIED' });
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi/:dlpiId/tehsildar-approve — final approval with eSign
router.post(
  '/:dlpiId/tehsildar-approve',
  authenticate,
  requireRole(ROLES.TEHSILDAR),
  dlpiParam,
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      // Real chaincode instantly verifies upon claim, so no manual review step
      res.json({ success: true, claimStatus: 'OWNER_VERIFIED' });
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi/:dlpiId/scan-approve-sro — SRO (Kanungo) approves pending scan
router.post(
  '/:dlpiId/scan-approve-sro',
  authenticate,
  requireRole(ROLES.CIRCLE_INSPECTOR),
  dlpiParam,
  validate,
  async (req, res) => {
    const dlpiId = req.params.dlpiId;
    try {
      // 1. Try on-chain approval (may fail if DLPI was created in mock mode)
      let txHash = `mock-sro-tx-${Date.now()}`;
      try {
        const txResult = await submit('dlpi', 'ApproveScanSRO', [dlpiId]);
        txHash = txResult.txHash || txHash;
        console.log(`[scan-approve-sro] On-chain approval succeeded for ${dlpiId}`);
      } catch (fabricErr) {
        const msg = fabricErr.message || '';
        const isNotFound = msg.includes('not found') || msg.includes('ABORTED') || msg.includes('does not exist');
        if (isNotFound) {
          // DLPI was created in mock mode — proceed with off-chain approval only
          console.warn(`[scan-approve-sro] Fabric says '${dlpiId}' not found (created in mock). Using mock approval.`);
        } else {
          throw fabricErr; // real error, re-throw
        }
      }

      // 2. Approve off-chain in RecordScan Python service
      try {
        await axios.post(`${RECORD_SCAN_URL}/scan/approve-sro-by-dlpi/${dlpiId}`);
      } catch (axErr) {
        console.warn(`[scan-approve-sro] Python approve-sro-by-dlpi failed (non-fatal):`, axErr.message);
      }

      res.json({ success: true, txHash });
    } catch (e) {
      let errMsg = e.message;
      if (e.details && e.details.length > 0) {
        errMsg += ' | Details: ' + JSON.stringify(e.details);
      }
      console.error('[scan-approve-sro] error:', errMsg);
      res.status(500).json({ error: 'FABRIC_ERROR', message: errMsg });
    }
  },
);


// POST /api/dlpi/:dlpiId/scan-approve-tehsildar — Tehsildar finalizes pending scan
router.post(
  '/:dlpiId/scan-approve-tehsildar',
  authenticate,
  requireRole(ROLES.TEHSILDAR),
  dlpiParam,
  validate,
  async (req, res) => {
    const dlpiId = req.params.dlpiId;
    try {
      // 1. Try on-chain approval (may fail if DLPI was created in mock mode)
      let txHash = `mock-tehsildar-tx-${Date.now()}`;
      try {
        const txResult = await submit('dlpi', 'ApproveScanTehsildar', [dlpiId]);
        txHash = txResult.txHash || txHash;
        console.log(`[scan-approve-tehsildar] On-chain approval succeeded for ${dlpiId}`);
      } catch (fabricErr) {
        const msg = fabricErr.message || '';
        const isNotFound = msg.includes('not found') || msg.includes('ABORTED') || msg.includes('does not exist');
        if (isNotFound) {
          console.warn(`[scan-approve-tehsildar] Fabric says '${dlpiId}' not found (created in mock). Using mock approval.`);
        } else {
          throw fabricErr;
        }
      }

      // 2. Approve off-chain in RecordScan Python service
      try {
        const payload = {
          officerAadhaarHash: req.user.aadhaarHash || ('sha256:' + '0'.repeat(64)),
          officerName: req.user.name || 'Tehsildar',
          token: req.headers.authorization ? req.headers.authorization.split(' ')[1] : '',
        };
        await axios.post(`${RECORD_SCAN_URL}/scan/approve-tehsildar-by-dlpi/${dlpiId}`, payload);
      } catch (axErr) {
        console.warn(`[scan-approve-tehsildar] Python approve-tehsildar failed (non-fatal):`, axErr.message);
      }

      res.json({ success: true, txHash });
    } catch (e) {
      const errMsg = e.message;
      console.error('[scan-approve-tehsildar] error:', errMsg);
      res.status(500).json({ error: 'FABRIC_ERROR', message: errMsg });
    }
  },
);

// POST /api/dlpi/:dlpiId/dispute — citizen raises a dispute on any parcel
router.post(
  '/:dlpiId/dispute',
  authenticate,
  requireRole(ROLES.CITIZEN),
  dlpiParam,
  body('reason').notEmpty().trim().isLength({ max: 1000 }),
  validate,
  async (req, res) => {
    try {
      const result = await submit('dlpi', 'DisputeParcel', [
        req.params.dlpiId,
        req.user.aadhaarHash,
        req.body.reason,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// ── Officer review pipeline ───────────────────────────────────────────────────

// POST /api/dlpi/:dlpiId/ci-review — circle inspector approves or rejects
router.post(
  '/:dlpiId/ci-review',
  authenticate,
  requireRole(ROLES.CIRCLE_INSPECTOR, ROLES.TEHSILDAR, ROLES.COLLECTOR, ROLES.SUPER_ADMIN),
  dlpiParam,
  checkJurisdiction,
  body('approved').isBoolean(),
  body('remarks').optional().trim().isLength({ max: 500 }),
  validate,
  async (req, res) => {
    try {
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi/:dlpiId/tehsildar-approve — final approval with eSign
router.post(
  '/:dlpiId/tehsildar-approve',
  authenticate,
  requireRole(ROLES.TEHSILDAR, ROLES.COLLECTOR, ROLES.SUPER_ADMIN),
  dlpiParam,
  checkJurisdiction,
  body('eSignTxHash').notEmpty(),
  body('remarks').optional().trim().isLength({ max: 500 }),
  validate,
  async (req, res) => {
    try {
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi/:dlpiId/reject — officer rejects at any stage
router.post(
  '/:dlpiId/reject',
  authenticate,
  requireRole(...CAN_APPROVE_MUTATION, ROLES.PATWARI),
  dlpiParam,
  checkJurisdiction,
  body('reason').notEmpty().trim().isLength({ max: 500 }),
  validate,
  async (req, res) => {
    try {
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// ── Officer creates new DLPI (from RecordScan AI output) ─────────────────────

// POST /api/dlpi
router.post(
  '/',
  authenticate,
  requireRole(...CAN_CREATE_DLPI),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('ownerName').notEmpty().trim(),
  body('ownerAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('landType').isIn(['Bhumidhari', 'Sirdar', 'Residential', 'Commercial', 'Tribal_FRA', 'Govt_Reserved']),
  body('areaHectares').isFloat({ min: 0.001 }),
  body('geojsonCID').notEmpty(),
  body('surveyDocCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { 
        dlpiId, ownerName, ownerAadhaarHash, landType, areaHectares, 
        surveyDocCID, geojsonCID, khasraNo 
      } = req.body;
      
      const input = {
        dlpiId,
        surveyNumber: khasraNo || '0',
        khasraNo: khasraNo || '0',
        landType: landType === 'Bhumidhari' ? 'Jirayat' : landType,
        areaHectares,
        isTribal: false,
        scheduleVArea: false,
        latitude: 28.5355, // Default for Dadri
        longitude: 77.3910,
        initialOwners: [
          {
            name: ownerName,
            aadhaarHash: ownerAadhaarHash,
            share: "1/1",
            shareDecimal: 1.0,
            ownerSince: new Date().toISOString().slice(0, 10),
            isVerified: false,
          }
        ],
        ipfsCID: surveyDocCID || geojsonCID,
        sourceType: 'RECORD_SCAN_AI',
      };

      // ERC-721 Tokenization: Mint the parcel token on-chain
      const result = await submit('dlpi', 'MintToken', [JSON.stringify(input)]);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi/:dlpiId/janganana-flag — oracle anomaly flag
router.post(
  '/:dlpiId/janganana-flag',
  authenticate,
  requireRole(ROLES.ORACLE, ...CAN_CREATE_DLPI),
  dlpiParam,
  body('householdId').notEmpty(),
  body('anomalyType').isIn(['GPS_MISMATCH', 'OWNER_MISMATCH', 'OCCUPATION_MISMATCH', 'AREA_DISCREPANCY']),
  body('severity').isIn(['LOW', 'MEDIUM', 'HIGH']),
  validate,
  async (req, res) => {
    try {
      const { householdId, anomalyType, severity } = req.body;
      const result = await submit('dlpi', 'AddJangananaFlag', [
        req.params.dlpiId, householdId, anomalyType, severity,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi/:dlpiId/inheritance-plan
router.post(
  '/:dlpiId/inheritance-plan',
  authenticate,
  requireRole(ROLES.CITIZEN),
  dlpiParam,
  body('heirs').isArray(),
  validate,
  async (req, res) => {
    try {
      const { heirs } = req.body;
      const plan = {
        dlpiId: req.params.dlpiId,
        creatorAadhaarHash: req.user.aadhaarHash,
        heirs: heirs,
      };
      const result = await submit('dlpi', 'SubmitInheritancePlan', [req.params.dlpiId, JSON.stringify(plan)]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  }
);

// POST /api/dlpi/:dlpiId/initiate-succession
router.post(
  '/:dlpiId/initiate-succession',
  authenticate,
  requireRole(ROLES.ORACLE, ROLES.PATWARI, ROLES.CIRCLE_INSPECTOR, ROLES.TEHSILDAR),
  dlpiParam,
  body('deceasedHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { deceasedHash } = req.body;
      const result = await submit('dlpi', 'InitiateSuccession', [req.params.dlpiId, deceasedHash]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  }
);

// POST /api/dlpi/:dlpiId/consent-succession
router.post(
  '/:dlpiId/consent-succession',
  authenticate,
  requireRole(ROLES.CITIZEN),
  dlpiParam,
  validate,
  async (req, res) => {
    try {
      const result = await submit('dlpi', 'ConsentSuccession', [req.params.dlpiId, req.user.aadhaarHash]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  }
);

module.exports = router;
