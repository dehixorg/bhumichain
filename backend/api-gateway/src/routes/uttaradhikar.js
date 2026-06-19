'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const axios = require('axios');
const { submit, evaluate } = require('../services/fabric');
const { broadcast } = require('../services/websocket');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

const router = Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const AI_URL = () => process.env.AI_SERVICE_URL || 'http://localhost:8002';

// POST /api/succession/initiate
// Demo Scene 3: CRS oracle triggers this when death cert registered
// Calls CoparcenaryMapper AI first, then submits to chaincode
router.post(
  '/initiate',
  authenticate,
  requireRole(ROLES.ORACLE, ROLES.REVENUE_OFFICER, ROLES.COLLECTOR),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('familyId').notEmpty(),
  body('deceasedName').notEmpty().trim(),
  body('deceasedAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('dateOfDeath').isISO8601(),
  body('deathCertCID').notEmpty(),
  body('crsRegistrationNo').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const {
        dlpiId, familyId, deceasedName, deceasedAadhaarHash,
        dateOfDeath, deathCertCID, crsRegistrationNo,
      } = req.body;

      // Step 1: Call CoparcenaryMapper AI to compute heirs and applicable law
      let aiResult = null;
      try {
        const aiRes = await axios.post(`${AI_URL()}/coparcenary/compute`, {
          dlpiId, familyId, deceasedName, dateOfDeath,
        });
        aiResult = aiRes.data;
      } catch (e) {
        console.warn('[CoparcenaryMapper] AI service unreachable, using mock');
        // Return pre-scripted heirs in mock mode
        aiResult = {
          applicableLaw: 'Hindu Succession Act 1956/2005',
          heirs: JSON.stringify(require('../mock/responses').DEMO_SUCCESSION_CASE.heirs),
          minorHeirs: '[]',
          aiComputationCID: 'QmMockCoparcenaryOutput',
          aiConfidenceScore: 0.97,
        };
      }

      // Step 2: Submit succession to chaincode
      const result = await submit('uttaradhikar', 'InitiateSuccession', [
        dlpiId, familyId, deceasedName, deceasedAadhaarHash,
        dateOfDeath, deathCertCID, crsRegistrationNo,
        aiResult.applicableLaw,
        aiResult.heirs,
        aiResult.minorHeirs || '[]',
        aiResult.aiComputationCID,
        String(aiResult.aiConfidenceScore),
      ]);

      broadcast('SuccessionInitiated', {
        caseId: result.caseId,
        dlpiId,
        deceasedName,
        message: `Death of ${deceasedName} registered. Heirs identified. Notifications dispatched.`,
      }, dlpiId);

      res.status(201).json({ ...result, aiResult });
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/succession/:caseId
router.get('/:caseId', authenticate, async (req, res) => {
  try {
    const sc = await evaluate('uttaradhikar', 'GetSuccessionCase', [req.params.caseId]);
    if (!sc) return res.status(404).json({ error: 'CASE_NOT_FOUND' });
    res.json(sc);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/succession/dlpi/:dlpiId — active succession case for a parcel
router.get('/dlpi/:dlpiId', authenticate, async (req, res) => {
  try {
    const cases = await evaluate('uttaradhikar', 'GetSuccessionByDLPI', [req.params.dlpiId]);
    res.json(cases || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// POST /api/succession/:caseId/notification — oracle records notification delivered to heir
router.post(
  '/:caseId/notification',
  authenticate,
  requireRole(ROLES.ORACLE),
  body('heirAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('channel').isIn(['SMS', 'WHATSAPP', 'PUSH', 'DIGILOCKER', 'EMAIL']),
  body('deliveredAt').isISO8601(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('uttaradhikar', 'RecordHeirNotification', [
        req.params.caseId,
        req.body.heirAadhaarHash,
        req.body.channel,
        req.body.deliveredAt,
      ]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/succession/:caseId/consent — heir gives Aadhaar eSign
// Demo Scene 3: all three heirs consent → auto-mutation fires
router.post(
  '/:caseId/consent',
  authenticate,
  body('heirAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('uttaradhikar', 'RecordHeirConsent', [
        req.params.caseId,
        req.body.heirAadhaarHash,
        req.body.eSignTxHash,
      ]);
      broadcast('HeirConsentRecorded', {
        caseId: req.params.caseId,
        heirAadhaarHash: req.body.heirAadhaarHash,
      });
      // If auto-mutation triggered, broadcast that too
      if (result && result.status === 'AUTO_MUTATED') {
        broadcast('AllHeirsConsented', {
          caseId: req.params.caseId,
          message: '✅ All heirs have consented. Succession mutation executing automatically.',
        });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/succession/:caseId/objection — heir disputes share
router.post(
  '/:caseId/objection',
  authenticate,
  body('heirAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('disputeType').isIn(['ShareDispute', 'RightToInherit', 'FalseClaim']),
  body('objectionReason').notEmpty(),
  body('evidenceCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('uttaradhikar', 'RecordHeirObjection', [
        req.params.caseId,
        req.body.heirAadhaarHash,
        req.body.disputeType,
        req.body.objectionReason,
        req.body.evidenceCID,
      ]);
      broadcast('SuccessionDisputeFiled', {
        caseId: req.params.caseId,
        message: '⚖️ Objection filed. Case referred to court. NyayaAI brief generating.',
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/succession/pending — officer dashboard: all pending cases
router.get('/pending/all', authenticate, requireRole(ROLES.REVENUE_OFFICER, ROLES.COLLECTOR), async (req, res) => {
  try {
    const list = await evaluate('uttaradhikar', 'QueryPendingSuccessions', []);
    res.json(list || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

module.exports = router;
