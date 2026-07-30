'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Hardcoded database of 20 Bihar properties (around Phulwari Sharif, Patna)
const BIHAR_PARCELS = [
  // 5 Properties for Priya Kumar (Aadhaar 999900010010)
  {
    dlpiId: 'DLPI-Bihar-PHU-00101',
    khataNo: '401',
    khasraNo: '101',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Residential',
    areaHectares: 0.15,
    ownerName: 'Priya Kumar',
    ownerAadhaar: '999900010010',
    latitude: 25.5510,
    longitude: 85.0810
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00102',
    khataNo: '401',
    khasraNo: '102',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.22,
    ownerName: 'Priya Kumar',
    ownerAadhaar: '999900010010',
    latitude: 25.5525,
    longitude: 85.0830
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00103',
    khataNo: '402',
    khasraNo: '103',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Residential',
    areaHectares: 0.08,
    ownerName: 'Priya Kumar',
    ownerAadhaar: '999900010010',
    latitude: 25.5540,
    longitude: 85.0850
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00104',
    khataNo: '403',
    khasraNo: '104',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.34,
    ownerName: 'Priya Kumar',
    ownerAadhaar: '999900010010',
    latitude: 25.5560,
    longitude: 85.0870
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00105',
    khataNo: '404',
    khasraNo: '105',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Commercial',
    areaHectares: 0.11,
    ownerName: 'Priya Kumar',
    ownerAadhaar: '999900010010',
    latitude: 25.5580,
    longitude: 85.0890
  },

  // 3 Properties for Rakesh Agarwal (Aadhaar 999900010011)
  {
    dlpiId: 'DLPI-Bihar-PHU-00106',
    khataNo: '501',
    khasraNo: '106',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.45,
    ownerName: 'Rakesh Agarwal',
    ownerAadhaar: '999900010011',
    latitude: 25.5600,
    longitude: 85.0910
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00107',
    khataNo: '501',
    khasraNo: '107',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Residential',
    areaHectares: 0.19,
    ownerName: 'Rakesh Agarwal',
    ownerAadhaar: '999900010011',
    latitude: 25.5615,
    longitude: 85.0930
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00108',
    khataNo: '502',
    khasraNo: '108',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.27,
    ownerName: 'Rakesh Agarwal',
    ownerAadhaar: '999900010011',
    latitude: 25.5630,
    longitude: 85.0950
  },

  // 3 Properties for Suresh Yadav (Aadhaar 999900010012)
  {
    dlpiId: 'DLPI-Bihar-PHU-00109',
    khataNo: '601',
    khasraNo: '109',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.85,
    ownerName: 'Suresh Yadav',
    ownerAadhaar: '999900010012',
    latitude: 25.5645,
    longitude: 85.0970
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00110',
    khataNo: '602',
    khasraNo: '110',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Residential',
    areaHectares: 0.52,
    ownerName: 'Suresh Yadav',
    ownerAadhaar: '999900010012',
    latitude: 25.5660,
    longitude: 85.0990
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00111',
    khataNo: '602',
    khasraNo: '111',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.33,
    ownerName: 'Suresh Yadav',
    ownerAadhaar: '999900010012',
    latitude: 25.5480,
    longitude: 85.0780
  },

  // 2 Properties for Meena Devi (Aadhaar 999900010013)
  {
    dlpiId: 'DLPI-Bihar-PHU-00112',
    khataNo: '701',
    khasraNo: '112',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Residential',
    areaHectares: 0.16,
    ownerName: 'Meena Devi',
    ownerAadhaar: '999900010013',
    latitude: 25.5460,
    longitude: 85.0760
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00113',
    khataNo: '701',
    khasraNo: '113',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.64,
    ownerName: 'Meena Devi',
    ownerAadhaar: '999900010013',
    latitude: 25.5440,
    longitude: 85.0740
  },

  // 2 Properties for Arun Kumar (Aadhaar 999900010014)
  {
    dlpiId: 'DLPI-Bihar-PHU-00114',
    khataNo: '801',
    khasraNo: '114',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.41,
    ownerName: 'Arun Kumar',
    ownerAadhaar: '999900010014',
    latitude: 25.5420,
    longitude: 85.0720
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00115',
    khataNo: '802',
    khasraNo: '115',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Residential',
    areaHectares: 0.28,
    ownerName: 'Arun Kumar',
    ownerAadhaar: '999900010014',
    latitude: 25.5400,
    longitude: 85.0700
  },

  // 2 Government Properties
  {
    dlpiId: 'DLPI-Bihar-PHU-00116',
    khataNo: '1001',
    khasraNo: '116',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Government Land',
    areaHectares: 1.20,
    ownerName: 'Government of Bihar',
    ownerAadhaar: 'govt-land',
    latitude: 25.5380,
    longitude: 85.0680
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00117',
    khataNo: '1001',
    khasraNo: '117',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Government Land',
    areaHectares: 2.45,
    ownerName: 'Government of Bihar',
    ownerAadhaar: 'govt-land',
    latitude: 25.5360,
    longitude: 85.0660
  },

  // 3 Properties for dummy/unknown Aadhaar numbers
  {
    dlpiId: 'DLPI-Bihar-PHU-00118',
    khataNo: '1002',
    khasraNo: '118',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.95,
    ownerName: 'Deepak Narayan Singh',
    ownerAadhaar: '999900019999',
    latitude: 25.5340,
    longitude: 85.0640
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00119',
    khataNo: '1003',
    khasraNo: '119',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Residential',
    areaHectares: 0.77,
    ownerName: 'Amit Kumar',
    ownerAadhaar: '999900019999',
    latitude: 25.5320,
    longitude: 85.0620
  },
  {
    dlpiId: 'DLPI-Bihar-PHU-00120',
    khataNo: '1004',
    khasraNo: '120',
    tehsil: 'Phulwari Sharif',
    district: 'Patna',
    state: 'Bihar',
    landType: 'Agricultural',
    areaHectares: 0.48,
    ownerName: 'Vikram Singh',
    ownerAadhaar: '999900019999',
    latitude: 25.5300,
    longitude: 85.0600
  }
];

// GET /api/bhu-naksha/parcels — query map parcels
router.get('/parcels', authenticate, async (req, res) => {
  try {
    const requestedAadhaar = req.query.aadhaar || '';
    
    // If no explicit Aadhaar is query-searched, default to user's own if they are a citizen
    let searchAadhaar = requestedAadhaar.replace(/\D/g, '');
    if (!searchAadhaar && req.user.role === 'citizen') {
      const citizenRaw = req.user.aadhaarNumber || req.user.aadhaar || req.user.aadhaarNo || '';
      searchAadhaar = citizenRaw.replace(/\D/g, '');
    }

    if (!searchAadhaar) {
      // Circle Officer with no search query sees all 20 parcels on the map initially
      return res.json(BIHAR_PARCELS);
    }

    // Return only matching parcels for the target Aadhaar
    const filtered = BIHAR_PARCELS.filter(p => p.ownerAadhaar.replace(/\D/g, '') === searchAadhaar);
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

module.exports = router;
