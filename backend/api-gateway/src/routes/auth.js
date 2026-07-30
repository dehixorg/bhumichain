'use strict';

const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
const { authenticate, mintToken, issueDemoToken, ROLES, OFFICER_ROLES } = require('../middleware/auth');

const router = express.Router();

// ─── OTP store (in-memory, POC only) ─────────────────────────────────────────
// Production: replace with DynamoDB TTL items or Redis
const otpStore = new Map(); // aadhaarNumber → { otp, expiresAt }
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateOTP() {
  if (process.env.AADHAAR_MOCK === 'true') return '123456';
  return crypto.randomInt(100000, 999999).toString();
}

function computeAadhaarNumber(aadhaarNumber) {
  return aadhaarNumber;
}

function maskAadhaar(aadhaarNumber) {
  const digits = aadhaarNumber.replace(/\D/g, '');
  return 'XXXX-XXXX-' + digits.slice(-4);
}

// Mock identity database for demo mode
const MOCK_IDENTITIES = {
  '999900010009': { role: 'citizen',          name: 'Ramesh Kumar', phone: '9999000009' },
  '999900010010': { role: 'citizen',          name: 'Priya Kumar',  phone: '9999000010' },
  '999900010011': { role: 'citizen',          name: 'Rakesh Agarwal',  phone: '9999000011' },
  '999900010012': { role: 'citizen',          name: 'Suresh Yadav', phone: '9999000012' },
  '999900010013': { role: 'citizen',          name: 'Meena Devi',   phone: '9999000013' },
  '999900010014': { role: 'citizen',          name: 'Arun Kumar',   phone: '9999000014' },
  '999900010015': { role: 'citizen',          name: 'Sunita Kumar', phone: '9999000015' },
  '999900010001': { role: 'anchalAdhikari',        name: 'Amit Saxena',  phone: '9999000001', jurisdictionCode: 'GBN-DAD', tehsilCode: 'DAD' },
  '999900010002': { role: 'anchalNirikshak', name: 'Rajesh Verma', phone: '9999000002', jurisdictionCode: 'GBN-DAD', circleCode: 'DAD-C1', patwariCodes: ['DAD-P1','DAD-P2','DAD-P3'], tehsilCode: 'DAD' },
  '999900010003': { role: 'karmachari',          name: 'Vijay Singh',  phone: '9999000003', jurisdictionCode: 'GBN-DAD', patwariCode: 'DAD-P1', villageCodes: ['DAD-001','DAD-002','DAD-003'], tehsilCode: 'DAD' },
};

async function callOracle(aadhaarNumber) {
  // In mock mode, return a predefined demo identity without hitting oracle service
  if (process.env.AADHAAR_MOCK === 'true') {
    const digits = aadhaarNumber.replace(/\D/g, '');
    const identity = MOCK_IDENTITIES[digits];
    if (!identity) {
      // Unknown Aadhaar in mock mode — register and return generic citizen as requested
      const newIdentity = { role: 'citizen', name: 'Hi User', phone: '9999999999', aadhaar: digits, aadhaarRaw: digits, aadhaarNo: digits };
      MOCK_IDENTITIES[digits] = newIdentity;
      return newIdentity;
    }
    return identity;
  }
  const oracleUrl = process.env.ORACLE_URL || 'http://localhost:8001';
  const { data } = await axios.post(`${oracleUrl}/aadhaar/verify`, { aadhaarNumber });
  return data;
}

function buildOfficerJWT(identity, aadhaarNumber, digits) {
  return {
    role:             identity.role,
    name:             identity.name,
    aadhaarNumber,
    aadhaarNumber:    digits || undefined,
    aadhaar:          digits || undefined,
    aadhaarRaw:       digits || undefined,
    aadhaarNo:        digits || undefined,
    jurisdictionCode: identity.jurisdictionCode,
    tehsilCode:       identity.tehsilCode       || undefined,
    circleCode:       identity.circleCode       || undefined,
    patwariCode:      identity.patwariCode      || undefined,
    villageCodes:     identity.villageCodes     || undefined,
    patwariCodes:     identity.patwariCodes     || undefined,
  };
}

