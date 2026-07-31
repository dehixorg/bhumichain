require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { submit, evaluate } = require('../services/fabric');

async function forceSeed() {
  console.log("Forcing DLPI reset for demo...");
  
  try {
    // 1. Get the transfer proposal
    let transfers = await evaluate('property-transfer', 'QueryPendingTransfers', []);
    if (typeof transfers === 'string') transfers = JSON.parse(transfers);
    
    const t = transfers.find(tx => tx.dlpiId === 'DLPI-UP-DAD-00100' && tx.status === 'CI_APPROVED');
    if (!t) {
      console.log("Could not find the pending transfer to sync with.");
      process.exit(0);
      return;
    }
    
    const targetSellerHash = t.sellers[0].aadhaarNumber;
    console.log("Found seller hash from transfer:", targetSellerHash);

    // 2. Fetch the current owners using OwnerOf (bypasses GetDLPI schema bug)
    let ownersBytes = await evaluate('dlpi', 'OwnerOf', ['DLPI-UP-DAD-00100']);
    const currentHashes = JSON.parse(ownersBytes.toString());
    console.log("Current DLPI owners on blockchain:", currentHashes);

    if (currentHashes.includes(targetSellerHash) && currentHashes.length === 1) {
       console.log("DLPI is already perfectly synced!");
       // just clear the lock
       await submit('dlpi', 'ReleaseTransferLock', ['DLPI-UP-DAD-00100']);
       process.exit(0);
       return;
    }

    // 3. Force swap the owner using UpdateOwners
    const sellerHashesJSON = JSON.stringify(currentHashes);
    
    // The new buyer is our target seller!
    const newOwner = [{
      aadhaarNumber: targetSellerHash, 
      name: 'Seller',
      share: '1/1', 
      shareDecimal: 1.0, 
      ownerSince: new Date().toISOString(),
      isVerified: true
    }];
    const newBuyersJSON = JSON.stringify(newOwner);

    console.log("Swapping stale owners for the correct transfer seller...");
    
    await submit('dlpi', 'UpdateOwners', [
      'DLPI-UP-DAD-00100',
      sellerHashesJSON,
      newBuyersJSON,
      'Sale',
      'System_Reset',
      'system',
      'SYS-RESET',
      '',
      'Fix stale mock data'
    ]);
    
    await submit('dlpi', 'ReleaseTransferLock', ['DLPI-UP-DAD-00100']);
    
    console.log("DLPI successfully forcefully re-seeded to match the transfer!");
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

forceSeed();