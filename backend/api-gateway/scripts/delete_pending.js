require('dotenv').config({ path: '../.env' });
const { submit, evaluate } = require('../src/services/fabric');

async function cleanup() {
  console.log('Fetching all pending transfers...');
  try {
    let transfers = await evaluate('property-transfer', 'QueryPendingTransfers', []);
    if (typeof transfers === 'string') {
      try { transfers = JSON.parse(transfers); } catch (e) {}
    }
    const transferList = Array.isArray(transfers) ? transfers : [];

    console.log(`Found ${transferList.length} pending transfers. Rejecting them...`);

    for (const t of transferList) {
      if (t.dlpiId === 'DLPI-UP-DAD-00100') {
        try {
          console.log(`Rejecting ${t.transferId}...`);
          await submit('property-transfer', 'RejectTransfer', [t.transferId, 'Manual cleanup of stale transfers', 'SYSTEM']);
          console.log(`Successfully rejected ${t.transferId}`);
        } catch (e) {
          console.error(`Failed to reject ${t.transferId}:`, e.message);
        }
      }
    }
    
    console.log('Cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error fetching transfers:', err.message);
    process.exit(1);
  }
}

cleanup();
