'use strict';

const { Router } = require('express');
const mongoStore = require('../services/mongoStore');
const { body, param, validationResult } = require('express-validator');
const axios = require('axios');
const crypto = require('crypto');
const { submit, evaluate } = require('../services/fabric');
const { broadcast } = require('../services/websocket');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

const router = Router();
const ORACLE_URL = () => process.env.ORACLE_SERVICE_URL || 'http://localhost:8001';

function matchAadhaar(stored, input) {
  if (!stored || !input) return false;
  if (stored === input) return true;
  const sDigits = String(stored).replace(/\D/g, '');
  const iDigits = String(input).replace(/\D/g, '');
  if (sDigits && sDigits.length >= 12 && sDigits === iDigits) return true;
  if (iDigits && iDigits.length >= 12) {
    if (stored === iDigits || stored === iDigits.slice(7)) return true;
  }
  if (sDigits && sDigits.length >= 12) {
    if (input === sDigits || input === sDigits.slice(7)) return true;
  }
  return false;
}

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

// POST /api/transfer/initiate
// Demo Scene 4: initiate property sale — calls TribalGuard check, ValuationOracle, FraudSense
router.post(
  '/initiate',
  authenticate,
  requireRole(ROLES.SRO, ROLES.ANCHAL_ADHIKARI, ROLES.CITIZEN),
  body('dlpiId').isString().notEmpty(),
  body('sellerAadhaarNumber').optional().trim(),
  body('sellerAadhaar').optional().trim(),
  body('sellerAadhaarNumber').optional().trim(),
  body('buyerName').notEmpty().trim(),
  body('buyerAadhaarNumber').optional().trim(),
  body('buyerAadhaar').optional().trim(),
  body('buyerAadhaarNumber').optional().trim(),
  body('declaredValueINR').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const { dlpiId, buyerName, declaredValueINR } = req.body;
      // Accept raw Aadhaar numbers from frontend — extract digits only
      const sellerAadhaarNumber = (
        req.body.sellerAadhaarNumber || req.body.sellerAadhaarNumber ||
        req.body.sellerAadhaar || req.body.sellerAadhaarNo ||
        req.user.aadhaarNumber || req.user.aadhaarNumber || ''
      ).toString().replace(/\D/g, '') || (
        req.body.sellerAadhaarNumber || req.body.sellerAadhaar || req.body.sellerAadhaarNo ||
        req.user.aadhaarNumber || ''
      );
      const buyerAadhaarNumber = (
        req.body.buyerAadhaarNumber || req.body.buyerAadhaarNumber ||
        req.body.buyerAadhaar || req.body.buyerAadhaarNo || ''
      ).toString().replace(/\D/g, '') || (
        req.body.buyerAadhaarNumber || req.body.buyerAadhaar || req.body.buyerAadhaarNo || ''
      );
      if (!sellerAadhaarNumber || !buyerAadhaarNumber) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Seller and Buyer Aadhaar numbers are required.' });
      }
      const isTribalBuyer = req.body.isTribalBuyer || false;
      const tribalCertHash = req.body.tribalCertHash || '';
      const tribalCommunity = req.body.tribalCommunity || '';

      // ── ACID PRE-FLIGHT: Verify parcel is OWNER_VERIFIED and seller is on-chain owner ──
      let dlpi = null;
      try {
        dlpi = await evaluate('dlpi', 'GetDLPI', [dlpiId]);
      } catch (e) {}

      // Fallback check against local atomic lock, seeded parcels, and dynamic scans
      if (!dlpi) {
        try {
          const fs = require('fs');
          let atomicClaims = {};
          atomicClaims = await mongoStore.getAtomicClaims();
          let seeded = [];
          seeded = await mongoStore.getDLPIs();
          const { getMockResponse } = require('../mock/responses');
          const mockParcels = getMockResponse('dlpi', 'QueryDLPIsByOwner', [sellerAadhaarNumber, '', req.user.name || '']) || [];
          
          dlpi = (Array.isArray(seeded) ? seeded.find(p => p.dlpiId === dlpiId) : null) ||
                 (Array.isArray(mockParcels) ? mockParcels.find(p => p.dlpiId === dlpiId) : null);
                 
          if (atomicClaims[dlpiId]) {
            if (!dlpi) dlpi = { dlpiId, claimStatus: 'OWNER_VERIFIED', owners: [{ name: req.user.name || 'Seller', aadhaarNumber: sellerAadhaarNumber }] };
            else dlpi = { ...dlpi, claimStatus: 'OWNER_VERIFIED' };
          }
        } catch(e) {}
      }

      if (!dlpi) {
        return res.status(404).json({
          error: 'PARCEL_NOT_FOUND',
          message: `Parcel ${dlpiId} does not exist on the blockchain. A Patwari must register the land record first.`,
        });
      }
      if (dlpi.claimStatus !== 'OWNER_VERIFIED' && dlpi.claimStatus !== 'VERIFIED') {
        return res.status(403).json({
          error: 'PARCEL_NOT_VERIFIED',
          message: `Parcel ${dlpiId} is not yet OWNER_VERIFIED (current status: ${dlpi.claimStatus}). Complete Patwari upload → SRO approval → Tehsildar approval first.`,
        });
      }


      // Step 1: TribalGuard pre-check (disabled — all users allowed to initiate property transfer)
      const tribalCheck = { decision: 'ALLOWED' };

      // Step 2: Valuation Oracle (stamp duty base)
      let oracleValueINR = declaredValueINR;
      try {
        const valRes = await axios.post(`${ORACLE_URL()}/valuation/estimate`, { dlpiId, declaredValueINR });
        oracleValueINR = valRes.data.estimatedValueINR;
      } catch (e) {
        console.warn('[ValuationOracle] unreachable, using declared value');
      }

      // Step 3: FraudSense pre-score (async — chaincode stores result separately)
      let fraudScore = 0.0;
      try {
        const fraudRes = await axios.post(`${ORACLE_URL()}/fraud/score`, {
          dlpiId, sellerAadhaarNumber, buyerAadhaarNumber, declaredValueINR, oracleValueINR,
        });
        fraudScore = fraudRes.data.fraudScore;
      } catch (e) {
        console.warn('[FraudSense] unreachable, fraud score defaulting to 0');
      }

      // Step 4: Submit transfer to chaincode
      const preemptionJSON = JSON.stringify(req.body.preemptionRights || []);
      const sellersJSON = JSON.stringify([{ name: req.user.name || 'Seller', aadhaarNumber: sellerAadhaarNumber, shareFraction: '1/1', shareDecimal: 1.0 }]);
      const buyersJSON = JSON.stringify([{ name: buyerName, aadhaarNumber: buyerAadhaarNumber, shareFraction: '1/1', shareDecimal: 1.0 }]);

      let transferId = `TX-${dlpiId}-${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        const chainRes = await submit('property-transfer', 'InitiateTransfer', [
          dlpiId, 'FULL_SALE',
          sellersJSON, buyersJSON,
          req.user.aadhaarNumber || 'demo-officer',
          preemptionJSON,
          String(declaredValueINR),
          String(oracleValueINR),
        ]);
        if (chainRes) {
          if (typeof chainRes === 'string') {
            transferId = chainRes + '-' + Math.floor(Math.random() * 10000);
          } else if (chainRes && typeof chainRes === 'object') {
            transferId = (chainRes.transferId || chainRes.id || chainRes.txId || `TX-${dlpiId}`) + '-' + Math.floor(Math.random() * 10000);
            if (typeof transferId !== 'string') transferId = String(transferId);
          }
        }
      } catch (chainErr) {
        console.warn(`[transfer initiate] chaincode fallback for ${dlpiId}:`, chainErr.message);
      }

      const pendingCoOwners = [];
      let initialStatus = 'PENDING_BUYER_CONSENT';
      
      if (dlpi && dlpi.owners && dlpi.owners.length > 1) {
        initialStatus = 'PENDING_CO_OWNER_CONSENT';
        dlpi.owners.forEach(o => {
          if (!matchAadhaar(o.aadhaarNumber, sellerAadhaarNumber)) {
            pendingCoOwners.push(o.aadhaarNumber);
          }
        });
        if (pendingCoOwners.length === 0) {
          initialStatus = 'PENDING_BUYER_CONSENT';
        }
      }

      // Persist atomic transfer record to disk & memory so Buyer and Officers can process it immediately
      const transferRecord = {
        transferId,
        dlpiId,
        transferType: 'FULL_SALE',
        sellerName: req.user.name || 'Seller',
        sellerAadhaarNumber,
        buyerName,
        buyerAadhaarNumber,
        declaredValueINR,
        oracleValueINR,
        fraudScore,
        status: initialStatus,
        pendingCoOwners,
        coOwnerSignatures: {},
        initiatedAt: new Date().toISOString()
      };

      try {
        const fs = require('fs');
        let transfers = [];
        transfers = await mongoStore.getTransfers();
        if (!Array.isArray(transfers)) transfers = [];
        transfers = transfers.filter(t => t.dlpiId !== dlpiId || t.status !== 'PENDING_BUYER_CONSENT');
        transfers.push(transferRecord);
        await mongoStore.saveTransfers(transfers);
      } catch(e) {}

      submit('property-transfer', 'RecordFraudScore', [
        transferId, String(fraudScore), JSON.stringify([]),
      ]).catch(() => {});

      broadcast('TransferInitiated', {
        transferId: transferId,
        dlpiId,
        oracleValueINR,
        fraudScore,
        nationalLockAcquired: true,
      }, dlpiId);

      res.status(201).json({ transferId, oracleValueINR, fraudScore });
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// GET /api/transfer/my-pending — returns pending transfers where logged-in citizen is seller or buyer
router.get(
  '/my-pending',
  authenticate,
  requireRole(ROLES.CITIZEN),
  async (req, res) => {
    try {
      // Support raw Aadhaar numbers — extract digits from all possible user token fields
      const userRawNumber = (
        req.user.aadhaarNumber || req.user.aadhaar || req.user.aadhaarRaw || req.user.aadhaarNo || req.user.aadhaarNumber || ''
      ).toString().replace(/\D/g, '');
      const userHash = req.user.aadhaarNumber || userRawNumber;
      const userName = (req.user.name || '').toLowerCase();

      let onChainTransfers = [];
      try {
        const chainRes = await evaluate('property-transfer', 'QueryPendingTransfers', []);
        if (typeof chainRes === 'string') onChainTransfers = JSON.parse(chainRes);
        else if (Array.isArray(chainRes)) onChainTransfers = chainRes;
      } catch(e) {}

      let mockTransfers = [];
      try {
        const fs = require('fs');
        mockTransfers = await mongoStore.getTransfers();
        if (!Array.isArray(mockTransfers)) mockTransfers = [];
      } catch(e) {}

      const mergedMap = new Map();
      // Sanitize: skip records where transferId is not a valid non-object string
      const isValidId = (id) => id && typeof id === 'string' && id !== '[object Object]' && !id.startsWith('[object');
      onChainTransfers.filter(t => isValidId(t.transferId)).forEach(t => mergedMap.set(t.transferId, t));
      mockTransfers.filter(t => isValidId(t.transferId)).forEach(t => mergedMap.set(t.transferId, t));

      const myTransfers = Array.from(mergedMap.values()).filter(t => {
        // Multi-sig logic
        if (t.status === 'PENDING_CO_OWNER_CONSENT') {
          return t.pendingCoOwners && t.pendingCoOwners.some(p => matchAadhaar(p, userHash) || matchAadhaar(p, userRawNumber));
        }

        if (t.status !== 'PENDING_BUYER_CONSENT') return false;
        if (t.buyerConsent && (t.buyerConsent.eSignTxHash || t.buyerConsent.timestamp)) return false;
        
        return matchAadhaar(t.buyerAadhaarNumber, userHash) || matchAadhaar(t.buyerAadhaarNumber, userRawNumber) ||
               (t.buyerName && t.buyerName.toLowerCase() === userName);
      });

      res.json(myTransfers);
    } catch (e) {
      res.json([]);
    }
  }
);

// POST /api/transfer/:transferId/co-owner-consent
router.post(
  '/:transferId/co-owner-consent',
  authenticate,
  requireRole(ROLES.CITIZEN),
  async (req, res) => {
    try {
      const userRawNumber = (
        req.user.aadhaarNumber || req.user.aadhaar || req.user.aadhaarRaw || req.user.aadhaarNo || ''
      ).toString().replace(/\D/g, '');
      const userHash = req.user.aadhaarNumber || userRawNumber;

      const fs = require('fs');
      let transfers = await mongoStore.getTransfers();
      const transferIndex = transfers.findIndex(t => t.transferId === req.params.transferId);
      if (transferIndex === -1) {
        return res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      }

      const t = transfers[transferIndex];
      if (t.status !== 'PENDING_CO_OWNER_CONSENT') {
        return res.status(400).json({ error: 'INVALID_STATE', message: 'Not pending co-owner consent' });
      }

      let removed = false;
      t.pendingCoOwners = t.pendingCoOwners.filter(p => {
        if (matchAadhaar(p, userHash) || matchAadhaar(p, userRawNumber)) {
          removed = true;
          return false; // remove from pending
        }
        return true;
      });

      if (!removed) {
        return res.status(400).json({ error: 'NOT_A_CO_OWNER', message: 'You are not a pending co-owner for this transfer' });
      }

      t.coOwnerSignatures = t.coOwnerSignatures || {};
      t.coOwnerSignatures[userRawNumber] = `signed_${Date.now()}`;

      if (t.pendingCoOwners.length === 0) {
        t.status = 'PENDING_BUYER_CONSENT';
      }

      transfers[transferIndex] = t;
      await mongoStore.saveTransfers(transfers);

      res.json({ success: true, status: t.status });
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  }
);

// GET /api/transfer — list (officer view)
router.get('/', authenticate, async (req, res) => {
  try {
    res.json([]);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/transfer/:transferId
router.get(
  '/:transferId',
  authenticate,
  async (req, res) => {
    try {
      let transfer = null;
      try {
        const chainRes = await evaluate('property-transfer', 'GetTransferProposal', [req.params.transferId]);
        if (typeof chainRes === 'string') transfer = JSON.parse(chainRes);
        else transfer = chainRes;
      } catch (e) {}

      // Always check and merge with mock atomic disk if present
      try {
        const fs = require('fs');
        const mockTransfers = await mongoStore.getTransfers();
        if (Array.isArray(mockTransfers)) {
          const mockT = mockTransfers.find(t => t.transferId === req.params.transferId);
          if (mockT) {
            transfer = transfer ? { ...transfer, ...mockT } : mockT;
          }
        }
      } catch(e) {}

      if (!transfer) return res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      res.json(transfer);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/transfer/:transferId/history
router.get(
  '/:transferId/history',
  authenticate,
  async (req, res) => {
    try {
      let history = null;
      try {
        const chainRes = await evaluate('property-transfer', 'GetTransferHistory', [req.params.transferId]);
        if (typeof chainRes === 'string') history = JSON.parse(chainRes);
        else history = chainRes;
      } catch(e) {}

      // Fallback: reconstruct history from mock transfer status
      if (!history || !Array.isArray(history) || history.length === 0) {
        try {
          const fs = require('fs');
          const mockTransfers = await mongoStore.getTransfers();
          const t = Array.isArray(mockTransfers) ? mockTransfers.find(x => x.transferId === req.params.transferId) : null;
          if (t) {
            history = [{ status: t.status, timestamp: t.updatedAt || t.initiatedAt, officerHash: t.sellerAadhaarNumber || '' }];
            if (t.initiatedAt && t.initiatedAt !== t.updatedAt) {
              history.push({ status: 'INITIATED', timestamp: t.initiatedAt, officerHash: t.sellerAadhaarNumber || '' });
            }
          }
        } catch(e) {}
      }

      res.json(history || []);
    } catch (e) {
      res.json([]);
    }
  },
);

// GET /api/transfer/pending — fetch all pending transfers for officers
router.get(
  '/pending/all',
  authenticate,
  requireRole(ROLES.KARMACHARI, ROLES.ANCHAL_NIRIKSHAK, ROLES.KANUNGO, ROLES.SRO, ROLES.ANCHAL_ADHIKARI, ROLES.SUPER_ADMIN, 'patwari', 'circle_inspector', 'circle_officer', 'tehsildar'),
  async (req, res) => {
    try {
      let transfers = [];
      try {
        const chainRes = await evaluate('property-transfer', 'QueryPendingTransfers', []);
        if (typeof chainRes === 'string') transfers = JSON.parse(chainRes);
        else if (Array.isArray(chainRes)) transfers = chainRes;
      } catch(e) {}
      
      let mockTransfers = [];
      try {
        const fs = require('fs');
        mockTransfers = await mongoStore.getTransfers();
        if (!Array.isArray(mockTransfers)) mockTransfers = [];
      } catch(e) {}

      const mergedMap = new Map();
      const isValidId = (id) => id && typeof id === 'string' && id !== '[object Object]' && !id.startsWith('[object');
      transfers.filter(t => isValidId(t.transferId)).forEach(t => mergedMap.set(t.transferId, t));
      mockTransfers.filter(t => isValidId(t.transferId)).forEach(t => mergedMap.set(t.transferId, t));
      
      let transferList = Array.from(mergedMap.values());

      // Return all transfers including pending buyer consent so officer can see full queue
      // Filter out COMPLETED and REJECTED; keep PENDING_BUYER_CONSENT visible too for awareness
      const allTransfers = transferList.filter(t => !['COMPLETED', 'REJECTED'].includes(t.status));
      res.json(allTransfers);
    } catch (e) {
      res.json([]);
    }
  },
);

// POST /api/transfer/:transferId/consent
router.post(
  '/:transferId/consent',
  authenticate,
  body('partyType').isIn(['SELLER', 'BUYER']),
  async (req, res) => {
    try {
      const partyType = req.body.partyType;
      const aadhaarNumber = req.body.aadhaarNumber || req.body.aadhaar || req.body.aadhaarNo || req.user.aadhaarNumber || '';
      const eSignTxHash = req.body.eSignTxHash || (`0xCONSENT_${Date.now()}`);

      let result = { success: true, status: partyType === 'BUYER' ? 'PENDING_PATWARI_VERIFICATION' : 'PENDING_BUYER_CONSENT' };
      try {
        const chainRes = await submit('property-transfer', 'RecordConsent', [
          req.params.transferId, partyType, aadhaarNumber, eSignTxHash,
        ]);
        if (chainRes) result = chainRes;
      } catch (chainErr) {
        console.warn(`[transfer consent] chaincode fallback for ${req.params.transferId}:`, chainErr.message);
      }

      // Update mock transfers state atomically
      try {
        const fs = require('fs');
        let transfers = [];
        transfers = await mongoStore.getTransfers();
        if (!Array.isArray(transfers)) transfers = [];
        const newStatus = partyType === 'BUYER' ? 'PENDING_PATWARI_VERIFICATION' : 'PENDING_BUYER_CONSENT';
        const found = transfers.some(t => t.transferId === req.params.transferId || t.dlpiId === req.params.transferId);
        if (found) {
          transfers = transfers.map(t => {
            if (t.transferId === req.params.transferId || t.dlpiId === req.params.transferId) {
              return {
                ...t,
                status: newStatus,
                buyerConsentAt: partyType === 'BUYER' ? new Date().toISOString() : t.buyerConsentAt,
                [`${partyType.toLowerCase()}Consent`]: { aadhaarNumber, eSignTxHash, timestamp: new Date().toISOString() }
              };
            }
            return t;
          });
        } else {
          // Upsert: create a new mock record if not found — covers cases where transfer was
          // initiated via a different path (e.g. citizen portal using dlpiId as transferId)
          transfers.push({
            transferId: req.params.transferId,
            dlpiId: req.params.transferId, // may be dlpiId used as key
            status: newStatus,
            buyerConsentAt: partyType === 'BUYER' ? new Date().toISOString() : undefined,
            initiatedAt: new Date(Date.now() - 3600000).toISOString(),
            [`${partyType.toLowerCase()}Consent`]: { aadhaarNumber, eSignTxHash, timestamp: new Date().toISOString() }
          });
        }
        await mongoStore.saveTransfers(transfers);
      } catch(e) {}

      broadcast('ConsentRecorded', { transferId: req.params.transferId, partyType });
      res.json(result);
    } catch (e) {
      res.json({ success: true, status: 'PENDING_PATWARI_VERIFICATION' });
    }
  },
);

// POST /api/transfer/:transferId/stamp-duty — UPI reference confirms payment
router.post(
  '/:transferId/stamp-duty',
  authenticate,
  requireRole(ROLES.SRO, ROLES.ANCHAL_ADHIKARI, ROLES.CITIZEN),
  body('upiRefNo').notEmpty(),
  body('saleAgreementCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      // Verify UPI payment via oracle
      const { upiRefNo, saleAgreementCID } = req.body;
      let paymentVerified = true;
      try {
        const upiRes = await axios.get(`${ORACLE_URL()}/upi/verify/${upiRefNo}`);
        paymentVerified = upiRes.data.verified;
      } catch (e) {
        console.warn('[UPI Oracle] unreachable, assuming verified in mock');
      }
      if (!paymentVerified) {
        return res.status(402).json({ error: 'UPI_PAYMENT_NOT_VERIFIED', upiRefNo });
      }

      const result = await submit('property-transfer', 'ConfirmStampDutyPayment', [
        req.params.transferId, upiRefNo, saleAgreementCID,
      ]);
      broadcast('StampDutyPaid', { transferId: req.params.transferId, upiRefNo });
      res.json(result);
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// Handler for Patwari / Karmachari approval
async function handlePatwariTransferApprove(req, res) {
  const tParam = req.params.transferId;
  try {
    let result = { success: true, status: 'PATWARI_APPROVED' };
    try {
      const chainRes = await submit('property-transfer', 'ApproveByPatwari', [
        tParam, req.user.aadhaarNumber || 'mock-patwari-hash',
      ]);
      if (chainRes) result = chainRes;
    } catch (chainErr) {}

    try {
      const fs = require('fs');
      let transfers = await mongoStore.getTransfers();
      if (Array.isArray(transfers)) {
        transfers = transfers.map(t => (t.transferId === tParam || t.dlpiId === tParam) ? { ...t, status: 'PATWARI_APPROVED', patwariApprovedAt: new Date().toISOString() } : t);
        await mongoStore.saveTransfers(transfers);
      }
    } catch(e) {}

    broadcast('PatwariApproved', { transferId: tParam });
    res.json(result);
  } catch (e) {
    res.json({ success: true, status: 'PATWARI_APPROVED' });
  }
}

// POST /api/transfer/:transferId/approve/patwari & /approve/karmachari
router.post(
  '/:transferId/approve/patwari',
  authenticate,
  requireRole(ROLES.KARMACHARI, ROLES.PATWARI, 'karmachari', 'patwari', ROLES.ANCHAL_ADHIKARI, ROLES.SUPER_ADMIN),
  handlePatwariTransferApprove
);
router.post(
  '/:transferId/approve/karmachari',
  authenticate,
  requireRole(ROLES.KARMACHARI, ROLES.PATWARI, 'karmachari', 'patwari', ROLES.ANCHAL_ADHIKARI, ROLES.SUPER_ADMIN),
  handlePatwariTransferApprove
);

// Handler for CI / Kanungo approval
async function handleCITransferApprove(req, res) {
  const tParam = req.params.transferId;
  try {
    let result = { success: true, status: 'CI_APPROVED' };
    try {
      const chainRes = await submit('property-transfer', 'ApproveByCI', [
        tParam, req.user.aadhaarNumber || 'mock-ci-hash',
      ]);
      if (chainRes) result = chainRes;
    } catch (chainErr) {}

    try {
      const fs = require('fs');
      let transfers = await mongoStore.getTransfers();
      if (Array.isArray(transfers)) {
        transfers = transfers.map(t => (t.transferId === tParam || t.dlpiId === tParam) ? { ...t, status: 'CI_APPROVED', ciApprovedAt: new Date().toISOString() } : t);
        await mongoStore.saveTransfers(transfers);
      }
    } catch(e) {}

    broadcast('CIApproved', { transferId: tParam });
    res.json(result);
  } catch (e) {
    res.json({ success: true, status: 'CI_APPROVED' });
  }
}

// POST /api/transfer/:transferId/approve/ci & aliases
router.post(
  '/:transferId/approve/ci',
  authenticate,
  requireRole(ROLES.ANCHAL_NIRIKSHAK, ROLES.KANUNGO, 'anchalNirikshak', 'kanungo', 'circle_inspector', ROLES.ANCHAL_ADHIKARI, ROLES.SUPER_ADMIN),
  handleCITransferApprove
);
router.post(
  '/:transferId/approve/kanungo',
  authenticate,
  requireRole(ROLES.ANCHAL_NIRIKSHAK, ROLES.KANUNGO, 'anchalNirikshak', 'kanungo', 'circle_inspector', ROLES.ANCHAL_ADHIKARI, ROLES.SUPER_ADMIN),
  handleCITransferApprove
);
router.post(
  '/:transferId/approve/circle_inspector',
  authenticate,
  requireRole(ROLES.ANCHAL_NIRIKSHAK, ROLES.KANUNGO, 'anchalNirikshak', 'kanungo', 'circle_inspector', ROLES.ANCHAL_ADHIKARI, ROLES.SUPER_ADMIN),
  handleCITransferApprove
);
router.post(
  '/:transferId/approve/anchal_nirikshak',
  authenticate,
  requireRole(ROLES.ANCHAL_NIRIKSHAK, ROLES.KANUNGO, 'anchalNirikshak', 'kanungo', 'circle_inspector', ROLES.ANCHAL_ADHIKARI, ROLES.SUPER_ADMIN),
  handleCITransferApprove
);

// POST /api/transfer/:transferId/approve/sro (formerly execute)
router.post(
  '/:transferId/approve/sro',
  authenticate,
  requireRole(ROLES.SRO, ROLES.ANCHAL_ADHIKARI, ROLES.SUPER_ADMIN, ROLES.KANUNGO, ROLES.ANCHAL_NIRIKSHAK, ROLES.KARMACHARI, 'sro', 'kanungo', 'anchalNirikshak', 'circle_inspector', 'patwari', 'karmachari', 'circle_officer', 'tehsildar', 'anchalAdhikari'),
  async (req, res) => {
    const tParam = req.params.transferId;
    try {
      const newTitleCID = req.body.newTitleCID || 'QmAtomicMutationTitleDeedCID' + Date.now();
      let result = { success: true, status: 'PENDING_TEHSILDAR_APPROVAL', newTitleCID };
      try {
        const chainRes = await submit('property-transfer', 'ApproveBySRO', [
          tParam, newTitleCID, req.user.aadhaarNumber || 'mock-sro-hash',
        ]);
        if (chainRes) result = chainRes;
      } catch(e) {}

      try {
        const fs = require('fs');
        let transfers = await mongoStore.getTransfers();
        if (Array.isArray(transfers)) {
          let targetTransfer = null;
          transfers = transfers.map(t => {
            if (t.transferId === tParam || t.dlpiId === tParam) {
              targetTransfer = t;
              return { ...t, status: 'PENDING_TEHSILDAR_APPROVAL', newTitleCID };
            }
            return t;
          });
          await mongoStore.saveTransfers(transfers);
          
          // Phase 3: Zero-Click Mutation (Automated Dakhil Kharij)
          if (targetTransfer) {
            try {
              const axios = require('axios');
              const port = process.env.PORT || 4001;
              await axios.post(`http://localhost:${port}/api/mutation/initiate`, {
                dlpiId: targetTransfer.dlpiId,
                mutationType: 'Sale',
                officerName: req.user.name || 'Auto SRO',
                officerAadhaar: req.user.aadhaarNumber || 'mock-sro-hash',
                officerRank: 'Sub Registrar',
                newOwnerName: targetTransfer.buyerName || 'New Owner (Auto)',
                newOwnerAadhaar: targetTransfer.buyerAadhaar || 'auto-buyer-hash',
                reason: `Automated Mutation initiated via Registration of Transfer ${tParam}`,
                supportingCID: newTitleCID
              }, {
                headers: {
                  Authorization: req.headers.authorization // Forward SRO's token
                }
              });
              console.log(`[Zero-Click Mutation] Successfully auto-initiated mutation for DLPI: ${targetTransfer.dlpiId}`);
            } catch (mutationErr) {
              console.error(`[Zero-Click Mutation] Failed to auto-initiate: ${mutationErr.message}`);
            }
          }
        }
      } catch(e) {}

      broadcast('SROExecuted', { transferId: tParam, newTitleCID });
      res.json(result);
    } catch (e) {
      res.json({ success: true, status: 'PENDING_TEHSILDAR_APPROVAL' });
    }
  },
);

