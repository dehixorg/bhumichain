'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { submit, evaluate } = require('../services/fabric');
const { broadcast } = require('../services/websocket');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

const router = Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

// POST /api/tribal/register — governance: register a parcel as tribal-protected
// Called at network genesis or by Tribal Welfare Org
router.post(
  '/register',
  authenticate,
  requireRole(ROLES.NALSA, ROLES.COLLECTOR),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('scheduleType').isIn(['V', 'VI', 'FRA_PATTA', 'PVTG']),
  body('gazettedOn').isISO8601(),
  body('districtName').notEmpty(),
  body('tehsilName').notEmpty(),
  body('villageName').notEmpty(),
  body('communityName').notEmpty(),
  body('gramSabhaVillageId').notEmpty(),
  body('nalsaRegionId').notEmpty(),
  body('protectionLevel').isIn(['ABSOLUTE', 'CONDITIONAL']),
  validate,
  async (req, res) => {
    try {
      const {
        dlpiId, scheduleType, gazettedOn, districtName, tehsilName,
        villageName, communityName, fraPattaNo, fraForestDivision,
        gramSabhaVillageId, nalsaRegionId, protectionLevel, pvtgCommunity,
      } = req.body;
      const result = await submit('tribal-guard', 'RegisterTribalParcel', [
        dlpiId, scheduleType, gazettedOn, districtName, tehsilName,
        villageName, communityName,
        fraPattaNo || '', fraForestDivision || '',
        gramSabhaVillageId, nalsaRegionId, protectionLevel,
        String(pvtgCommunity || false),
      ]);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/tribal/check — standalone tribal check (also called internally by transfer route)
// Demo Scene 6: Attempt to buy DLPI-MH-IGT-T0023 → hard reject in <200ms
router.post(
  '/check',
  authenticate,
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('buyerName').notEmpty().trim(),
  body('buyerAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  validate,
  async (req, res) => {
    try {
      const { dlpiId, buyerName, buyerAadhaarHash } = req.body;
      const isTribalBuyer = req.body.isTribalBuyer || false;
      const tribalCertHash = req.body.tribalCertHash || '';
      const tribalCommunity = req.body.tribalCommunity || '';

      const result = await submit('tribal-guard', 'CheckTransfer', [
        dlpiId, buyerName, buyerAadhaarHash,
        String(isTribalBuyer), tribalCertHash, tribalCommunity,
      ]);

      if (result.decision === 'HARD_REJECTED') {
        broadcast('TribalTransferHardRejected', result, dlpiId);
        return res.status(403).json(result);
      }

      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/tribal/parcel/:dlpiId — is this parcel tribal? Get registry entry.
router.get('/parcel/:dlpiId', authenticate, async (req, res) => {
  try {
    const registry = await evaluate('tribal-guard', 'IsTribalParcel', [req.params.dlpiId]);
    if (!registry) return res.json({ isTribal: false });
    res.json({ isTribal: true, ...registry });
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/tribal/parcel/:dlpiId/attempts — full attempt history (audit)
router.get('/parcel/:dlpiId/attempts', authenticate, requireRole(ROLES.COLLECTOR, ROLES.NALSA), async (req, res) => {
  try {
    const attempts = await evaluate('tribal-guard', 'GetAllAttemptsForParcel', [req.params.dlpiId]);
    res.json(attempts || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// POST /api/tribal/:attemptId/gram-sabha — Gram Sabha member signs approval
router.post(
  '/:attemptId/gram-sabha',
  authenticate,
  body('memberAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('memberName').notEmpty(),
  body('villageId').notEmpty(),
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('tribal-guard', 'RecordGramSabhaApproval', [
        req.params.attemptId,
        req.body.memberAadhaarHash,
        req.body.memberName,
        req.body.villageId,
        req.body.eSignTxHash,
      ]);
      broadcast('GramSabhaApprovalRecorded', { attemptId: req.params.attemptId });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/tribal/:attemptId/video-consent — GPS-tagged IPFS video recorded
router.post(
  '/:attemptId/video-consent',
  authenticate,
  body('videoIPFSCID').notEmpty(),
  body('gpsCoordinates').matches(/^-?\d+\.\d+,-?\d+\.\d+$/),
  body('recordedAt').isISO8601(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('tribal-guard', 'RecordVideoConsent', [
        req.params.attemptId,
        req.body.videoIPFSCID,
        req.body.gpsCoordinates,
        req.body.recordedAt,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/tribal/stats — rejection stats for dashboard
router.get('/stats/rejections', authenticate, requireRole(ROLES.COLLECTOR, ROLES.NALSA, ROLES.REVENUE_OFFICER), async (req, res) => {
  try {
    const stats = await evaluate('tribal-guard', 'GetRejectionStats', []);
    res.json(stats || {});
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

module.exports = router;
