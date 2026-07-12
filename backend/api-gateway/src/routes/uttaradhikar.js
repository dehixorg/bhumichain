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
  requireRole(ROLES.ORACLE, ROLES.TEHSILDAR, ROLES.COLLECTOR),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('familyId').notEmpty(),
  body('deceasedName').notEmpty().trim(),
  body('deceasedAadhaarHash').notEmpty(),
  body('dateOfDeath').isISO8601(),
  body('deathCertCID').notEmpty(),
  body('crsRegistrationNo').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const {
        dlpiId, familyId, deceasedName, deceasedAadhaarHash,
        dateOfDeath, deathCertCID, crsRegistrationNo, heirs
      } = req.body;

      let aiResult = null;
      if (heirs && Array.isArray(heirs) && heirs.length > 0) {
        // Compute equal shares based on the dynamic heirs
        const shareDec = 1.0 / heirs.length;
        const shareStr = `1/${heirs.length}`;
        const formattedHeirs = heirs.map((h, i) => ({
          heirId: `HEIR-DYN-${i+1}`,
          name: h.name || 'Unknown',
          aadhaarHash: (h.aadhaar || '').replace(/\D/g, ''), // Store normalized raw digits (strip dashes/spaces)
          relation: 'Legal Heir', gender: 'Unknown', dob: '1990-01-01',
          isAlive: true, isAdult: true, isNri: false,
          finalShare: shareStr, finalShareDec: shareDec,
          legalBasis: 'Hindu Succession Act 1956/2005',
          legalShare: shareStr, legalShareDec: shareDec,
          hasConsented: false, hasObjected: false,
        }));
        
        aiResult = {
          applicableLaw: 'Hindu Succession Act 1956/2005',
          heirs: JSON.stringify(formattedHeirs),
          minorHeirs: '[]',
          aiComputationCID: 'QmDynamicHeirComputation',
          aiConfidenceScore: 1.0,
        };
      } else {
        try {
          const aiRes = await axios.post(`${AI_URL()}/coparcenary/compute`, {
            dlpiId, familyId, deceasedName, dateOfDeath,
          });
          aiResult = aiRes.data;
        } catch (e) {
          console.warn('[CoparcenaryMapper] AI service unreachable, using mock');
          aiResult = {
            applicableLaw: 'Hindu Succession Act 1956/2005',
            heirs: JSON.stringify(require('../mock/responses').DEMO_SUCCESSION_CASE.heirs),
            minorHeirs: '[]',
            aiComputationCID: 'QmMockCoparcenaryOutput',
            aiConfidenceScore: 0.97,
          };
        }
      }

      let result;
      try {
        const argsArray = [
          dlpiId, familyId, deceasedName, deceasedAadhaarHash,
          dateOfDeath, deathCertCID, crsRegistrationNo,
          'Hindu', // default religion to Hindu
          aiResult.applicableLaw,
          aiResult.heirs,
          aiResult.minorHeirs || '[]',
          aiResult.aiComputationCID,
          String(aiResult.aiConfidenceScore),
        ];
        
        result = await submit('uttaradhikar', 'InitiateSuccessionByDeathCert', argsArray);
      } catch (fabricErr) {
        console.warn('[Succession] Real chaincode failed, falling back to mock response', fabricErr.message);
        const { getMockResponse } = require('../mock/responses');
        
        const argsArray = [
          dlpiId, familyId, deceasedName, deceasedAadhaarHash,
          dateOfDeath, deathCertCID, crsRegistrationNo,
          'Hindu',
          aiResult.applicableLaw,
          aiResult.heirs,
          aiResult.minorHeirs || '[]',
          aiResult.aiComputationCID,
          String(aiResult.aiConfidenceScore),
        ];
        
        result = getMockResponse('uttaradhikar', 'InitiateSuccessionByDeathCert', argsArray);
      }

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