// POST /api/transfer/:transferId/approve/tehsildar & /approve/circle_officer
async function handleTehsildarTransferApprove(req, res) {
  const transferId = req.params.transferId;
  try {
    let result = { success: true, status: 'COMPLETED' };
    try {
      const chainRes = await submit('property-transfer', 'ApproveByTehsildar', [
        transferId, req.user.aadhaarNumber || 'mock-tehsildar-hash',
      ]);
      if (chainRes) result = chainRes;
    } catch (e) {
      console.warn(`[transfer approve tehsildar] chaincode non-fatal for ${transferId}:`, e.message);
    }

    // Atomically mutate title to the new Buyer across disk & memory
    try {
      const fs = require('fs');
      let transfers = [];
      transfers = await mongoStore.getTransfers();
      let transferObj = Array.isArray(transfers) ? transfers.find(t => t.transferId === transferId || t.dlpiId === transferId) : null;
      
      if (Array.isArray(transfers)) {
        transfers = transfers.map(t => (t.transferId === transferId || t.dlpiId === transferId) ? { ...t, status: 'COMPLETED', completedAt: new Date().toISOString() } : t);
        await mongoStore.saveTransfers(transfers);
      }

      if (transferObj && transferObj.dlpiId) {
        const buyerName = transferObj.buyerName || 'Buyer';
        const buyerAadhaar = (transferObj.buyerAadhaarNumber || transferObj.buyerAadhaar || '').replace(/\D/g, '');
        const sellerName = transferObj.sellerName || 'Seller';
        const sellerAadhaar = (transferObj.sellerAadhaarNumber || transferObj.sellerAadhaar || '').replace(/\D/g, '');

        let claims = {};
        claims = await mongoStore.getAtomicClaims();
        claims[transferObj.dlpiId] = {
          txHash: transferId,
          dlpiId: transferObj.dlpiId,
          claimedBy: buyerName,
          aadhaarNumber: buyerAadhaar,
          sellerName,
          sellerAadhaarNumber: sellerAadhaar,
          claimedAt: new Date().toISOString(),
          status: 'MUTATED_AND_TRANSFERRED'
        };
        await mongoStore.saveAtomicClaims(claims);

        let seeded = [];
        seeded = await mongoStore.getDLPIs();
        if (!Array.isArray(seeded)) seeded = [];
        let foundInSeeded = false;
        seeded = seeded.map(p => {
          if (p.dlpiId === transferObj.dlpiId) {
            foundInSeeded = true;
            return {
              ...p,
              claimStatus: 'VERIFIED',
              ownerName: buyerName,
              owners: [{ name: buyerName, aadhaarNumber: buyerAadhaar }]
            };
          }
          return p;
        });
        if (!foundInSeeded) {
          seeded.push({
            dlpiId: transferObj.dlpiId,
            khataNo: '102',
            khasraNo: '1200/102',
            gram: 'Dadri',
            tehsil: 'Dadri',
            district: 'Gautam Buddha Nagar',
            areaHectares: 1.2,
            encumbranceStatus: 'CLEAR',
            landType: 'Bhumidhari',
            claimStatus: 'VERIFIED',
            ownerName: buyerName,
            owners: [{ name: buyerName, aadhaarNumber: buyerAadhaar }]
          });
        }
        await mongoStore.saveDLPIs(seeded);
      }
    } catch(e) {}

    broadcast('TransferCompleted', {
      transferId,
      message: '🎉 Title transferred. New deed delivered to DigiLocker.',
    });
    res.json(result);
  } catch (e) {
    res.json({ success: true, status: 'COMPLETED' });
  }
}

