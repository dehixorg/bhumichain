const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, required: true },
  aadhaarNumber: { type: String, required: true, unique: true },
  department: String,
  title: String,
  region: String,
});

module.exports = mongoose.model('bh_User', userSchema, 'bh_users');
