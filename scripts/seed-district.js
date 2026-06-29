#!/usr/bin/env node
/**
 * BhumiChain — District Seed Script
 * Reads noida_parcels.json, resolves demo aadhaar hash placeholders,
 * authenticates as tehsildar, and POSTs to /api/dlpi/bulk-seed in batches.
 *
 * Usage:
 *   node scripts/seed-district.js [--dry-run] [--batch 50]
 *
 * Requires .env in backend/api-gateway/ (or BHUMI_API_URL + AADHAAR_SALT env vars).
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const https   = require('https');
const http    = require('http');

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../backend/api-gateway/.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .forEach(l => {
      const [k, ...v] = l.split('=');
      if (k && !process.env[k]) process.env[k] = v.join('=').trim();
    });
}

const API_URL    = process.env.BHUMI_API_URL || 'http://localhost:4000';
const SALT       = process.env.AADHAAR_SALT  || 'bhumi-demo-salt-2026';
const DRY_RUN    = process.argv.includes('--dry-run');
const BATCH_SIZE = Number(process.argv[process.argv.indexOf('--batch') + 1] || 50);

// ── Helper: SHA-256(aadhaarNumber + salt) ─────────────────────────────────────
function hashAadhaar(aadhaar) {
  return crypto.createHash('sha256').update(aadhaar + SALT).digest('hex');
}

// ── Demo citizen hash map ─────────────────────────────────────────────────────
const PLACEHOLDER_MAP = {
  '__HASH_PRIYA__':   hashAadhaar('999900010010'),
  '__HASH_ARUN__':    hashAadhaar('999900010011'),
  '__HASH_SURESH__':  hashAadhaar('999900010012'),
  '__HASH_MEENA__':   hashAadhaar('999900010013'),
  '__HASH_RAMKALI__': hashAadhaar('999900010020'),
};

function resolvePlaceholders(parcels) {
  return JSON.parse(
    JSON.stringify(parcels).replace(
      /__HASH_[A-Z]+__/g,
      match => PLACEHOLDER_MAP[match] || match,
    ),
  );
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : '';
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = lib.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('BhumiChain District Seed Script');
  console.log(`API:       ${API_URL}`);
  console.log(`Batch:     ${BATCH_SIZE}`);
  console.log(`Dry-run:   ${DRY_RUN}`);
  console.log();

  // 1. Load parcels
  const dataPath = path.resolve(__dirname, '../data/synthetic-parcels/noida_parcels.json');
  if (!fs.existsSync(dataPath)) {
    console.error('ERROR: noida_parcels.json not found. Run:');
    console.error('  cd data/synthetic-parcels && python3 generate_parcels.py');
    process.exit(1);
  }
  const raw     = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const parcels = resolvePlaceholders(raw);
  console.log(`Loaded ${parcels.length} parcels from noida_parcels.json`);

  // 2. Get tehsildar demo token
  console.log('Authenticating as tehsildar (demo token)…');
  const authRes = await request('POST', `${API_URL}/api/auth/demo-token`, { persona: 'tehsildar' });
  if (authRes.status !== 200 || !authRes.body.token) {
    console.error('Auth failed:', authRes.body);
    process.exit(1);
  }
  const token = authRes.body.token;
  console.log(`Token acquired (${authRes.body.user?.name})`);
  console.log();

  if (DRY_RUN) {
    console.log('[DRY RUN] Would seed:');
    console.log(`  ${parcels.length} parcels in ${Math.ceil(parcels.length / BATCH_SIZE)} batches of ${BATCH_SIZE}`);
    console.log('  Sample (first 3):');
    parcels.slice(0, 3).forEach(p =>
      console.log(`    ${p.dlpiId}  ${p.landType}  ${p.areaHectares}ha  ${p.owner.name}`),
    );
    return;
  }

  // 3. Seed in batches
  let seededTotal = 0;
  let errors      = 0;
  const batches   = Math.ceil(parcels.length / BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batch  = parcels.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const label  = `Batch ${i + 1}/${batches} (${batch.length} parcels)`;
    process.stdout.write(`  ${label}… `);

    const res = await request('POST', `${API_URL}/api/dlpi/bulk-seed`, { parcels: batch }, token);
    if (res.status === 201) {
      seededTotal += res.body.seeded || batch.length;
      console.log(`✓ seeded ${res.body.seeded || batch.length}`);
    } else {
      errors++;
      console.log(`✗ ERROR ${res.status}:`, JSON.stringify(res.body).slice(0, 120));
    }

    // Brief pause between batches to avoid overwhelming the gateway
    if (i < batches - 1) await new Promise(r => setTimeout(r, 200));
  }

  console.log();
  console.log(`── Seed complete ──────────────────────────`);
  console.log(`  Seeded:  ${seededTotal} / ${parcels.length} parcels`);
  console.log(`  Errors:  ${errors} batches`);
  console.log(`  Status:  SEEDED_UNVERIFIED (awaiting citizen claims)`);
  if (errors === 0) {
    console.log();
    console.log('Next steps:');
    console.log('  1. Open http://localhost:3000 and login as a demo citizen');
    console.log('  2. Go to "My Parcels" to see assigned parcels');
    console.log('  3. Click "Claim" on an unverified parcel to start the flow');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
