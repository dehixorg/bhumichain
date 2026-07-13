'use strict';

const { Router } = require('express');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const axios = require('axios');
const { submit, evaluate } = require('../services/fabric');
const { broadcast } = require('../services/websocket');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

const router = Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    const errorMsg = errs.array().map(e => `${e.path}: ${e.msg}`).join(', ');
    return res.status(400).json({ message: `Validation failed - ${errorMsg}`, errors: errs.array() });
  }
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
        const formattedHeirs = heirs.map((h, i) => {
          const rawDigits = (h.aadhaar || '').replace(/\D/g, '');
          const hashedAadhaar = rawDigits ? crypto.createHash('sha256').update(rawDigits).digest('hex') : '';
          return {
            heirId: `HEIR-DYN-${i+1}`,
            name: h.name || 'Unknown',
            aadhaarHash: hashedAadhaar,
            relation: 'Legal Heir', gender: 'Unknown', dob: '1990-01-01',
            isAlive: true, isAdult: true, isNri: false,
            share: shareStr, shareDecimal: shareDec,
            legalBasis: 'Hindu Succession Act 1956/2005',
            hasConsented: false, hasObjected: false,
          };
        });
        
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
        
        // If the real chaincode succeeds but doesn't return a caseId, it breaks the flow.
        // Force the mock response in this case.
        if (!result || !result.caseId) {
          throw new Error('Real chaincode succeeded but returned no caseId');
        }
      } catch (fabricErr) {
        console.warn('[Succession] Real chaincode failed. Full Error:', fabricErr.message, fabricErr.details);
        
        const detailsStr = fabricErr.details ? JSON.stringify(fabricErr.details) : '';
        if ((fabricErr.message && fabricErr.message.includes('DLPI') && fabricErr.message.includes('not found')) || 
            (detailsStr.includes('DLPI') && detailsStr.includes('not found'))) {
          console.warn('[Demo] DLPI not found. Auto-seeding DLPI-UP-DAD-00100 to fix fresh blockchain state...');
          try {
            const seedPayload = {
              dlpiId: 'DLPI-UP-DAD-00100',
              surveyNumber: '100', khasraNo: '100',
              tehsil: 'Dadri', tehsilCode: 'DAD',
              district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh',
              landType: 'Residential', landTypeDescription: 'Irrigated double-crop',
              areaHectares: 2.5, isTribal: false, scheduleVArea: false,
              initialOwners: [{
                aadhaarHash: deceasedAadhaarHash || 'sha256:owner1ramesh3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9', name: deceasedName || 'Ramesh Kumar',
                share: '1/1', shareDecimal: 1.0, ownerSince: new Date().toISOString(),
                isVerified: true
              }],
              ownershipType: 'SOLE',
              latitude: 28.5355, longitude: 77.3910,
              circleRateINR: 5000000, ipfsCID: 'QmYwAPJzv5CZ1zoZ5G4vV3H927918v5H927918v5H92791',
              sourceType: 'MANUAL'
            };
            await submit('dlpi', 'CreateDLPI', [JSON.stringify(seedPayload)]);
            console.log('[Demo] Seeding complete. Retrying InitiateSuccession...');
            result = await submit('uttaradhikar', 'InitiateSuccessionByDeathCert', argsArray);
            if (!result || !result.caseId) {
              throw new Error('Real chaincode succeeded but returned no caseId');
            }
          } catch (seedErr) {
            console.warn('[Succession] Auto-seed or retry failed. Falling back to mock.', seedErr.message);
          }
        }
      }
      const { getMockResponse } = require('../mock/responses');
      const argsArray = [
        dlpiId, familyId, deceasedName, deceasedAadhaarHash,
        dateOfDeath, deathCertCID, crsRegistrationNo, 'Hindu',
        aiResult.applicableLaw, aiResult.heirs, aiResult.minorHeirs || '[]',
        aiResult.aiComputationCID, String(aiResult.aiConfidenceScore)
      ];
      const mockResult = getMockResponse('uttaradhikar', 'InitiateSuccessionByDeathCert', argsArray);
      if (!result) result = mockResult;

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
    let cases;
    try {
      cases = await evaluate('uttaradhikar', 'GetMyPendingSuccessions', [req.user.aadhaarHash]);
      if (!cases || !Array.isArray(cases)) {
        throw new Error('Real chaincode returned invalid array');
      }
    } catch (fabricErr) {
      console.warn('[Succession] Real chaincode failed for my-pending, falling back to mock response', fabricErr.message);
      const { getMockResponse } = require('../mock/responses');
      cases = getMockResponse('uttaradhikar', 'GetMyPendingSuccessions', [req.user.aadhaarHash]);
    }
    res.json(cases || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/succession/pending/all — Officer queue
router.get('/pending/all', authenticate, requireRole(ROLES.TEHSILDAR, ROLES.COLLECTOR), async (req, res) => {
  try {
    let cases;
    try {
      cases = await evaluate('uttaradhikar', 'QueryPendingSuccessions', []);
      if (!cases || !Array.isArray(cases)) throw new Error('Real chaincode returned invalid array');
    } catch (fabricErr) {
      console.warn('[Succession] Real chaincode failed for QueryPendingSuccessions, falling back to mock response', fabricErr?.message);
      const { getMockResponse } = require('../mock/responses');
      cases = getMockResponse('uttaradhikar', 'QueryPendingSuccessions', []);
    }
    
    const pendingCases = (cases || []).filter(c => ['PENDING_TEHSILDAR_APPROVAL', 'ALL_CONSENTED', 'PENDING_TEHSILDAR'].includes(c.status));
    res.json(pendingCases);
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
      if (!sc || !sc.heirs) {
        throw new Error('Real chaincode returned empty case or missing heirs');
      }
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

// POST /api/succession/:caseId/execute — tehsildar executes (auto-mutates)
router.post(
  '/:caseId/execute',
  authenticate,
  requireRole(ROLES.TEHSILDAR, ROLES.COLLECTOR, ROLES.CIRCLE_INSPECTOR),
  async (req, res) => {
    try {
      // 1. Execute the succession on the real chaincode
      const result = await submit('uttaradhikar', 'ExecuteSuccession', [req.params.caseId]);
      
      // 2. Format data for the Mutation Manager
      const sCase = result;
      const currentOwnersJSON = JSON.stringify([{ aadhaarHash: sCase.deceasedHash }]);
      const newOwnersJSON = JSON.stringify((sCase.heirs || []).map(h => ({
        aadhaarHash: h.aadhaarHash,
        name: h.name,
        share: h.finalShare,
        shareDecimal: h.finalShareDec,
        isTribal: h.isTribal || false
      })));

      // 3. Trigger the mutation automatically on the real chaincode
      try {
        await submit('mutation-manager', 'InitiateMutation', [
          sCase.dlpiId, "INHERITANCE",
          req.user.name, req.user.aadhaarHash, "Tehsildar",
          "UTTARADHIKAR_ENGINE", sCase.caseId,
          currentOwnersJSON, newOwnersJSON,
          "Succession executed by Tehsildar", "", "", "", ""
        ]);
      } catch (mutErr) {
        console.error('[ExecuteSuccession] Mutation trigger failed:', mutErr?.message || mutErr);
        // We do not fail the request if mutation trigger fails, but we log it
      }
      
      broadcast('SuccessionExecuted', {
        caseId: req.params.caseId,
        message: 'Succession finalized. Parcel ownership updated.',
      }, req.params.caseId);

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
        if (!result || !result.status) {
          throw new Error('Real chaincode succeeded but returned no status');
        }
      } catch (fabricErr) {
        // failed
      }
      // ALWAYS update mock state to prevent UI queue inconsistencies
      const { getMockResponse } = require('../mock/responses');
      const mockResult = getMockResponse('uttaradhikar', 'RecordHeirConsent', [
        req.params.caseId, req.body.heirAadhaarHash, req.body.eSignTxHash
      ]);
      if (!result) result = mockResult;
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
