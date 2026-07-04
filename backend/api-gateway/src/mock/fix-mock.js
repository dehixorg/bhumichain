require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { submit, evaluate } = require('../services/fabric');

async function forceSeed() {
  console.log("Forcing DLPI reset for demo...");
  
  try {
    let transfers = await evaluate('property-transfer', 'QueryPendingTransfers', []);
    if (typeof transfers === 'string') transfers = JSON.parse(transfers);
    
    const t = transfers.find(tx => tx.dlpiId === 'DLPI-UP-DAD-00100' && tx.status === 'CI_APPROVED');
    if (!t) {
      console.log("Could not find the pending transfer to sync with.");
      process.exit(0);
      return;
    }
    
    const sellerHash = t.sellers[0].aadhaarHash;
    console.log("Found seller hash from transfer:", sellerHash);

    const seedPayload = {
      dlpiId: 'DLPI-UP-DAD-00100',
      surveyNumber: '100', khasraNo: '100',
      tehsil: 'Dadri', tehsilCode: 'DAD',
      district: 'Gautam Buddha Nagar', state: 'Uttar Pradesh',
      landType: 'Residential', landTypeDescription: 'Irrigated double-crop',
      areaHectares: 2.5, isTribal: false, scheduleVArea: false,
      initialOwners: [{
        aadhaarHash: sellerHash, name: 'Seller',
        share: '1/1', shareDecimal: 1.0, ownerSince: new Date().toISOString(),
        isVerified: true
      }],
      ownershipType: 'SOLE',
      latitude: 28.5355, longitude: 77.3910,
      circleRateINR: 5000000, ipfsCID: 'QmYwAPJzv5CZ1zoZ5G4vV3H927918v5H927918v5H92791',
      sourceType: 'MANUAL'
    };
    
    await submit('dlpi', 'CreateDLPI', [JSON.stringify(seedPayload)]);
    
    // Also clear the lock just in case
    await submit('dlpi', 'ReleaseTransferLock', ['DLPI-UP-DAD-00100']);
    
    console.log("DLPI successfully forcefully re-seeded to match the transfer!");
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

forceSeed();