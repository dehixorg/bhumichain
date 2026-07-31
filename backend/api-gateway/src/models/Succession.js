const mongoose = require('mongoose');

const successionSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  dlpiId: String,
  applicantAadhaar: String,
  applicantName: String,
  deceasedAadhaar: String,
  deceasedName: String,
  dateOfDeath: String,
  status: String,
  legalHeirs: Array,
  disputes: Array,
  history: Array,
  deathCertificateCID: String,
  createdAt: String
}, { strict: false });

module.exports = mongoose.model('bh_Succession', successionSchema, 'bh_successions');
