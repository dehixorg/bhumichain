require('dotenv').config();
const { submit } = require('./src/services/fabric');

async function run() {
  const input = {
    dlpiId: "DLPI-UP-DAD-740201",
    surveyNumber: "740/201",
    khasraNo: "740/201",
    tehsil: "Dadri",
    tehsilCode: "DAD",
    district: "Gautam Buddha Nagar",
    state: "Uttar Pradesh",
    landType: "Jirayat",
    landTypeDescription: "Bhumidhari",
    areaHectares: 2.4,
    isTribal: false,
    scheduleVArea: false,
    initialOwners: [
      {
        name: "Priya Kumar",
        aadhaarHash: "sha256:ea4b4befa6136e0d37e28328bd54425bf7e04cc996e387063cc17fc148bd94e1",
        share: "1/1",
        shareDecimal: 1.0
      }
    ],
    ownershipType: "SOLE",
    latitude: 28.5355,
    longitude: 77.3910,
    boundaryPolygon: null,
    circleRateINR: 5000000,
    ipfsCID: "QmDemoMockHashOnly1234567890",
    sourceType: "RECORD_SCAN_AI"
  };

  try {
    console.log("Submitting to blockchain...");
    const result = await submit('dlpi', 'CreateDLPI', [JSON.stringify(input)]);
    console.log("Success!", result);
  } catch (e) {
    console.error("Failed!", e);
  }
}

run();
