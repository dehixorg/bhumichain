require('dotenv').config({ path: __dirname + '/../../.env' });
const mongoose = require('mongoose');

const User = require('../models/User');
const DLPI = require('../models/DLPI');
const Transfer = require('../models/Transfer');
const Mutation = require('../models/Mutation');
const Succession = require('../models/Succession');
const Auction = require('../models/Auction');

const connectDB = require('../config/db');

// Import from mock data
const mockData = require('../mock/responses');
// Since mockData doesn't export the direct arrays, let's just grab the users for Mongo.
// Note: In FABRIC_MODE=mock, DLPIs/Transfers are fetched from responses.js directly in memory,
// so MongoDB only strictly needs the User records for Auth. However, we will seed everything if you want it in Mongo.

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
  try {
    await connectDB();
    console.log('Seeding data to MongoDB...');

    // 1. Seed Users (Critical for Auth)
    await User.deleteMany();
    await User.insertMany(mockUsers);
    console.log(`Seeded ${mockUsers.length} users.`);

    console.log('Seeding complete! (Note: Parcels and mutations run in-memory for the mock Fabric demo).');
    process.exit(0);
  } catch (err) {
    console.error('Error during seeding:', err.message);
    process.exit(1);
  }
}

seed();
