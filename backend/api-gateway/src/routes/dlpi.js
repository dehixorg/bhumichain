'use strict';

const { Router }                 = require('express');
const { body, param, validationResult } = require('express-validator');
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

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const dlpiParam = param('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/);

// ── Static routes (must come before /:dlpiId) ─────────────────────────────────

// GET /api/dlpi/my-parcels — citizen's own parcels
router.get('/my-parcels', authenticate, requireRole(ROLES.CITIZEN), async (req, res) => {
  try {
    const parcels = await evaluate('dlpi', 'GetMyParcels', [req.user.aadhaarHash]);
    res.json(parcels || []);
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
      const items = await evaluate('dlpi', 'GetPendingReview', [
        req.user.tehsilCode || '',
        req.user.patwariCode || '',
      ]);
      res.json(items || []);
    } catch (e) {
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
      const result = await submit('dlpi', 'BulkSeed', [JSON.stringify(parcels)]);
      res.status(201).json({ seeded: result.seeded, status: 'SEEDED_UNVERIFIED' });
    } catch (e) {
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
      const result = await submit('dlpi', 'ClaimParcel', [
        req.params.dlpiId,
        req.body.eSignTxHash,
        req.user.aadhaarHash,
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
      const result = await submit('dlpi', 'SubmitForReview', [
        req.params.dlpiId,
        req.user.aadhaarHash,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
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
      const { approved, remarks = '' } = req.body;
      const fn     = approved ? 'CIReview' : 'RejectParcel';
      const result = await submit('dlpi', fn, [req.params.dlpiId, req.user.aadhaarHash, remarks]);
      res.json(result);
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
      const { eSignTxHash, remarks = '' } = req.body;
      const result = await submit('dlpi', 'TehsildarApprove', [
        req.params.dlpiId,
        req.user.aadhaarHash,
        eSignTxHash,
        remarks,
      ]);
      res.json(result);
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
      const result = await submit('dlpi', 'RejectParcel', [
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
      const { dlpiId, ownerName, ownerAadhaarHash, landType, areaHectares, geojsonCID, surveyDocCID } = req.body;
      const result = await submit('dlpi', 'CreateDLPI', [
        JSON.stringify({ dlpiId, ownerName, ownerAadhaarHash, landType, areaHectares, geojsonCID, surveyDocCID }),
      ]);
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

module.exports = router;