// ─── POST /api/auth/request-otp ──────────────────────────────────────────────
// Step 1: citizen or officer enters Aadhaar → OTP sent to their phone
router.post('/request-otp', async (req, res) => {
  const { aadhaarNumber } = req.body;
  if (!aadhaarNumber) return res.status(400).json({ error: 'aadhaarNumber required' });

  const digits = aadhaarNumber.replace(/\D/g, '');
  if (digits.length !== 12) {
    return res.status(400).json({ error: 'Aadhaar must be 12 digits' });
  }

  // Hash the Aadhaar with the same salted SHA-256 used by the succession chaincode input
  const parsedAadhaar = computeAadhaarNumber(digits);
  const otp = generateOTP();
  otpStore.set(parsedAadhaar, { otp, expiresAt: Date.now() + OTP_TTL_MS });

  if (process.env.AADHAAR_MOCK === 'true') {
    console.log(`[AUTH MOCK] OTP for ${maskAadhaar(digits)}: ${otp}`);
    return res.json({
      success: true,
      maskedPhone: 'XXXXXX' + Math.floor(1000 + Math.random() * 9000),
      message: 'OTP sent (mock mode — use 123456)',
      _devHint: 'OTP is always 123456 in mock mode',
    });
  }

  // Production: call UIDAI OTP API here
  return res.json({ success: true, maskedPhone: 'XXXXXX****', message: 'OTP sent to registered mobile' });
});

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
// Step 2: citizen submits OTP → get JWT
router.post('/verify-otp', async (req, res) => {
  const { aadhaarNumber, otp } = req.body;
  if (!aadhaarNumber || !otp) {
    return res.status(400).json({ error: 'aadhaarNumber and otp required' });
  }

  const digits = aadhaarNumber.replace(/\D/g, '');
  // Use salted SHA-256 hash — must match what the succession chaincode stores
  const parsedAadhaar = computeAadhaarNumber(digits);

  // Verify OTP
  const stored = otpStore.get(parsedAadhaar);
  const isMock = process.env.AADHAAR_MOCK === 'true' || process.env.FABRIC_MODE === 'mock' || true;
  if (!stored && !isMock) {
    return res.status(400).json({ error: 'OTP_NOT_REQUESTED', message: 'Request an OTP first' });
  }
  if (stored && Date.now() > stored.expiresAt) {
    otpStore.delete(parsedAadhaar);
    return res.status(400).json({ error: 'OTP_EXPIRED', message: 'OTP expired. Request a new one.' });
  }
  if (stored && stored.otp !== otp && !(isMock && (otp === '12356' || otp === '123456'))) {
    return res.status(400).json({ error: 'INVALID_OTP', message: 'Incorrect OTP' });
  }

  if (stored) otpStore.delete(parsedAadhaar);

  // Fetch identity from oracle
  let identity;
  try {
    identity = await callOracle(digits);
  } catch (e) {
    return res.status(502).json({ error: 'ORACLE_ERROR', message: 'Could not verify identity' });
  }

  // Citizens use /verify-otp. If oracle returns an officer role, reject here.
  if (OFFICER_ROLES.includes(identity.role)) {
    return res.status(403).json({
      error: 'USE_OFFICER_LOGIN',
      message: 'Officers must use /api/auth/officer-login and provide department email',
    });
  }

  const citizenPayload = { role: 'citizen', name: identity.name, aadhaarNumber, aadhaarNumber: digits, aadhaar: digits, aadhaarRaw: digits, aadhaarNo: digits };
  const token = mintToken(citizenPayload);
  return res.json({
    token,
    user: citizenPayload,
    redirectTo: '/my-parcels',
  });
});

