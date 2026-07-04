require('dotenv').config({ path: 'backend/api-gateway/.env' });
const { submit } = require('./backend/api-gateway/src/services/fabric');

async function run() {
  console.log("Seeding DLPI-UP-DAD-00100...");
  
  const payload = [{
    dlpiId: 'DLPI-UP-DAD-00100',
    surveyNumber: '100',
    khasraNo: '100',
    tehsil: 'Dadri',
    tehsilCode: 'DAD',
    district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    landType: 'Agricultural',
    landTypeDescription: 'Irrigated double-crop',
    areaHectares: 2.5,
    isTribal: false,
    scheduleVArea: false,
    initialOwners: [
      {
        aadhaarHash: 'sha256:heir1ankur3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8',
        name: 'Ankur Singh (Legal Heir, 1/3 share)',
        share: '1/1',
        shareDecimal: 1.0,
        acquiredAt: new Date().toISOString()
      }
    ],
    recordedBy: 'sha256:amit_saxena_hash'
  }];
  
  try {
    const res = await submit('dlpi', 'BulkSeedDLPIs', [JSON.stringify(payload)]);
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e.message);
    if (e.details) console.error("Details:", e.details);
  }
  process.exit(0);
}
run();
