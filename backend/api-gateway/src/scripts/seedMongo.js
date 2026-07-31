require('dotenv').config({ path: __dirname + '/../../.env' });
const mongoose = require('mongoose');
const fs = require('fs');

const User = require('../models/User');
const DLPI = require('../models/DLPI');
const Transfer = require('../models/Transfer');
const Mutation = require('../models/Mutation');
const Succession = require('../models/Succession');
const Auction = require('../models/Auction');

const connectDB = require('../config/db');

// Mock users from auth.js
const mockUsers = [
  { name: 'Admin', role: 'admin', aadhaarNumber: 'mock-admin-hash' },
  { name: 'Patwari (Karmachari)', role: 'karmachari', aadhaarNumber: 'mock-karmachari-hash', department: 'Revenue', title: 'Patwari' },
  { name: 'Circle Inspector (Kanungo)', role: 'kanungo', aadhaarNumber: 'mock-kanungo-hash', department: 'Revenue', title: 'Circle Inspector' },
  { name: 'Circle Officer (Tehsildar)', role: 'circle_officer', aadhaarNumber: 'mock-tehsildar-hash', department: 'Revenue', title: 'Circle Officer' },
  { name: 'Sub Registrar (SRO)', role: 'sro', aadhaarNumber: 'mock-sro-hash', department: 'Registration', title: 'Sub Registrar' },
  { name: 'Citizen A (Ram)', role: 'citizen', aadhaarNumber: 'hash-citizen-a' },
  { name: 'Citizen B (Shyam)', role: 'citizen', aadhaarNumber: 'hash-citizen-b' }
];

async function seed() {
  await connectDB();
  console.log('Seeding data to MongoDB...');

  // 1. Seed Users
  await User.deleteMany();
  await User.insertMany(mockUsers);
  console.log(`Seeded ${mockUsers.length} users.`);

  // 2. Seed DLPIs
  try {
    const dlpis = JSON.parse(fs.readFileSync('/tmp/bhumichain_seeded_parcels.json', 'utf8'));
    await DLPI.deleteMany();
    await DLPI.insertMany(dlpis);
    console.log(`Seeded ${dlpis.length} DLPIs.`);
  } catch(e) { console.log('No DLPI file found or error parsing.'); }

  // 3. Seed Transfers
  try {
    const transfers = JSON.parse(fs.readFileSync('/tmp/bhumichain_mock_transfers.json', 'utf8'));
    await Transfer.deleteMany();
    await Transfer.insertMany(transfers);
    console.log(`Seeded ${transfers.length} Transfers.`);
  } catch(e) { console.log('No Transfers file found or error parsing.'); }

  // 4. Seed Mutations
  try {
    const mutations = JSON.parse(fs.readFileSync('/tmp/bhumichain_dynamic_mutations.json', 'utf8'));
    await Mutation.deleteMany();
    await Mutation.insertMany(mutations);
    console.log(`Seeded ${mutations.length} Mutations.`);
  } catch(e) { console.log('No Mutations file found or error parsing.'); }

  // 5. Seed Successions
  try {
    const successions = JSON.parse(fs.readFileSync('/tmp/bhumichain_succession_cases.json', 'utf8'));
    // Succession json is usually an object map { "caseId": { ... } }
    let succArray = [];
    if (Array.isArray(successions)) {
      succArray = successions;
    } else {
      succArray = Object.values(successions);
    }
    await Succession.deleteMany();
    if (succArray.length > 0) {
      await Succession.insertMany(succArray);
    }
    console.log(`Seeded ${succArray.length} Successions.`);
  } catch(e) { console.log('No Successions file found or error parsing.'); }

  // 6. Seed Auctions
  try {
    const auctions = JSON.parse(fs.readFileSync('/Users/arpitchauhan/Desktop/bhumichain/backend/api-gateway/src/mock/bhumichain_voluntary_auctions.json', 'utf8'));
    await Auction.deleteMany();
    await Auction.insertMany(auctions);
    console.log(`Seeded ${auctions.length} Auctions.`);
  } catch(e) { console.log('No Auctions file found or error parsing.'); }

  console.log('Seeding complete!');
  process.exit(0);
}

seed();
