const DLPI = require('../models/DLPI');
const Transfer = require('../models/Transfer');
const Mutation = require('../models/Mutation');
const Succession = require('../models/Succession');
const Auction = require('../models/Auction');

module.exports = {
  getDLPIs: async () => await DLPI.find({}).lean(),
  saveDLPIs: async (dlpis) => {
    await DLPI.deleteMany({});
    if (dlpis && dlpis.length > 0) await DLPI.insertMany(dlpis);
  },
  
  getTransfers: async () => await Transfer.find({}).lean(),
  saveTransfers: async (transfers) => {
    await Transfer.deleteMany({});
    if (transfers && transfers.length > 0) await Transfer.insertMany(transfers);
  },
  
  getMutations: async () => await Mutation.find({}).lean(),
  saveMutations: async (mutations) => {
    try {
      await Mutation.deleteMany({});
      if (mutations && mutations.length > 0) {
        await Mutation.insertMany(mutations);
        console.log(`Saved ${mutations.length} mutations to MongoDB`);
      }
    } catch (e) {
      console.error('MongoStore saveMutations error:', e);
      throw e;
    }
  },
  
  getSuccessions: async () => {
    const successions = await Succession.find({}).lean();
    const map = {};
    successions.forEach(s => map[s.caseId] = s);
    return map;
  },
  saveSuccessions: async (successionMap) => {
    const array = Object.values(successionMap || {});
    await Succession.deleteMany({});
    if (array.length > 0) await Succession.insertMany(array);
  },

  getAtomicClaims: async () => {
     // fallback for atomic claims - we'll just keep it in memory for now to simplify
     if (!global.atomicClaimsCache) global.atomicClaimsCache = {};
     return global.atomicClaimsCache;
  },
  saveAtomicClaims: async (claims) => {
     global.atomicClaimsCache = claims;
  }
};
