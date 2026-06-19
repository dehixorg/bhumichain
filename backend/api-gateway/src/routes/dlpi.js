'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { submit, evaluate } = require('../services/fabric');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

const router = Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

// GET /api/dlpi/:dlpiId
router.get(
  '/:dlpiId',
  authenticate,
  param('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  validate,
  async (req, res) => {
    try {
      const parcel = await evaluate('dlpi', 'GetDLPI', [req.params.dlpiId]);
      if (!parcel) return res.status(404).json({ error: 'DLPI_NOT_FOUND' });
      res.json(parcel);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/dlpi/:dlpiId/history
router.get(
  '/:dlpiId/history',
  authenticate,
  param('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  validate,
  async (req, res) => {
    try {
      const history = await evaluate('dlpi', 'GetDLPIHistory', [req.params.dlpiId]);
      res.json(history || []);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/dlpi — create a new DLPI record
// Used by RecordScan AI service after OCR + officer approval
router.post(
  '/',
  authenticate,
  requireRole(ROLES.REVENUE_OFFICER, ROLES.CIRCLE_OFFICER),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('ownerName').notEmpty().trim(),
  body('ownerAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('landType').isIn(['Bagayat', 'Jirayat', 'Kharaba', 'Tribal_FRA', 'Government', 'Forest']),
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

// POST /api/dlpi/:dlpiId/janganana-flag — Janganana integration engine flags anomaly
router.post(
  '/:dlpiId/janganana-flag',
  authenticate,
  requireRole(ROLES.ORACLE, ROLES.REVENUE_OFFICER),
  param('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('householdId').notEmpty(),
  body('anomalyType').isIn(['GPS_MISMATCH', 'OWNER_MISMATCH', 'OCCUPATION_MISMATCH', 'AREA_DISCREPANCY']),
  body('severity').isIn(['LOW', 'MEDIUM', 'HIGH']),
  validate,
  async (req, res) => {
    try {
      const { householdId, anomalyType, severity } = req.body;
      const result = await submit('dlpi', 'AddJangananaFlag', [
        req.params.dlpiId,
        householdId,
        anomalyType,
        severity,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

module.exports = router;
