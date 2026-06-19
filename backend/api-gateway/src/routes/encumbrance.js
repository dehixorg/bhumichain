'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const axios = require('axios');
const { submit, evaluate } = require('../services/fabric');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

const router = Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const ORACLE_URL = () => process.env.ORACLE_SERVICE_URL || 'http://localhost:8001';

// POST /api/encumbrance/mortgage — bank registers mortgage
router.post(
  '/mortgage',
  authenticate,
  requireRole(ROLES.BANK),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('bankName').notEmpty(),
  body('bankBranch').notEmpty(),
  body('loanAccountHashedNo').notEmpty(),
  body('loanAmountINR').isInt({ min: 1 }),
  body('cersaiRegNo').notEmpty(),
  body('mortgageDate').isISO8601(),
  body('mortgageExpiry').isISO8601(),
  body('registeredByHash').matches(/^sha256:[a-f0-9]{64}$/),
  validate,
  async (req, res) => {
    try {
      const {
        dlpiId, bankName, bankBranch, loanAccountHashedNo,
        loanAmountINR, cersaiRegNo, mortgageDate, mortgageExpiry, registeredByHash,
      } = req.body;

      // Verify CERSAI registration via oracle
      try {
        const cersaiRes = await axios.get(`${ORACLE_URL()}/cersai/verify/${cersaiRegNo}`);
        if (!cersaiRes.data.verified) {
          return res.status(400).json({ error: 'CERSAI_NOT_VERIFIED', cersaiRegNo });
        }
      } catch (e) {
        console.warn('[CERSAI Oracle] unreachable, proceeding in mock');
      }

      const result = await submit('encumbrance', 'RegisterMortgage', [
        dlpiId, bankName, bankBranch, loanAccountHashedNo,
        String(loanAmountINR), cersaiRegNo, mortgageDate, mortgageExpiry, registeredByHash,
      ]);
      res.status(201).json(result);
    } catch (e) {
      if (e.message.includes('DUAL_MORTGAGE')) {
        return res.status(409).json({ error: 'DUAL_MORTGAGE_BLOCKED', message: e.message });
      }
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/encumbrance/injunction — court injunction via eCourts oracle
router.post(
  '/injunction',
  authenticate,
  requireRole(ROLES.COLLECTOR, ROLES.REVENUE_OFFICER),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('courtName').notEmpty(),
  body('caseNumber').notEmpty(),
  body('injunctionDate').isISO8601(),
  body('injunctionType').isIn(['STAY', 'ATTACHMENT', 'FREEZE', 'PROHIBITORY']),
  body('eCourtsOracleHash').notEmpty(),
  body('registeredByHash').matches(/^sha256:[a-f0-9]{64}$/),
  validate,
  async (req, res) => {
    try {
      const {
        dlpiId, courtName, caseNumber, injunctionDate,
        injunctionType, eCourtsOracleHash, registeredByHash,
      } = req.body;
      const result = await submit('encumbrance', 'RegisterCourtInjunction', [
        dlpiId, courtName, caseNumber, injunctionDate,
        injunctionType, eCourtsOracleHash, registeredByHash,
      ]);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/encumbrance/it-attachment — IT dept registers attachment
router.post(
  '/it-attachment',
  authenticate,
  requireRole(ROLES.COLLECTOR),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('itAssessmentYear').matches(/^\d{4}-\d{2}$/),
  body('panHash').notEmpty(),
  body('itDemandAmountINR').isInt({ min: 1 }),
  body('registeredByHash').matches(/^sha256:[a-f0-9]{64}$/),
  validate,
  async (req, res) => {
    try {
      const { dlpiId, itAssessmentYear, panHash, itDemandAmountINR, registeredByHash } = req.body;
      const result = await submit('encumbrance', 'RegisterITAttachment', [
        dlpiId, itAssessmentYear, panHash, String(itDemandAmountINR), registeredByHash,
      ]);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/encumbrance/:encumbranceId/release
router.post(
  '/:encumbranceId/release',
  authenticate,
  requireRole(ROLES.BANK, ROLES.COLLECTOR, ROLES.REVENUE_OFFICER),
  body('releasedByHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('releaseDocCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('encumbrance', 'ReleaseEncumbrance', [
        req.params.encumbranceId,
        req.body.releasedByHash,
        req.body.releaseDocCID,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/encumbrance/ec/:dlpiId — generate Encumbrance Certificate
// Demo Scene 4: show 30-second EC generation
router.get(
  '/ec/:dlpiId',
  authenticate,
  param('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  validate,
  async (req, res) => {
    try {
      const ec = await submit('encumbrance', 'GenerateEC', [
        req.params.dlpiId,
        req.user.aadhaarHash || 'sha256:requestor',
      ]);
      res.json(ec);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

module.exports = router;
