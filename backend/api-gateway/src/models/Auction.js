const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  auctionId: { type: String, required: true, unique: true },
  dlpiId: String,
  sellerAadhaar: String,
  sellerName: String,
  status: String, // ACTIVE, COMPLETED, CANCELLED
  reservePriceINR: Number,
  currentHighestBidINR: Number,
  highestBidderAadhaar: String,
  highestBidderName: String,
  createdAt: String,
  bids: Array // array of bid objects { bidderName, bidderAadhaar, amountINR, timestamp }
}, { strict: false });

module.exports = mongoose.model('bh_Auction', auctionSchema, 'bh_auctions');
