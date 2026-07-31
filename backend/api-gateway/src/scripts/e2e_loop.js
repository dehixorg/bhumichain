const axios = require('axios');
const API = 'http://localhost:4001/api';

require('dotenv').config();
function getMockToken(user) {
  const { mintToken } = require('../middleware/auth');
  return mintToken(user);
}

const c1Auth = {
  headers: { Authorization: `Bearer ${getMockToken({ role: 'citizen', aadhaarNumber: 'hash-citizen-a', name: 'Citizen A' })}` }
};
const c2Auth = {
  headers: { Authorization: `Bearer ${getMockToken({ role: 'citizen', aadhaarNumber: 'hash-citizen-b', name: 'Citizen B' })}` }
};
const sroAuth = {
  headers: { Authorization: `Bearer ${getMockToken({ role: 'sro', aadhaarNumber: 'mock-sro-hash', name: 'Sub Registrar' })}` }
};

async function runE2E() {
  console.log("🚀 Starting E2E Tests (2 Loops) against MongoDB Backend...\n");

  for (let loop = 1; loop <= 2; loop++) {
    console.log(`\n================== LOOP ${loop} ==================`);
    
    // 1. Check DLPIs
    console.log("[1] Getting DLPIs for Citizen A...");
    let res = await axios.get(`http://localhost:4001/api/dlpi/my-parcels`, c1Auth);
    let dlpiId = res.data.length > 0 ? res.data[0].dlpiId : null;
    
    if (!dlpiId) {
      console.log("No DLPI found, seeding a mock DLPI for Citizen A...");
      const connectDB = require('../config/db');
      const DLPI = require('../models/DLPI');
      await connectDB();
      dlpiId = 'DLPI-TEST-' + Date.now();
      await DLPI.create({
        id: dlpiId,
        dlpiId: dlpiId,
        areaHectares: 2.5,
        landType: 'Raiyati',
        owners: [{ name: 'Citizen A', aadhaarNumber: 'hash-citizen-a' }]
      });
      console.log(`Created mock DLPI: ${dlpiId}`);
    } else {
      console.log(`Found DLPI: ${dlpiId}`);
    }

    // 2. List on Auction
    console.log("\n[2] Citizen A listing DLPI on Voluntary Open Market...");
    res = await axios.post(`http://localhost:4001/api/auction/list`, {
      dlpiId: dlpiId,
      reservePrice: 500000,
      durationDays: 7
    }, c1Auth);
    const auctionId = res.data.auction.auctionId;
    console.log(`✅ Auction Created: ${auctionId}`);

    // 3. Bid on Auction
    console.log("\n[3] Citizen B places a bid...");
    res = await axios.post(`http://localhost:4001/api/auction/${auctionId}/bid`, {
      bidAmountINR: 600000,
      bidderAadhaarNumber: 'hash-citizen-b',
      bidderName: 'Citizen B'
    }, c2Auth);
    console.log(`✅ Bid Placed: ${res.data.bidSealHash}`);

    // 4. Close Auction (Trigger Transfer)
    console.log("\n[4] Citizen A closes the auction early...");
    res = await axios.post(`http://localhost:4001/api/auction/${auctionId}/close`, {}, c1Auth);
    const transferId = res.data.transferId;
    console.log(`✅ Auction Closed! Transfer Initiated: ${transferId}`);

    // 5. SRO Approves Transfer (Zero-Click Mutation)
    console.log("\n[5] SRO Approves the Transfer (Triggers Zero-Click Mutation)...");
    res = await axios.post(`http://localhost:4001/api/transfer/${transferId}/approve/sro`, {}, sroAuth);
    console.log(`✅ Transfer Approved by SRO!`);

    // 6. Verify Mutation Created
    console.log("\n[6] Verifying Mutation was auto-created...");
    const connectDB = require('../config/db');
    const Mutation = require('../models/Mutation');
    try { await connectDB(); } catch(e) {}
    
    // Wait a second to ensure async axios call inside transfer.js hits mutation.js
    await new Promise(r => setTimeout(r, 2000));
    const mutation = await Mutation.findOne({ dlpiId: dlpiId, status: 'Pending at Patwari' }).sort({ createdAt: -1 });
    
    if (mutation) {
      console.log(`✅ ZERO-CLICK MUTATION VERIFIED! Case ID: ${mutation.caseId}`);
      console.log(`   New Owner: ${mutation.newOwnerName}`);
    } else {
      console.error(`❌ Zero-Click Mutation failed. No pending mutation found for DLPI ${dlpiId}`);
      process.exit(1);
    }
    console.log(`================== LOOP ${loop} COMPLETED SUCCESSFULLY ==================\n`);
  }

  console.log("🎉 ALL E2E TESTS PASSED!");
  process.exit(0);
}

process.env.AADHAAR_MOCK = 'true';
process.env.MONGODB_URI = 'mongodb+srv://consultforai_db_user:P2WK5dKcuRdw6xpR@cluster0.dxzu7zr.mongodb.net/?appName=Cluster0';

runE2E().catch(err => {
  console.error("Test failed:", err.response ? err.response.data : err.message);
  process.exit(1);
});
