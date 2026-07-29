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

const MUTATION_TYPES = [
  'Sale', 'Gift', 'Inheritance', 'Partition', 'Court_Order',
  'Govt_Acquisition', 'Exchange', 'Will',
];

// POST /api/mutation/initiate — officer initiates (legacy support)
router.post(
  '/initiate',
  authenticate,
  requireRole(ROLES.CIRCLE_OFFICER, ROLES.REVENUE_OFFICER, ROLES.COLLECTOR),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('mutationType').isIn(MUTATION_TYPES),
  body('officerName').notEmpty().trim(),
  body('officerHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('officerRank').notEmpty(),
  body('newOwnerName').notEmpty().trim(),
  body('newOwnerHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('reason').notEmpty(),
  body('supportingCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const {
        dlpiId, mutationType, officerName, officerHash, officerRank,
        newOwnerName, newOwnerHash, reason, supportingCID,
        courtOrderNo, courtOracleHash,
      } = req.body;
      const result = await submit('mutation-manager', 'InitiateMutation', [
        dlpiId, mutationType, officerName, officerHash, officerRank,
        newOwnerName, newOwnerHash, reason, supportingCID,
        courtOrderNo || '', courtOracleHash || '',
      ]);
      broadcast('MutationInitiated', {
        mutationId: result.mutationId,
        dlpiId,
        mutationType,
        officerName,
        message: `⚠️ Mutation ${mutationType} initiated on parcel ${dlpiId}. Owner alerted.`,
      }, dlpiId);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/mutation — all mutations (officer queue view)
router.get('/', authenticate, async (req, res) => {
  try {
    const list = await evaluate('mutation-manager', 'GetAllMutations', []);
    res.json(list || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/mutation/:mutationId
router.get('/:mutationId', authenticate, async (req, res) => {
  try {
    const m = await evaluate('mutation-manager', 'GetMutation', [req.params.mutationId]);
    if (!m) return res.status(404).json({ error: 'MUTATION_NOT_FOUND' });
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/mutation/dlpi/:dlpiId — all mutations for a parcel
router.get('/dlpi/:dlpiId', authenticate, async (req, res) => {
  try {
    const list = await evaluate('mutation-manager', 'GetMutationsByDLPI', [req.params.dlpiId]);
    res.json(list || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// POST /api/mutation/:mutationId/alert-delivery — oracle records notification delivered
router.post(
  '/:mutationId/alert-delivery',
  authenticate,
  requireRole(ROLES.ORACLE),
  body('channel').isIn(['SMS', 'WHATSAPP', 'PUSH', 'EMAIL']),
  body('deliveredAt').isISO8601(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('mutation-manager', 'RecordOwnerAlertDelivery', [
        req.params.mutationId, req.body.channel, req.body.deliveredAt,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/mutation/:mutationId/consent — owner consents
router.post(
  '/:mutationId/consent',
  authenticate,
  body('ownerAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('mutation-manager', 'RecordOwnerConsent', [
        req.params.mutationId, req.body.ownerAadhaarHash, req.body.eSignTxHash,
      ]);
      broadcast('OwnerConsentRecorded', { mutationId: req.params.mutationId });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/mutation/:mutationId/objection — owner or citizen objects
router.post(
  '/:mutationId/objection',
  authenticate,
  body('objectionReason').notEmpty().trim(),
  validate,
  async (req, res) => {
    try {
      const ownerHash = req.body.ownerAadhaarHash || req.user.aadhaarHash || 'sha256:default-aadhaar';
      const evidence = req.body.evidenceCID || 'QmDummyEvidence';
      const result = await submit('mutation-manager', 'RecordOwnerObjection', [
        req.params.mutationId,
        ownerHash,
        req.body.objectionReason,
        evidence,
      ]);
      broadcast('OwnerObjectionFiled', { mutationId: req.params.mutationId });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/mutation/:mutationId/execute — officer finalizes
router.post(
  '/:mutationId/execute',
  authenticate,
  requireRole(ROLES.CIRCLE_OFFICER, ROLES.REVENUE_OFFICER, ROLES.TEHSILDAR),
  body('finalDocCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('mutation-manager', 'ExecuteMutation', [
        req.params.mutationId, req.body.finalDocCID,
      ]);
      broadcast('MutationExecuted', { mutationId: req.params.mutationId });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/mutation — Create/Apply mutation dynamically (Citizen or Officer)
router.post(
  '/',
  authenticate,
  async (req, res) => {
    try {
      const result = await submit('mutation-manager', 'CreateMutation', [JSON.stringify(req.body)]);
      broadcast('MutationCreated', {
        mutationId: result.mutationId,
        mutationType: result.mutationType,
        message: `🆕 Mutation ${result.mutationId} (${result.mutationType}) has been submitted successfully.`,
      });
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  }
);

// PATCH /api/mutation/:mutationId/status — Approve/Reject workflow transitions
router.patch(
  '/:mutationId/status',
  authenticate,
  requireRole(ROLES.PATWARI, ROLES.CIRCLE_INSPECTOR, ROLES.TEHSILDAR),
  body('status').isIn(['Pending at Kanungo', 'Pending at Tehsildar', 'Approved', 'Rejected', 'Objection Filed']),
  body('reason').optional().trim(),
  validate,
  async (req, res) => {
    try {
      const { status, reason } = req.body;
      const { mutationId } = req.params;
      const actorName = req.user.name || 'Officer';
      
      const result = await submit('mutation-manager', 'UpdateMutationStatus', [
        mutationId,
        status,
        actorName,
        reason || ''
      ]);

      broadcast('MutationStatusUpdated', {
        mutationId,
        status,
        actorName,
        message: `🔄 Mutation ${mutationId} status updated to: ${status} by ${actorName}`,
      });

      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  }
);

module.exports = router;
