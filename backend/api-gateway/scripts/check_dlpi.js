require('dotenv').config({ path: '../.env' });
const { evaluate } = require('../src/services/fabric');

async function check() {
  try {
    const parcel = await evaluate('dlpi', 'GetDLPI', ['DLPI-UP-DAD-00100']);
    console.log(JSON.stringify(parcel, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
check();