// GET /api/succession/my-pending — returns cases awaiting consent from logged-in heir
router.get('/my-pending', authenticate, requireRole(ROLES.CITIZEN), async (req, res) => {
  try {
    let list = [];
    try {
      list = await evaluate('uttaradhikar', 'GetMyPendingSuccessions', [req.user.aadhaarHash]);
    } catch (fabricErr) {
      console.warn('[Succession] Real chaincode failed for my-pending, falling back to mock response', fabricErr.message);
      const { getMockResponse } = require('../mock/responses');
      list = getMockResponse('uttaradhikar', 'GetMyPendingSuccessions', [req.user.aadhaarHash]);
    }
    res.json(list || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/succession/:caseId
router.get('/:caseId', authenticate, async (req, res) => {
  try {
    let sc;
    try {
      sc = await evaluate('uttaradhikar', 'GetSuccessionCase', [req.params.caseId]);
    } catch (fabricErr) {
      console.warn('[Succession] Real chaincode failed, falling back to mock response', fabricErr.message);
      const { getMockResponse } = require('../mock/responses');
      sc = getMockResponse('uttaradhikar', 'GetSuccessionCase', [req.params.caseId]);
    }
    if (!sc) return res.status(404).json({ error: 'CASE_NOT_FOUND' });
    res.json(sc);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// POST /api/succession/:caseId/execute — Officer finalizes succession
router.post(
  '/:caseId/execute',
  authenticate,
  requireRole(ROLES.REVENUE_OFFICER, ROLES.COLLECTOR),
  async (req, res) => {
    try {
      let result;
      try {
        result = await submit('uttaradhikar', 'ExecuteSuccession', [req.params.caseId]);
      } catch (fabricErr) {
        const { getMockResponse } = require('../mock/responses');
        result = getMockResponse('uttaradhikar', 'ExecuteSuccession', [req.params.caseId]);
      }
      
      broadcast('SuccessionExecuted', {
        caseId: req.params.caseId,
        message: 'Succession finalized. Parcel ownership updated.',
      }, req.params.caseId); // Assuming we can use caseId as room for now

      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  }
);

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
  body('heirAadhaarHash').notEmpty(),
  body('channel').isIn(['SMS', 'WHATSAPP', 'PUSH', 'DIGILOCKER', 'EMAIL']),
  body('deliveredAt').isISO8601(),
  validate,
  async (req, res) => {
    try {
      let result;
      try {
        result = await submit('uttaradhikar', 'RecordHeirNotification', [
          req.params.caseId,
          req.body.heirAadhaarHash,
          req.body.channel,
          req.body.deliveredAt,
        ]);
      } catch (fabricErr) {
        const { getMockResponse } = require('../mock/responses');
        result = getMockResponse('uttaradhikar', 'RecordHeirNotification', [
          req.params.caseId, req.body.heirAadhaarHash, req.body.channel, req.body.deliveredAt
        ]);
      }
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
  body('heirAadhaarHash').notEmpty(),
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      let result;
      try {
        result = await submit('uttaradhikar', 'RecordHeirConsent', [
          req.params.caseId,
          req.body.heirAadhaarHash,
          req.body.eSignTxHash,
        ]);
      } catch (fabricErr) {
        const { getMockResponse } = require('../mock/responses');
        result = getMockResponse('uttaradhikar', 'RecordHeirConsent', [
          req.params.caseId, req.body.heirAadhaarHash, req.body.eSignTxHash
        ]);
      }
      broadcast('HeirConsentRecorded', {
        caseId: req.params.caseId,
        heirAadhaarHash: req.body.heirAadhaarHash,
      });
      // If tehsildar approval triggered, broadcast that too
      if (result && result.status === 'PENDING_TEHSILDAR_APPROVAL') {
        broadcast('AllHeirsConsented', {
          caseId: req.params.caseId,
          message: '✅ All heirs have consented. Case forwarded to Tehsildar for final approval.',
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
  body('heirAadhaarHash').notEmpty(),
  body('disputeType').isIn(['ShareDispute', 'RightToInherit', 'FalseClaim']),
  body('objectionReason').notEmpty(),
  body('evidenceCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      let result;
      try {
        result = await submit('uttaradhikar', 'RecordHeirObjection', [
          req.params.caseId,
          req.body.heirAadhaarHash,
          req.body.disputeType,
          req.body.objectionReason,
          req.body.evidenceCID,
        ]);
      } catch (fabricErr) {
        const { getMockResponse } = require('../mock/responses');
        result = getMockResponse('uttaradhikar', 'RecordHeirObjection', [
          req.params.caseId, req.body.heirAadhaarHash, req.body.disputeType,
          req.body.objectionReason, req.body.evidenceCID
        ]);
      }
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
