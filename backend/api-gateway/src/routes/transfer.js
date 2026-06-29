'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const axios = require('axios');
const { submit, evaluate } = require('../services/fabric');
const { broadcast } = require('../services/websocket');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

const router = Router();
const ORACLE_URL = () => process.env.ORACLE_SERVICE_URL || 'http://localhost:8001';

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
  requireRole(ROLES.SRO, ROLES.REVENUE_OFFICER, ROLES.CITIZEN),
  body('dlpiId').matches(/^DLPI-[A-Z]{2}-[A-Z]{3}-[A-Z0-9]+$/),
  body('sellerAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('buyerName').notEmpty().trim(),
  body('buyerAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('declaredValueINR').isInt({ min: 1 }),
  validate,
  async (req, res) => {
    try {
      const { dlpiId, sellerAadhaarHash, buyerName, buyerAadhaarHash, declaredValueINR } = req.body;
      const isTribalBuyer = req.body.isTribalBuyer || false;
      const tribalCertHash = req.body.tribalCertHash || '';
      const tribalCommunity = req.body.tribalCommunity || '';

      // Step 1: TribalGuard pre-check
      const tribalCheck = await submit('tribal-guard', 'CheckTransfer', [
        dlpiId, buyerName, buyerAadhaarHash,
        String(isTribalBuyer), tribalCertHash, tribalCommunity,
      ]);
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
      const result = await submit('property-transfer', 'InitiateTransfer', [
        dlpiId, sellerAadhaarHash, buyerName, buyerAadhaarHash,
        String(declaredValueINR), String(oracleValueINR),
        req.user.aadhaarHash || '', preemptionJSON,
      ]);

      // Record fraud score on-chain asynchronously
      if (result.transferId) {
        submit('property-transfer', 'RecordFraudScore', [
          result.transferId, String(fraudScore), JSON.stringify([]),
        ]).catch(() => {});

        broadcast('TransferInitiated', {
          transferId: result.transferId,
          dlpiId,
          oracleValueINR,
          fraudScore,
          nationalLockAcquired: true,
        }, dlpiId);
      }

      res.status(201).json({ ...result, oracleValueINR, fraudScore });
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/transfer — list (officer view)
router.get('/', authenticate, async (req, res) => {
  try {
    const list = await evaluate('property-transfer', 'GetAllTransfers', []);
    res.json(list || []);
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
      const transfer = await evaluate('property-transfer', 'GetTransfer', [req.params.transferId]);
      if (!transfer) return res.status(404).json({ error: 'TRANSFER_NOT_FOUND' });
      res.json(transfer);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/transfer/:transferId/consent
// Demo Scene 4: seller + buyer each call this with their Aadhaar eSign
router.post(
  '/:transferId/consent',
  authenticate,
  body('partyType').isIn(['SELLER', 'BUYER']),
  body('aadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { partyType, aadhaarHash, eSignTxHash } = req.body;
      const result = await submit('property-transfer', 'RecordConsent', [
        req.params.transferId, partyType, aadhaarHash, eSignTxHash,
      ]);
      broadcast('ConsentRecorded', { transferId: req.params.transferId, partyType });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/transfer/:transferId/stamp-duty — UPI reference confirms payment
router.post(
  '/:transferId/stamp-duty',
  authenticate,
  requireRole(ROLES.SRO, ROLES.REVENUE_OFFICER),
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
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/transfer/:transferId/execute — SRO final execution + DigiLocker delivery
router.post(
  '/:transferId/execute',
  authenticate,
  requireRole(ROLES.SRO),
  body('newTitleCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const result = await submit('property-transfer', 'ExecuteTransfer', [
        req.params.transferId, req.body.newTitleCID,
      ]);
      broadcast('TransferCompleted', {
        transferId: req.params.transferId,
        newTitleCID: req.body.newTitleCID,
        message: '🎉 Title transferred. New deed delivered to DigiLocker.',
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
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

module.exports = router;
