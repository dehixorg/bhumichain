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

    const leaseId = 'LEASE-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    const result = await submitTransaction('lease', 'InitiateLease', [
      leaseId, dlpiId, ownerAadhaar, tenantAadhaar, String(rentAmount), String(durationMonths), ownerSignature
    ]);

    // Save to MongoDB
    const lease = new Lease({
      leaseId,
      dlpiId,
      ownerAadhaar,
      tenantAadhaar,
      rentAmount,
      durationMonths,
      status: 'INITIATED',
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
    const pendingLeases = await Lease.find({ tenantAadhaar: userAadhaar, status: 'INITIATED' }).sort({ createdAt: -1 });
    res.json(pendingLeases);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching pending leases", error: error.message });
  }
});

module.exports = router;
