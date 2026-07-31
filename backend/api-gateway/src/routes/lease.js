const express = require('express');
const router = express.Router();
const { submitTransaction, evaluate } = require('../services/fabric');
const { authenticate } = require('../middleware/auth');
const Lease = require('../models/Lease');
const DLPI = require('../models/DLPI');

router.post('/initiate', authenticate, async (req, res) => {
  try {
    const { dlpiId, tenantAadhaar, rentAmount, durationMonths, ownerSignature } = req.body;
    
    // Check if the user is the owner
    const parcel = await evaluate('dlpi', 'QueryDLPI', [dlpiId]);
    if (!parcel) return res.status(404).json({ message: "Parcel not found" });

    const ownerAadhaar = parcel.owners?.[0]?.aadhaarNumber?.replace(/\D/g, '') || parcel.owners?.[0]?.aadhaar?.replace(/\D/g, '');
    const userAadhaar = (req.user.aadhaarNumber || req.user.aadhaar || '').replace(/\D/g, '');
    
    if (ownerAadhaar !== userAadhaar) {
      return res.status(403).json({ message: "Only the verified owner can initiate a lease." });
    }

    if (parcel.activeLease && parcel.activeLease.leaseId) {
      return res.status(400).json({ message: "Property already has an active lease." });
    }

    const pendingCoOwners = [];
    let initialStatus = 'INITIATED';

    if (parcel.owners && parcel.owners.length > 1) {
      initialStatus = 'PENDING_CO_OWNER_CONSENT';
      parcel.owners.forEach(o => {
        const oAadhaar = (o.aadhaarNumber || o.aadhaar || '').replace(/\D/g, '');
        if (oAadhaar !== userAadhaar) {
          pendingCoOwners.push(oAadhaar);
        }
      });
      if (pendingCoOwners.length === 0) {
        initialStatus = 'INITIATED';
      }
    }

    const leaseId = 'LEASE-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // We mock the Fabric call for now
    const result = { txId: 'mock-tx-id', status: 'SUCCESS' };

    // Save to MongoDB
    const lease = new Lease({
      leaseId,
      dlpiId,
      ownerAadhaar,
      tenantAadhaar,
      rentAmount,
      durationMonths,
      status: initialStatus,
      pendingCoOwners,
      coOwnerSignatures: {},
      signatures: { owner: ownerSignature },
      history: [{ action: 'LEASE_INITIATED', timestamp: new Date(), actor: req.user.name }]
    });
    await lease.save();

    res.json({ message: "Lease initiated successfully", leaseId, result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error initiating lease", error: error.message });
  }
});

router.post('/:leaseId/consent', authenticate, async (req, res) => {
  try {
    const { tenantSignature } = req.body;
    const leaseId = req.params.leaseId;
    const userAadhaar = (req.user.aadhaarNumber || req.user.aadhaar || '').replace(/\D/g, '');
    const userName = req.user.name;

    const lease = await Lease.findOne({ leaseId });
    if (!lease) return res.status(404).json({ message: "Lease not found" });
    if (lease.tenantAadhaar !== userAadhaar) return res.status(403).json({ message: "Unauthorized tenant" });

    const result = await submitTransaction('lease', 'SignLease', [
      leaseId, userAadhaar, tenantSignature, userName, lease.durationMonths
    ]);

    lease.status = 'ACTIVE';
    lease.tenantName = userName;
    lease.signatures.tenant = tenantSignature;
    lease.startDate = new Date();
    lease.endDate = new Date(Date.now() + (lease.durationMonths * 30 * 24 * 60 * 60 * 1000));
    lease.history.push({ action: 'LEASE_SIGNED', timestamp: new Date(), actor: userName });
    await lease.save();

    // Update DLPI with activeLease
    await DLPI.findOneAndUpdate(
      { id: lease.dlpiId },
      { $set: { activeLease: { leaseId: lease.leaseId, tenantName: userName, tenantAadhaar: userAadhaar, endDate: lease.endDate } } }
    );

    res.json({ message: "Lease signed and activated successfully", result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error signing lease", error: error.message });
  }
});

router.get('/pending', authenticate, async (req, res) => {
  try {
    const userAadhaar = (req.user.aadhaarNumber || req.user.aadhaar || '').replace(/\D/g, '');
    const pendingTenantLeases = await Lease.find({ tenantAadhaar: userAadhaar, status: 'INITIATED' }).sort({ createdAt: -1 });
    const pendingCoOwnerLeases = await Lease.find({ pendingCoOwners: userAadhaar, status: 'PENDING_CO_OWNER_CONSENT' }).sort({ createdAt: -1 });
    
    res.json([...pendingTenantLeases, ...pendingCoOwnerLeases]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching pending leases", error: error.message });
  }
});

router.post('/:leaseId/co-owner-consent', authenticate, async (req, res) => {
  try {
    const userAadhaar = (req.user.aadhaarNumber || req.user.aadhaar || '').replace(/\D/g, '');
    const lease = await Lease.findOne({ leaseId: req.params.leaseId });
    if (!lease) return res.status(404).json({ message: "Lease not found" });

    if (lease.status !== 'PENDING_CO_OWNER_CONSENT') {
      return res.status(400).json({ message: "Not pending co-owner consent" });
    }

    if (!lease.pendingCoOwners.includes(userAadhaar)) {
      return res.status(403).json({ message: "Unauthorized co-owner" });
    }

    lease.pendingCoOwners = lease.pendingCoOwners.filter(a => a !== userAadhaar);
    lease.coOwnerSignatures = lease.coOwnerSignatures || new Map();
    lease.coOwnerSignatures.set(userAadhaar, `signed_${Date.now()}`);

    if (lease.pendingCoOwners.length === 0) {
      lease.status = 'INITIATED'; // Forward to tenant
    }

    await lease.save();
    res.json({ message: "Co-owner consent recorded", status: lease.status });
  } catch (error) {
    res.status(500).json({ message: "Error recording co-owner consent", error: error.message });
  }
});

module.exports = router;
