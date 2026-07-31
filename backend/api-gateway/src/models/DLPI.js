const mongoose = require('mongoose');

const dlpiSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  state: String,
  district: String,
  subDistrict: String,
  village: String,
  khasraNo: String,
  areaHectares: Number,
  areaBigha: Number,
  landType: String,
  irrigationSource: String,
  owners: Array,
  encumbrances: Array,
  history: Array,
  status: String,
  titleDeedCID: String,
  titleDeedHash: String,
  bhuNakshaCID: String,
  geometry: Object,
  registrationHash: String,
  activeLease: {
    leaseId: String,
    tenantName: String,
    tenantAadhaar: String,
    endDate: Date
  }
}, { strict: false });

module.exports = mongoose.model('bh_DLPI', dlpiSchema, 'bh_dlpis');