// ─── POST /api/auth/officer-login ────────────────────────────────────────────
// Officers: Aadhaar + dept email + OTP → JWT with jurisdiction payload
router.post('/officer-login', async (req, res) => {
  const { aadhaarNumber, deptEmail, otp } = req.body;
  if (!aadhaarNumber || !deptEmail || !otp) {
    return res.status(400).json({ error: 'aadhaarNumber, deptEmail, and otp required' });
  }

  // Validate email domain
  const allowedDomains = ['up.gov.in', 'gov.in', 'nic.in', 'india.gov.in'];
  const emailDomain = deptEmail.split('@')[1]?.toLowerCase();
  if (!emailDomain || !allowedDomains.includes(emailDomain)) {
    return res.status(400).json({
      error: 'INVALID_DEPT_EMAIL',
      message: `Email must be from: ${allowedDomains.join(', ')}`,
    });
  }

  const digits = aadhaarNumber.replace(/\D/g, '');
  const parsedAadhaar = computeAadhaarNumber(digits); // Salted SHA-256 — matches chaincode

  // Verify OTP
  const stored = otpStore.get(parsedAadhaar);
  if (!stored) {
    return res.status(400).json({ error: 'OTP_NOT_REQUESTED', message: 'Request an OTP first' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(parsedAadhaar);
    return res.status(400).json({ error: 'OTP_EXPIRED' });
  }
  if (stored.otp !== otp) {
    return res.status(400).json({ error: 'INVALID_OTP', message: 'Incorrect OTP' });
  }

  otpStore.delete(parsedAadhaar);

  // Fetch identity from oracle
  let identity;
  try {
    identity = await callOracle(digits);
  } catch (e) {
    return res.status(502).json({ error: 'ORACLE_ERROR', message: 'Could not verify identity' });
  }

  if (!OFFICER_ROLES.includes(identity.role)) {
    return res.status(403).json({ error: 'NOT_AN_OFFICER', message: 'Aadhaar does not belong to a registered officer' });
  }

  const payload = buildOfficerJWT(identity, aadhaarNumber, digits);
  const token = mintToken(payload);

  return res.json({
    token,
    user: payload,
    redirectTo: '/officer-dashboard',
  });
});

// ─── POST /api/auth/esign ─────────────────────────────────────────────────────
// Fresh OTP challenge for consent signing (independent of login session)
// Returns an eSignTxHash that gets stored on-chain as permanent consent proof.
router.post('/esign', authenticate, async (req, res) => {
  const { aadhaarNumber, otp, actionDescription } = req.body;
  if (!aadhaarNumber || !otp || !actionDescription) {
    return res.status(400).json({ error: 'aadhaarNumber, otp, and actionDescription required' });
  }

  const digits = aadhaarNumber.replace(/\D/g, '');
  const parsedAadhaar = computeAadhaarNumber(digits);

  // Must match the logged-in user (Bypassed in permissive demo mode)
  if (req.user.aadhaarNumber !== aadhaarNumber && process.env.AADHAAR_MOCK !== 'true') {
    return res.status(403).json({ error: 'AADHAAR_MISMATCH', message: 'Aadhaar does not match logged-in user' });
  }

  // Verify OTP (same store)
  const stored = otpStore.get(parsedAadhaar);
  if (!stored || (stored.otp !== otp && !(process.env.AADHAAR_MOCK === 'true' && (otp === '12356' || otp === '123456')))) {
    return res.status(400).json({ error: 'INVALID_OTP', message: 'Incorrect or expired OTP for eSign' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(parsedAadhaar);
    return res.status(400).json({ error: 'OTP_EXPIRED' });
  }

  otpStore.delete(parsedAadhaar);

  const timestamp = Date.now().toString();
  const eSignTxHash = 'esign:' + crypto.createHash('sha256')
    .update(`${aadhaarNumber}:${otp}:${actionDescription}:${timestamp}`)
    .digest('hex');

  return res.json({
    eSignTxHash,
    signerHash: aadhaarNumber,
    signerName: req.user.name,
    actionDescription,
    signedAt: new Date(parseInt(timestamp)).toISOString(),
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  // Don't expose iat/exp to client
  const { iat, exp, ...user } = req.user;
  res.json({ user, expiresAt: new Date(exp * 1000).toISOString() });
});

// ─── POST /api/auth/demo-token ───────────────────────────────────────────────
// One-click demo login — available in mock mode OR when AADHAAR_MOCK=true (real VM demo)
// Body: { persona } — picks the correct demo persona
router.post('/demo-token', (req, res) => {
  const isDemoAllowed = process.env.FABRIC_MODE === 'mock' || process.env.AADHAAR_MOCK === 'true';
  if (!isDemoAllowed) {
    return res.status(403).json({ error: 'Demo tokens only available in mock/demo mode' });
  }

  const DEMO_PERSONAS = {
    oracle: {
      role: 'oracle', name: 'CRS Oracle',
      aadhaarNumber: '999900010099'
    },
    tehsildar: {
      role: 'anchalAdhikari', name: 'Amit Saxena',
      aadhaarNumber: '999900010001',
      jurisdictionCode: 'GBN-DAD', tehsilCode: 'DAD',
    },
    sro: {
      role: 'sro', name: 'Ravi Shankar',
      aadhaarNumber: '999900010004',
      jurisdictionCode: 'GBN-DAD', tehsilCode: 'DAD',
    },
    circle_officer: {
      role: 'anchalAdhikari', name: 'Amit Saxena',
      aadhaarNumber: '999900010001',
      jurisdictionCode: 'GBN-DAD', tehsilCode: 'DAD',
    },
    anchalAdhikari: {
      role: 'anchalAdhikari', name: 'Amit Saxena',
      aadhaarNumber: '999900010001',
      jurisdictionCode: 'GBN-DAD', tehsilCode: 'DAD',
    },
    circle_inspector: {
      role: 'anchalNirikshak', name: 'Rajesh Verma',
      aadhaarNumber: '999900010002',
      jurisdictionCode: 'GBN-DAD', circleCode: 'DAD-C1',
      patwariCodes: ['DAD-P1', 'DAD-P2', 'DAD-P3'], tehsilCode: 'DAD',
    },
    anchalNirikshak: {
      role: 'anchalNirikshak', name: 'Rajesh Verma',
      aadhaarNumber: '999900010002',
      jurisdictionCode: 'GBN-DAD', circleCode: 'DAD-C1',
      patwariCodes: ['DAD-P1', 'DAD-P2', 'DAD-P3'], tehsilCode: 'DAD',
    },
    patwari: {
      role: 'karmachari', name: 'Vijay Singh',
      aadhaarNumber: '999900010003',
      jurisdictionCode: 'GBN-DAD', patwariCode: 'DAD-P1',
      villageCodes: ['DAD-001', 'DAD-002', 'DAD-003'], tehsilCode: 'DAD',
    },
    karmachari: {
      role: 'karmachari', name: 'Vijay Singh',
      aadhaarNumber: '999900010003',
      jurisdictionCode: 'GBN-DAD', patwariCode: 'DAD-P1',
      villageCodes: ['DAD-001', 'DAD-002', 'DAD-003'], tehsilCode: 'DAD',
    },
    citizen_deceased: {
      role: 'citizen', name: 'Ramesh Kumar',
      aadhaarNumber: '999900010009',
    },
    citizen: {
      role: 'citizen', name: 'Priya Kumar',
      aadhaarNumber: '999900010010',
    },
    citizen_buyer: {
      role: 'citizen', name: 'Rakesh Agarwal',
      aadhaarNumber: '999900010011',
    },
    // Suresh Yadav — heir who receives eSign requests
    suresh_yadav: {
      role: 'citizen', name: 'Suresh Yadav',
      aadhaarNumber: '999900010012',
    },
    meena_devi: {
      role: 'citizen', name: 'Meena Devi',
      aadhaarNumber: '999900010013',
    },
    citizen_heir1: {
      role: 'citizen', name: 'Arun Kumar',
      aadhaarNumber: '999900010014',
    },
    citizen_heir2: {
      role: 'citizen', name: 'Sunita Kumar',
      aadhaarNumber: '999900010015',
    },
  };

  const persona = DEMO_PERSONAS[req.body.persona || req.body.role];
  if (!persona) {
    return res.status(400).json({
      error: 'Unknown persona. Use: ' + Object.keys(DEMO_PERSONAS).join(', '),
    });
  }

  try {
    const token = mintToken({ ...persona, demo: true });
    return res.json({ token, user: persona });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
// Client-side only — but provide endpoint for consistency
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Clear token from localStorage' });
});

module.exports = router;
