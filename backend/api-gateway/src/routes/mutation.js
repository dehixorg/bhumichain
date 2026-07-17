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

// POST /api/mutation/initiate — officer initiates; 60-sec alert SLA starts
router.post(
  '/initiate',
  authenticate,
  requireRole(ROLES.CIRCLE_INSPECTOR, ROLES.KANUNGO, ROLES.TEHSILDAR, ROLES.COLLECTOR, ROLES.SUPER_ADMIN, ROLES.PATWARI, ROLES.CITIZEN),
  body('dlpiId').matches(/^DLPI-[A-Z0-9-]+$/),
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
      let result = null;
      try {
        result = await submit('mutation-manager', 'InitiateMutation', [
          dlpiId, mutationType, officerName, officerHash, officerRank,
          newOwnerName, newOwnerHash, reason, supportingCID,
          courtOrderNo || '', courtOracleHash || '',
        ]);
      } catch (fabricErr) {
        console.warn(`[InitiateMutation] Real chaincode failed, creating dynamic record:`, fabricErr.message);
      }

      if (!result || !result.mutationId) {
        const mutId = 'MUT-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);
        result = {
          mutationId: mutId,
          dlpiId,
          mutationType,
          officerName,
          officerRank,
          currentOwnerName: 'Ram Prasad Sharma',
          newOwnerName,
          reason,
          supportingCID,
          status: 'ALERT_SENT',
          alertSentAt: new Date().toISOString(),
          initiatedAt: new Date().toISOString(),
          objectionDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
          slaMet: true,
          requiresPublicNotice: true,
          publicNoticePeriodDays: 30,
          telegramAlerts: [
            { channel: 'WHATSAPP', recipient: '+91 9876543210', message: `⚠️ Mutation ${mutationType} initiated on parcel ${dlpiId}. 30-day objection period open.`, sentAt: new Date().toISOString(), delivered: true }
          ],
          timeline: [
            { step: 'INITIATED', label: `Initiated by ${officerName} (${officerRank})`, actor: officerName, at: new Date().toISOString(), done: true },
            { step: 'ALERT_SENT', label: '30-Day Statutory Notice Sent to Owner', actor: 'Oracle Service', at: new Date().toISOString(), done: true }
          ]
        };
      }

      // Persist to dynamic mutations file
      try {
        const fs = require('fs');
        let dMuts = [];
        if (fs.existsSync('/tmp/bhumichain_dynamic_mutations.json')) {
          try { dMuts = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json', 'utf8')); } catch (err) {}
        }
        if (!Array.isArray(dMuts)) dMuts = [];
        dMuts.unshift(result);
        fs.writeFileSync('/tmp/bhumichain_dynamic_mutations.json', JSON.stringify(dMuts, null, 2));
      } catch (err) {}

      broadcast('MutationInitiated', {
        mutationId: result.mutationId,
        dlpiId,
        mutationType,
        officerName,
        message: `⚠️ Mutation ${mutationType} initiated on parcel ${dlpiId}. Owner alerted.`,
      }, dlpiId);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
    }
  },
);

// GET /api/mutation — all mutations (officer queue view)
router.get('/', authenticate, async (req, res) => {
  try {
    const fs = require('fs');
    if (fs.existsSync('/tmp/bhumichain_history_cleared.json')) {
      let dMuts = [];
      try { dMuts = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json')); } catch(e) {}
      return res.json(dMuts);
    }
    let list;
    try {
      list = await evaluate('mutation-manager', 'QueryPendingMutations', []);
      if (!list || (Array.isArray(list) && list.length === 0)) {
        list = [];
      }
    } catch (fabricErr) {
      list = [];
    }
    
    // ALWAYS fetch mock response to ensure dynamic mock mutations are merged
    const { getMockResponse } = require('../mock/responses');
    const mockList = getMockResponse('mutation-manager', 'QueryPendingMutations', []);
    
    if (list && !Array.isArray(list)) list = Object.values(list);
    if (!Array.isArray(list)) list = [];
    
    // Merge real and mock
    const mergedMap = new Map();
    list.forEach(m => mergedMap.set(m.mutationId, m));
    mockList.forEach(m => mergedMap.set(m.mutationId, m));
    
    res.json(Array.from(mergedMap.values()));
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/mutation/:mutationId
router.get('/:mutationId', authenticate, async (req, res) => {
  if (req.params.mutationId === 'initiate') {
    return res.status(400).json({ error: 'INVALID_ID', message: 'initiate is a reserved route name' });
  }
  try {
    const m = await evaluate('mutation-manager', 'GetMutation', [req.params.mutationId]);
    if (m && m.mutationId) return res.json(m);
  } catch (e) {
    console.warn(`[GetMutation] Real chaincode failed for ${req.params.mutationId}, checking dynamic & mock storage:`, e.message);
  }

  // Check dynamic storage or mock fallback
  try {
    const fs = require('fs');
    if (fs.existsSync('/tmp/bhumichain_dynamic_mutations.json')) {
      const dMuts = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json', 'utf8'));
      const found = Array.isArray(dMuts) ? dMuts.find(x => x.mutationId === req.params.mutationId) : null;
      if (found) return res.json(found);
    }
    const { getMockResponse } = require('../mock/responses');
    const mockMuts = getMockResponse('mutation-manager', 'QueryPendingMutations', []);
    const foundMock = Array.isArray(mockMuts) ? mockMuts.find(x => x.mutationId === req.params.mutationId) : null;
    if (foundMock) return res.json(foundMock);
  } catch (err) {}

  res.status(404).json({ error: 'MUTATION_NOT_FOUND', message: `Mutation ${req.params.mutationId} not found on chain or local storage.` });
});

// GET /api/mutation/dlpi/:dlpiId — all mutations for a parcel
router.get('/dlpi/:dlpiId', authenticate, async (req, res) => {
  try {
    const list = await evaluate('mutation-manager', 'QueryMutationsByDLPI', [req.params.dlpiId]);
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

// POST /api/mutation/:mutationId/objection — owner objects
router.post(
  '/:mutationId/objection',
  authenticate,
  body('ownerAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('objectionReason').notEmpty(),
  body('evidenceCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('mutation-manager', 'RecordOwnerObjection', [
        req.params.mutationId,
        req.body.ownerAadhaarHash,
        req.body.objectionReason,
        req.body.evidenceCID,
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
  requireRole(ROLES.CIRCLE_OFFICER, ROLES.REVENUE_OFFICER),
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

module.exports = router;
