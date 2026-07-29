const { body, validationResult } = require('express-validator');
const express = require('express');
const app = express();
app.use(express.json());

const MUTATION_TYPES = [
  'Sale', 'Gift', 'Inheritance', 'Partition', 'Court_Order',
  'Govt_Acquisition', 'Exchange', 'Will',
];

app.post('/test', [
  body('dlpiId').matches(/^DLPI-[A-Z0-9-]+$/),
  body('mutationType').isIn(MUTATION_TYPES),
  body('officerName').notEmpty().trim(),
  body('officerHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('officerRank').notEmpty(),
  body('newOwnerName').notEmpty().trim(),
  body('newOwnerHash').matches(/^sha256:[a-f0-9]{64}$/),
  body('reason').notEmpty(),
  body('supportingCID').notEmpty(),
], (req, res) => {
  const errs = validationResult(req);
  res.json({ errors: errs.array() });
});

const server = app.listen(0, async () => {
  const fetch = (await import('node-fetch')).default || require('node-fetch');
  
  // Create exact payload from frontend
  const cleanAadhaar = '999988887777';
  let newOwnerHash = `sha256:${cleanAadhaar}a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e`;
  newOwnerHash = newOwnerHash.slice(0, 71);
  
  const officerHashRaw = "sha256:49c04a60155b11292cd71cd8c1606db9ca343467bf285f5e5572b21cf5bc7320";
  const officerHash = (officerHashRaw.startsWith('sha256:') ? officerHashRaw : `sha256:${officerHashRaw}`).toLowerCase();
  
  const payload = {
    dlpiId: 'DLPI-UP-GBN-2026-0045'.trim(),
    mutationType: 'Sale',
    officerName: 'Amit Saxena',
    officerHash: officerHash,
    officerRank: 'tehsildar',
    newOwnerName: 'Amit Saxena',
    newOwnerHash: newOwnerHash,
    reason: 'Registered Sale Deed No. 4412/2026 executed at Sub-Registrar Gautam Buddha Nagar.',
    supportingCID: 'QmSaleDeedGBN2026Hash99182x',
    courtOrderNo: ''
  };

  const res = await fetch(`http://localhost:${server.address().port}/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
});