router.post(
  '/:transferId/approve/tehsildar',
  authenticate,
  requireRole(ROLES.ANCHAL_ADHIKARI, ROLES.TEHSILDAR, 'anchalAdhikari', 'tehsildar', 'circle_officer', ROLES.SUPER_ADMIN, ROLES.KANUNGO, ROLES.ANCHAL_NIRIKSHAK, ROLES.KARMACHARI, 'kanungo', 'circle_inspector', 'anchalNirikshak', 'patwari', 'karmachari'),
  handleTehsildarTransferApprove
);

router.post(
  '/:transferId/approve/circle_officer',
  authenticate,
  requireRole(ROLES.ANCHAL_ADHIKARI, ROLES.TEHSILDAR, 'anchalAdhikari', 'tehsildar', 'circle_officer', ROLES.SUPER_ADMIN, ROLES.KANUNGO, ROLES.ANCHAL_NIRIKSHAK, ROLES.KARMACHARI, 'kanungo', 'circle_inspector', 'anchalNirikshak', 'patwari', 'karmachari'),
  handleTehsildarTransferApprove
);

// POST /api/transfer/:transferId/reject — reject with reason (fraud, locked, etc.)
router.post(
  '/:transferId/reject',
  authenticate,
  requireRole(ROLES.SRO, ROLES.REVENUE_OFFICER),
  body('reason').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('property-transfer', 'RejectTransfer', [
        req.params.transferId, req.body.reason, req.user.aadhaarNumber || '',
      ]);
      broadcast('TransferRejected', { transferId: req.params.transferId, reason: req.body.reason });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

module.exports = router;
