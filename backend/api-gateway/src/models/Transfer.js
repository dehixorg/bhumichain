const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema({
  transferId: { type: String, required: true, unique: true },
  dlpiId: { type: String, required: true },
  sellerAadhaar: String,
  buyerAadhaar: String,
  buyerName: String,
  declaredValueINR: Number,
  status: String,
  createdAt: String,
  ipfsTitleDeedCID: String,
  newTitleCID: String
}, { strict: false });

module.exports = mongoose.model('bh_Transfer', transferSchema, 'bh_transfers');
