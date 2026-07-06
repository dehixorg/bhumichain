require('dotenv').config({ path: '../.env' });
const { submit, evaluate } = require('../src/services/fabric');

const DEMO_SELLER_HASH = 'sha256:56a083a15c0f4e3069fac285c6df67471c162a11ada941243c56d579fde7050f';

async function forceReset() {
  const dlpiId = 'DLPI-UP-DAD-00100';
  console.log(`Checking current state of ${dlpiId}...`);
  try {
    let currentDLPI = await evaluate('dlpi', 'GetDLPI', [dlpiId]);
    if (typeof currentDLPI === 'string') {
      try { currentDLPI = JSON.parse(currentDLPI); } catch (e) {}
    }
    
    console.log('Current Owners:', JSON.stringify(currentDLPI.owners, null, 2));

    const currentOwnerHashes = currentDLPI.owners ? currentDLPI.owners.map(o => o.aadhaarHash) : [];
    console.log('Hashes to remove:', currentOwnerHashes);

    const resetBuyerPayload = [{
      aadhaarHash: DEMO_SELLER_HASH,
      name: 'Ankur Singh (Legal Heir, 1/3 share)',
      share: '1/1',
      shareDecimal: 1.0,
      isVerified: true
    }];

    console.log('Submitting UpdateOwners transaction...');
    await submit('dlpi', 'UpdateOwners', [
      dlpiId,
      JSON.stringify(currentOwnerHashes),
      JSON.stringify(resetBuyerPayload),
      'DemoReset', 'System', 'demo-system', 'RESET-001', 'QmReset', 'Reset demo parcel'
    ]);

    console.log('✅ Successfully forced reset of DLPI owner to Demo Seller!');
    
    // Verify
    let newDLPI = await evaluate('dlpi', 'GetDLPI', [dlpiId]);
    if (typeof newDLPI === 'string') {
      try { newDLPI = JSON.parse(newDLPI); } catch (e) {}
    }
    console.log('New Owners:', JSON.stringify(newDLPI.owners, null, 2));

  } catch (e) {
    console.error('❌ Reset failed:', e.message);
    if (e.details) console.error('Details:', JSON.stringify(e.details, null, 2));
  }
  process.exit(0);
}

forceReset();
