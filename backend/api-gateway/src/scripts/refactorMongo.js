const fs = require('fs');
const path = require('path');

const targetFiles = [
  'dlpi.js',
  'transfer.js',
  'mutation.js',
  'uttaradhikar.js'
];

for (const file of targetFiles) {
  const filePath = path.join(__dirname, '..', 'routes', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Inject mongoStore
  if (!content.includes("const mongoStore = require('../services/mongoStore');")) {
    content = content.replace("const { Router } = require('express');", "const { Router } = require('express');\nconst mongoStore = require('../services/mongoStore');");
  }

  // Use a generic replacer for all JSON.parse(fs.readFileSync(XXX))
  content = content.replace(/JSON\.parse\(\s*fs\.readFileSync\([^)]+bhumichain_seeded_parcels\.json[^)]*\)\s*\)/g, "await mongoStore.getDLPIs()");
  content = content.replace(/JSON\.parse\(\s*fs\.readFileSync\([^)]+bhumichain_mock_transfers\.json[^)]*\)\s*\)/g, "await mongoStore.getTransfers()");
  content = content.replace(/JSON\.parse\(\s*fs\.readFileSync\([^)]+bhumichain_dynamic_mutations\.json[^)]*\)\s*\)/g, "await mongoStore.getMutations()");
  content = content.replace(/JSON\.parse\(\s*fs\.readFileSync\([^)]+bhumichain_succession_cases\.json[^)]*\)\s*\)/g, "await mongoStore.getSuccessions()");
  content = content.replace(/JSON\.parse\(\s*fs\.readFileSync\([^)]+bhumichain_atomic_claims\.json[^)]*\)\s*\)/g, "await mongoStore.getAtomicClaims()");
  
  // also missed ones like diskPath
  content = content.replace(/JSON\.parse\(\s*fs\.readFileSync\(diskPath[^)]*\)\s*\)/g, "await mongoStore.getSuccessions()");

  // And writeFileSync
  content = content.replace(/fs\.writeFileSync\(\s*['"]\/tmp\/bhumichain_seeded_parcels\.json['"][^)]*\);/g, "/* write handled by Mongo */");
  content = content.replace(/fs\.writeFileSync\(\s*['"]\/tmp\/bhumichain_mock_transfers\.json['"][^)]*\);/g, "/* write handled by Mongo */");
  content = content.replace(/fs\.writeFileSync\(\s*['"]\/tmp\/bhumichain_dynamic_mutations\.json['"][^)]*\);/g, "/* write handled by Mongo */");
  content = content.replace(/fs\.writeFileSync\(\s*['"]\/tmp\/bhumichain_succession_cases\.json['"][^)]*\);/g, "/* write handled by Mongo */");
  content = content.replace(/fs\.writeFileSync\(\s*diskPath[^)]*\);/g, "/* write handled by Mongo */");
  content = content.replace(/fs\.writeFileSync\(\s*['"]\/tmp\/bhumichain_atomic_claims\.json['"][^)]*\);/g, "/* write handled by Mongo */");
  content = content.replace(/fs\.readFileSync\([^)]+bhumichain_seeded_parcels\.json[^)]*\)/g, "await mongoStore.getDLPIs()");
  content = content.replace(/fs\.readFileSync\([^)]+bhumichain_atomic_claims\.json[^)]*\)/g, "await mongoStore.getAtomicClaims()");

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log("Refactoring complete");
