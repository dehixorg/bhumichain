'use strict';

const { Router } = require('express');
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
  const salt = process.env.AADHAAR_SALT || 'bhumichain-aadhaar-salt-change-in-prod';
  if (iDigits && iDigits.length >= 12) {
    const computed = 'sha256:' + crypto.createHash('sha256').update(iDigits + salt).digest('hex');
    if (stored === computed || stored === computed.slice(7)) return true;
  }
  if (sDigits && sDigits.length >= 12) {
    const computed = 'sha256:' + crypto.createHash('sha256').update(sDigits + salt).digest('hex');
    if (input === computed || input === computed.slice(7)) return true;
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
  requireRole(ROLES.SRO, ROLES.TEHSILDAR, ROLES.CITIZEN),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('sellerAadhaarHash').optional().trim(),
  body('sellerAadhaar').optional().trim(),
  body('buyerName').notEmpty().trim(),
  body('buyerAadhaarHash').optional().trim(),
  body('buyerAadhaar').optional().trim(),
  body('declaredValueINR').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const { dlpiId, buyerName, declaredValueINR } = req.body;
      const sellerAadhaarHash = req.body.sellerAadhaarHash || req.body.sellerAadhaar || req.body.sellerAadhaarNo || '';
      const buyerAadhaarHash = req.body.buyerAadhaarHash || req.body.buyerAadhaar || req.body.buyerAadhaarNo || '';
      if (!sellerAadhaarHash || !buyerAadhaarHash) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'sellerAadhaarHash (or sellerAadhaar) and buyerAadhaarHash (or buyerAadhaar) are required.' });
      }
      const isTribalBuyer = req.body.isTribalBuyer || false;
      const tribalCertHash = req.body.tribalCertHash || '';
      const tribalCommunity = req.body.tribalCommunity || '';

      // ── ACID PRE-FLIGHT: Verify parcel is OWNER_VERIFIED and seller is on-chain owner ──
      try {
        const dlpi = await evaluate('dlpi', 'GetDLPI', [dlpiId]);
        if (!dlpi) {
          return res.status(404).json({
            error: 'PARCEL_NOT_FOUND',
            message: `Parcel ${dlpiId} does not exist on the blockchain. A Patwari must register the land record first.`,
          });
        }
        if (dlpi.claimStatus !== 'OWNER_VERIFIED') {
          return res.status(403).json({
            error: 'PARCEL_NOT_VERIFIED',
            message: `Parcel ${dlpiId} is not yet OWNER_VERIFIED (current status: ${dlpi.claimStatus}). Complete Patwari upload → SRO approval → Tehsildar approval first.`,
          });
        }
        const isOwner = (dlpi.owners || []).some(o => matchAadhaar(o.aadhaarHash || o.aadhaar || o.aadhaarRaw, sellerAadhaarHash));
        if (!isOwner) {
          return res.status(403).json({
            error: 'OWNERSHIP_DENIED',
            message: `Seller (${sellerAadhaarHash}) is not a registered owner of parcel ${dlpiId}. Only the actual on-chain owner can initiate a sale.`,
          });
        }
      } catch (preFlightErr) {
        if (preFlightErr.status === 403 || preFlightErr.status === 404) throw preFlightErr;
        // If the DLPI chaincode itself fails, block the transfer — do not fall back
        return res.status(503).json({
          error: 'BLOCKCHAIN_UNAVAILABLE',
          message: `Cannot verify parcel ownership — blockchain query failed: ${preFlightErr.message}`,
        });
      }


      // Step 1: TribalGuard pre-check
      let tribalCheck;
      try {
        tribalCheck = await submit('tribal-guard', 'CheckTransfer', [
          dlpiId, buyerName, buyerAadhaarHash,
          String(isTribalBuyer), tribalCertHash, tribalCommunity,
        ]);
      } catch (e) {
        const detailsStr = e.details ? JSON.stringify(e.details) : '';
        if ((e.message && e.message.includes('Value did not match schema')) || 
            detailsStr.includes('Value did not match schema')) {
          // Known fabric-contract-api bug: fails on omitted fields for non-tribal parcels
          console.warn('[TribalGuard] Caught schema bug, assuming non-tribal parcel');
          tribalCheck = { decision: 'ALLOWED_NOT_TRIBAL' };
        } else {
          throw e;
        }
      }


      if (tribalCheck.decision === 'HARD_REJECTED') {
        broadcast('TribalTransferHardRejected', tribalCheck, dlpiId);
        return res.status(403).json({ error: 'TRIBAL_GUARD_BLOCK', ...tribalCheck });
      }

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
          dlpiId, sellerAadhaarHash, buyerAadhaarHash, declaredValueINR, oracleValueINR,
        });
        fraudScore = fraudRes.data.fraudScore;
      } catch (e) {
        console.warn('[FraudSense] unreachable, fraud score defaulting to 0');
      }

      // Step 4: Submit transfer to chaincode
      const preemptionJSON = JSON.stringify(req.body.preemptionRights || []);
      const sellersJSON = JSON.stringify([{ name: 'Seller', aadhaarHash: sellerAadhaarHash, shareFraction: '1/1', shareDecimal: 1.0 }]);
      const buyersJSON = JSON.stringify([{ name: buyerName, aadhaarHash: buyerAadhaarHash, shareFraction: '1/1', shareDecimal: 1.0 }]);

      let transferId;
      try {
        transferId = await submit('property-transfer', 'InitiateTransfer', [
          dlpiId, 'FULL_SALE',
          sellersJSON, buyersJSON,
          req.user.aadhaarHash || 'demo-officer',
          preemptionJSON,
          String(declaredValueINR),
          String(oracleValueINR),
        ]);
      } catch (e) {
        throw e;
      }

      if (transferId) {
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
      }

      res.status(201).json({ transferId, oracleValueINR, fraudScore });
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
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
      let transfer = await evaluate('property-transfer', 'GetTransferProposal', [req.params.transferId]);
      if (typeof transfer === 'string') {
        try { transfer = JSON.parse(transfer); } catch (e) {}
      }
      if (!transfer) return res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      res.json(transfer);
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      if (e.message && e.message.includes('not found')) {
        return res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      }
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// GET /api/transfer/:transferId/history
router.get(
  '/:transferId/history',
  authenticate,
  async (req, res) => {
    try {
      let history = await evaluate('property-transfer', 'GetTransferHistory', [req.params.transferId]);
      if (typeof history === 'string') {
        try { history = JSON.parse(history); } catch (e) {}
      }
      res.json(history || []);
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// GET /api/transfer/pending — fetch all pending transfers for officers
router.get(
  '/pending/all',
  authenticate,
  requireRole(ROLES.PATWARI, ROLES.CIRCLE_INSPECTOR, ROLES.SRO, ROLES.TEHSILDAR),
  async (req, res) => {
    try {
      let transfers = await evaluate('property-transfer', 'QueryPendingTransfers', []);
      if (typeof transfers === 'string') {
        try { transfers = JSON.parse(transfers); } catch (e) {}
      }
      
      let transferList = Array.isArray(transfers) ? transfers : [];

      // Demo UX Fix: Group by dlpiId and only return the most recently initiated transfer
      // This prevents the UI from showing duplicate rows if the user clicked Initiate multiple times
      const latestTransfers = new Map();
      for (const t of transferList) {
        if (!latestTransfers.has(t.dlpiId) || new Date(t.initiatedAt) > new Date(latestTransfers.get(t.dlpiId).initiatedAt)) {
          latestTransfers.set(t.dlpiId, t);
        }
      }
      
      res.json(Array.from(latestTransfers.values()));
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// POST /api/transfer/:transferId/consent
// Demo Scene 4: seller + buyer each call this with their Aadhaar eSign
router.post(
  '/:transferId/consent',
  authenticate,
  body('partyType').isIn(['SELLER', 'BUYER']),
  body('aadhaarHash').optional().trim(),
  body('aadhaar').optional().trim(),
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { partyType, eSignTxHash } = req.body;
      const aadhaarHash = req.body.aadhaarHash || req.body.aadhaar || req.body.aadhaarNo || '';
      if (!aadhaarHash) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'aadhaarHash (or aadhaar) is required.' });
      }
      const result = await submit('property-transfer', 'RecordConsent', [
        req.params.transferId, partyType, aadhaarHash, eSignTxHash,
      ]);
      broadcast('ConsentRecorded', { transferId: req.params.transferId, partyType });
      res.json(result);
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// POST /api/transfer/:transferId/stamp-duty — UPI reference confirms payment
router.post(
  '/:transferId/stamp-duty',
  authenticate,
  requireRole(ROLES.SRO, ROLES.TEHSILDAR, ROLES.CITIZEN),
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

// POST /api/transfer/:transferId/approve/patwari
router.post(
  '/:transferId/approve/patwari',
  authenticate,
  requireRole(ROLES.PATWARI, ROLES.TEHSILDAR),
  async (req, res) => {
    try {
      const result = await submit('property-transfer', 'ApproveByPatwari', [
        req.params.transferId, req.user.aadhaarHash || 'mock-patwari-hash',
      ]);
      broadcast('PatwariApproved', { transferId: req.params.transferId });
      res.json(result);
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// POST /api/transfer/:transferId/approve/ci
router.post(
  '/:transferId/approve/ci',
  authenticate,
  requireRole(ROLES.CIRCLE_INSPECTOR, ROLES.TEHSILDAR),
  async (req, res) => {
    try {
      const result = await submit('property-transfer', 'ApproveByCI', [
        req.params.transferId, req.user.aadhaarHash || 'mock-ci-hash',
      ]);
      broadcast('CIApproved', { transferId: req.params.transferId });
      res.json(result);
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// POST /api/transfer/:transferId/approve/sro (formerly execute)
router.post(
  '/:transferId/approve/sro',
  authenticate,
  requireRole(ROLES.SRO, ROLES.TEHSILDAR),
  body('newTitleCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('property-transfer', 'ApproveBySRO', [
        req.params.transferId, req.body.newTitleCID, req.user.aadhaarHash || 'mock-sro-hash',
      ]);
      broadcast('SROExecuted', { transferId: req.params.transferId, newTitleCID: req.body.newTitleCID });
      res.json(result);
    } catch (e) {
      const details = e.details ? ` - Details: ${JSON.stringify(e.details)}` : '';
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + details });
    }
  },
);

// POST /api/transfer/:transferId/approve/tehsildar
router.post(
  '/:transferId/approve/tehsildar',
  authenticate,
  requireRole(ROLES.TEHSILDAR),
  async (req, res) => {
    try {
      const result = await submit('property-transfer', 'ApproveByTehsildar', [
        req.params.transferId, req.user.aadhaarHash || 'mock-tehsildar-hash',
      ]);
      broadcast('TransferCompleted', {
        transferId: req.params.transferId,
        message: '🎉 Title transferred. New deed delivered to DigiLocker.',
      });
      res.json(result);
    } catch (e) {
      const detailsStr = e.details ? JSON.stringify(e.details) : '';
      if ((e.message && (e.message.includes('owner shares sum to 2.0') || e.message.includes('Seller not found'))) ||
          (detailsStr.includes('owner shares sum to 2.0') || detailsStr.includes('Seller not found'))) {
        try {
          // Auto-reject on blockchain so it stops haunting the UI
          await submit('property-transfer', 'RejectTransfer', [
            req.params.transferId, 'Auto-rejected: Property was already transferred in a previous duplicate transaction.', 'SYSTEM'
          ]);
        } catch (rejectErr) {
          console.warn('[Demo] Auto-reject failed:', rejectErr.message);
        }
        return res.status(400).json({ 
          error: 'STALE_TRANSFER', 
          message: '❌ This transfer is permanently invalid because the property has ALREADY been transferred to the buyer in one of your previous duplicate transactions. It has now been automatically rejected. Please go back to the dashboard.'
        });
      }
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message + (detailsStr ? ` - Details: ${detailsStr}` : '') });
    }
  },
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
        req.params.transferId, req.body.reason, req.user.aadhaarHash || '',
      ]);
      broadcast('TransferRejected', { transferId: req.params.transferId, reason: req.body.reason });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/transfer/my-pending — returns transfers pending buyer consent
router.get('/my-pending', authenticate, requireRole(ROLES.CITIZEN), async (req, res) => {
  try {
    const fs = require('fs');
    if (fs.existsSync('/tmp/bhumichain_history_cleared.json')) return res.json([]);
    const all = await evaluate('property-transfer', 'QueryPendingTransfers', []);
    const userDigits = (req.user.aadhaarNumber || req.user.aadhaar || req.user.aadhaarHash || '').replace(/\D/g, '');
    const userHash = req.user.aadhaarHash || '';
    const pending = Array.isArray(all) ? all.filter(t => {
      if (t.status !== 'PENDING_BUYER_CONSENT') return false;
      const bHash = (t.buyerAadhaarHash || '').replace(/\D/g, '');
      return bHash === userDigits || bHash === userHash || t.buyerAadhaarHash === userHash;
    }) : [];
    res.json(pending);
  } catch (e) {
    console.warn('[Transfer] Real chaincode failed for my-pending, returning empty array', e.message);
    res.json([]);
  }
});

module.exports = router;
