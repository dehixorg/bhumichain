const mongoose = require('mongoose');

const mutationSchema = new mongoose.Schema({
  caseId: { type: String, required: true, unique: true },
  dlpiId: String,
  mutationType: String,
  applicantDetails: Object,
  landDetails: Object,
  previousOwnerDetails: Object,
  newOwnerDetails: Object,
  dynamicFields: Object,
  status: String,
  officerName: String,
  officerRank: String,
  createdAt: String,
  history: Array
}, { strict: false });

module.exports = mongoose.model('bh_Mutation', mutationSchema, 'bh_mutations');
