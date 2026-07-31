'use strict';

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMockResponse } = require('../mock/responses');

// GET /api/bhu-naksha/parcels — query map parcels from unified mock database
router.get('/parcels', authenticate, async (req, res) => {
  try {
    const requestedAadhaar = req.query.aadhaar || '';
    
    // If no explicit Aadhaar is query-searched, default to user's own if they are a citizen
    let searchAadhaar = requestedAadhaar.replace(/\D/g, '');
    if (!searchAadhaar && req.user.role === 'citizen') {
      const citizenRaw = req.user.aadhaarNumber || req.user.aadhaar || req.user.aadhaarNo || '';
      searchAadhaar = citizenRaw.replace(/\D/g, '');
    }

    let sourceParcels = [];
    if (!searchAadhaar) {
      // Circle Officer sees all parcels on the map initially
      sourceParcels = getMockResponse('dlpi', 'GetAllParcels') || [];
    } else {
      // Query specific owner's parcels from the main registry
      sourceParcels = getMockResponse('dlpi', 'QueryDLPIsByOwner', [searchAadhaar, searchAadhaar, '']) || [];
    }

    // Normalize and transform to Leaflet/frontend expected format
    const formatted = sourceParcels.map(p => {
      const lat = p.location?.latitude || p.latitude || 25.5500;
      const lng = p.location?.longitude || p.longitude || 85.0800;
      return {
        dlpiId: p.dlpiId,
        khataNo: p.khataNo || '101',
        khasraNo: p.khasraNo || p.khesraNo || '101',
        tehsil: p.tehsil || 'Phulwari Sharif',
        district: p.district || 'Patna',
        state: p.state || 'Bihar',
        landType: p.landType || 'Residential',
        areaHectares: p.areaHectares || 1.25,
        ownerName: p.ownerName || p.owner?.name || 'Unknown Owner',
        ownerAadhaar: p.ownerAadhaar || p.owner?.aadhaarNumber || '999900010010',
        latitude: lat,
        longitude: lng
      };
    });

    res.json(formatted);
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

module.exports = router;
