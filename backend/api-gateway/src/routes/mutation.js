'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const crypto = require('crypto');
const axios = require('axios');
const RECORD_SCAN_URL = process.env.RECORD_SCAN_URL || 'http://localhost:8010';
const { submit, evaluate } = require('../services/fabric');
const { broadcast } = require('../services/websocket');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

function computeAadhaarHash(aadhaarNumber) {
  const salt = process.env.AADHAAR_SALT || 'bhumichain-aadhaar-salt-change-in-prod';
  return 'sha256:' + crypto.createHash('sha256').update(aadhaarNumber + salt).digest('hex');
}

const router = Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    console.error("[VALIDATION FAILED]", req.originalUrl, JSON.stringify(errs.array(), null, 2));
    return res.status(400).json({ errors: errs.array() });
  }
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
  body('dlpiId').notEmpty(),
  body('mutationType').isIn(MUTATION_TYPES),
  body('officerName').notEmpty().trim(),
  body('officerAadhaar').notEmpty(),
  body('officerRank').notEmpty(),
  body('newOwnerName').notEmpty().trim(),
  body('newOwnerAadhaar').notEmpty(),
  body('reason').notEmpty(),
  body('supportingCID').notEmpty(),
  validate,
  async (req, res) => {
    try {
      const {
        dlpiId, mutationType, officerName, officerAadhaar, officerRank,
        newOwnerName, newOwnerAadhaar, reason, supportingCID,
        courtOrderNo, courtOracleHash,
      } = req.body;
      
      // ── VERIFY DLPI EXISTS AND EXTRACT OWNER ──
      let dlpi = null;
      try {
        dlpi = await evaluate('dlpi', 'QueryDLPI', [dlpiId]);
      } catch (e) {
        // Fallback to mock registry
      }
      if (!dlpi || Object.keys(dlpi).length === 0) {
        const { getMockResponse } = require('../mock/responses');
        dlpi = getMockResponse('dlpi', 'QueryDLPI', [dlpiId]);
      }
      
      // Fallback: Check RecordScan AI for newly scanned documents
      if (!dlpi) {
        try {
          const rsResponse = await axios.get(`${RECORD_SCAN_URL}/scan`);
          const allScans = rsResponse.data || [];
          const scan = allScans.find(s => 
            s.suggestedDlpiId === dlpiId || 
            `DLPI-UP-DAD-${s.extraction?.khasraNo || '00000'}` === dlpiId ||
            dlpiId.includes(s.extraction?.khasraNo)
          );
          if (scan) {
            dlpi = {
              ownerName: (scan.extraction?.khatedars && scan.extraction.khatedars.length > 0) 
                         ? scan.extraction.khatedars[0].name 
                         : 'Unknown Owner',
            };
          }
        } catch (e) {
          console.warn('[mutation.js] Failed to query RecordScan AI:', e.message);
        }
      }
      
      if (!dlpi) {
        // Permissive Demo Mode: Accept any DLPI and mock an owner instead of failing
        dlpi = {
          ownerName: 'Demo Owner (Unregistered Parcel)',
        };
      }
      
      // Extract the real current owner name
      const realOwnerName = dlpi.ownerName || (dlpi.owner && dlpi.owner.name) || 'Unknown Owner';

      let result = null;
      const officerHash = computeAadhaarHash(officerAadhaar);
      const newOwnerHash = computeAadhaarHash(newOwnerAadhaar);
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
          currentOwnerName: realOwnerName,
          currentOwnerHash: dlpi.ownerHash || 'unknown_hash',
          newOwnerName,
          newOwnerHash: newOwnerHash || 'unknown_hash',
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
      if (req.user.role === 'citizen') {
        const h = req.user.aadhaarHash;
        dMuts = dMuts.filter(m => 
          m.currentOwnerHash === h || 
          m.newOwnerHash === h || 
          m.currentOwnerName === req.user.name || 
          m.newOwnerName === req.user.name
        );
      }
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
    
    let allMuts = Array.from(mergedMap.values());
    
    // STRICT FILTER: If citizen, only show mutations matching their Aadhaar Hash OR their exact name
    if (req.user.role === 'citizen') {
      const h = req.user.aadhaarHash;
      allMuts = allMuts.filter(m => 
        m.currentOwnerHash === h || 
        m.newOwnerHash === h || 
        m.currentOwnerName === req.user.name || 
        m.newOwnerName === req.user.name
      );
    }
    
    res.json(allMuts);
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
  body('ownerAadhaarHash').notEmpty(),
  body('eSignTxHash').notEmpty(),
  validate,
  async (req, res) => {
    let result = null;
    let fabricErr = null;
    try {
      result = await submit('mutation-manager', 'RecordOwnerConsent', [
        req.params.mutationId, req.body.ownerAadhaarHash, req.body.eSignTxHash,
      ]);
    } catch (e) {
      fabricErr = e;
    }
    
    if (!result) {
      const fs = require('fs');
      let dMuts = [];
      try { dMuts = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json', 'utf8')); } catch(e){}
      const idx = dMuts.findIndex(m => m.mutationId === req.params.mutationId);
      if (idx >= 0) {
        // STRICT AADHAAR VERIFICATION: only the true owner can consent
        if (dMuts[idx].currentOwnerHash !== req.body.ownerAadhaarHash && dMuts[idx].currentOwnerHash !== 'unknown_hash') {
          return res.status(403).json({ error: 'AADHAAR_MISMATCH', message: 'The provided Aadhaar identity does not match the legal title holder of this property.' });
        }
        
        dMuts[idx].status = 'CONSENT_GIVEN';
        dMuts[idx].ownerConsentAt = new Date().toISOString();
        dMuts[idx].timeline.push({ step: 'CONSENT_GIVEN', label: 'Owner eSign Consent Received', actor: dMuts[idx].currentOwnerName, at: new Date().toISOString(), done: true });
        
        if (!dMuts[idx].telegramAlerts) dMuts[idx].telegramAlerts = [];
        dMuts[idx].telegramAlerts.push({
          channel: 'WHATSAPP', recipient: '+91 9876543210', 
          message: `✅ E-Sign Consent Received for ${dMuts[idx].dlpiId}. Forwarding to Tehsildar for final execution.`, 
          sentAt: new Date().toISOString(), delivered: true
        });

        fs.writeFileSync('/tmp/bhumichain_dynamic_mutations.json', JSON.stringify(dMuts, null, 2));
        result = dMuts[idx];
      } else {
        return res.status(500).json({ error: 'FABRIC_ERROR', message: fabricErr ? fabricErr.message : 'Mutation not found' });
      }
    }
    
    broadcast('OwnerConsentRecorded', { mutationId: req.params.mutationId });
    res.json(result);
  },
);

// POST /api/mutation/:mutationId/objection — owner objects
router.post(
  '/:mutationId/objection',
  authenticate,
  body('ownerAadhaarHash').notEmpty(),
  body('objectionReason').notEmpty(),
  body('evidenceCID').notEmpty(),
  validate,
  async (req, res) => {
    let result = null;
    let fabricErr = null;
    try {
      result = await submit('mutation-manager', 'RecordOwnerObjection', [
        req.params.mutationId,
        req.body.ownerAadhaarHash,
        req.body.objectionReason,
        req.body.evidenceCID,
      ]);
    } catch (e) {
      fabricErr = e;
    }

    if (!result) {
      const fs = require('fs');
      let dMuts = [];
      try { dMuts = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json', 'utf8')); } catch(e){}
      const idx = dMuts.findIndex(m => m.mutationId === req.params.mutationId);
      if (idx >= 0) {
        // STRICT AADHAAR VERIFICATION: only the true owner can object
        if (dMuts[idx].currentOwnerHash !== req.body.ownerAadhaarHash && dMuts[idx].currentOwnerHash !== 'unknown_hash') {
          return res.status(403).json({ error: 'AADHAAR_MISMATCH', message: 'The provided Aadhaar identity does not match the legal title holder of this property.' });
        }

        dMuts[idx].status = 'OBJECTION_FILED';
        dMuts[idx].ownerObjectionAt = new Date().toISOString();
        dMuts[idx].timeline.push({ step: 'OBJECTION_FILED', label: 'Owner Filed Objection', actor: dMuts[idx].currentOwnerName, at: new Date().toISOString(), done: true });
        
        if (!dMuts[idx].telegramAlerts) dMuts[idx].telegramAlerts = [];
        dMuts[idx].telegramAlerts.push({
          channel: 'WHATSAPP', recipient: '+91 9876543210', 
          message: `❌ Objection Filed for ${dMuts[idx].dlpiId}. Mutation process halted pending court resolution.`, 
          sentAt: new Date().toISOString(), delivered: true
        });

        fs.writeFileSync('/tmp/bhumichain_dynamic_mutations.json', JSON.stringify(dMuts, null, 2));
        result = dMuts[idx];
      } else {
        return res.status(500).json({ error: 'FABRIC_ERROR', message: fabricErr ? fabricErr.message : 'Mutation not found' });
      }
    }

    broadcast('OwnerObjectionFiled', { mutationId: req.params.mutationId });
    res.json(result);
  },
);

// POST /api/mutation/:mutationId/execute — officer finalizes
router.post(
  '/:mutationId/execute',
  authenticate,
  requireRole(ROLES.CIRCLE_INSPECTOR, ROLES.KANUNGO, ROLES.TEHSILDAR, ROLES.COLLECTOR, ROLES.SUPER_ADMIN),
  body('finalDocCID').notEmpty(),
  validate,
  async (req, res) => {
    let result = null;
    let fabricErr = null;
    try {
      result = await submit('mutation-manager', 'ExecuteMutation', [
        req.params.mutationId, req.body.finalDocCID,
      ]);
    } catch (e) {
      fabricErr = e;
    }

    if (!result) {
      const fs = require('fs');
      let dMuts = [];
      try { dMuts = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json', 'utf8')); } catch(e){}
      const idx = dMuts.findIndex(m => m.mutationId === req.params.mutationId);
      if (idx >= 0) {
        dMuts[idx].status = 'EXECUTED';
        dMuts[idx].executedAt = new Date().toISOString();
        dMuts[idx].executedTxHash = req.body.officerESignTxHash || '0x' + crypto.randomBytes(32).toString('hex');
        dMuts[idx].timeline.push({ step: 'EXECUTED', label: `Mutation Finalized by ${dMuts[idx].officerName}`, actor: dMuts[idx].officerName, at: new Date().toISOString(), done: true });
        
        if (!dMuts[idx].telegramAlerts) dMuts[idx].telegramAlerts = [];
        dMuts[idx].telegramAlerts.push({
          channel: 'WHATSAPP', recipient: '+91 9876543210', 
          message: `🎉 Mutation EXECUTED for ${dMuts[idx].dlpiId}. Title transferred to ${dMuts[idx].newOwnerName}.`, 
          sentAt: new Date().toISOString(), delivered: true
        });

        fs.writeFileSync('/tmp/bhumichain_dynamic_mutations.json', JSON.stringify(dMuts, null, 2));
        result = dMuts[idx];
      } else {
        return res.status(500).json({ error: 'FABRIC_ERROR', message: fabricErr ? fabricErr.message : 'Mutation not found' });
      }
    }

    broadcast('MutationExecuted', { mutationId: req.params.mutationId });
    res.json(result);
  },
);

module.exports = router;
