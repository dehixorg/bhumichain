require('dotenv').config();
const { evaluate } = require('./src/services/fabric');
evaluate('dlpi', 'GetDLPI', ['DLPI-UP-DAD-00100']).then(console.log).catch(console.error);
