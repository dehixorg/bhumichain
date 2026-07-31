const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema({
  leaseId: { type: String, required: true, unique: true },
  dlpiId: { type: String, required: true },
  ownerAadhaar: { type: String, required: true },
  tenantAadhaar: { type: String, required: true },
  tenantName: { type: String }, // Populated when tenant signs
  rentAmount: { type: Number, required: true },
  durationMonths: { type: Number, required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  status: { 
    type: String, 
    enum: ['INITIATED', 'ACTIVE', 'EXPIRED', 'TERMINATED'], 
    default: 'INITIATED' 
  },
  signatures: {
    owner: { type: String }, // Owner eSign hash
    tenant: { type: String } // Tenant eSign hash
  },
  history: [{
    action: String,
    timestamp: Date,
    actor: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Lease', leaseSchema, 'bh_leases');
