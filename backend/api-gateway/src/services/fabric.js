'use strict';

const { connect, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const fs = require('fs');
const path = require('path');
const { createPrivateKey } = require('crypto');
const { getMockResponse } = require('../mock/responses');

// ─── Fabric Mode Detection ─────────────────────────────────────────────────────
// Automatically fall back to mock if Fabric env vars are missing or still have
// their placeholder values (e.g. FABRIC_PEER_ENDPOINT=<azure-vm-ip>:7051).
// This prevents ERR_INVALID_ARG_TYPE crashes when running without a live Fabric network.

function _isFabricConfigured() {
  const endpoint = process.env.FABRIC_PEER_ENDPOINT || '';
  const certPath  = process.env.FABRIC_CERT_PATH    || '';
  const keyPath   = process.env.FABRIC_KEY_PATH      || '';
  const tlsCert   = process.env.FABRIC_PEER_TLS_ROOT_CERT || '';

  const missingOrPlaceholder = (v) =>
    !v || v.startsWith('<') || v === 'undefined' || v === '';

  return (
    !missingOrPlaceholder(endpoint) &&
    !missingOrPlaceholder(certPath) &&
    !missingOrPlaceholder(keyPath) &&
    !missingOrPlaceholder(tlsCert)
  );
}

const _fabricConfigured = _isFabricConfigured();

if (process.env.FABRIC_MODE === 'real' && !_fabricConfigured) {
  console.warn(
    '[fabric.js] ⚠️  FABRIC_MODE=real but Fabric connection env vars are missing or placeholders.' +
    ' Falling back to MOCK mode automatically. Set FABRIC_CERT_PATH, FABRIC_KEY_PATH,' +
    ' FABRIC_PEER_TLS_ROOT_CERT and FABRIC_PEER_ENDPOINT to use a real network.'
  );
}

const isMock = () => process.env.FABRIC_MODE === 'mock' || !_fabricConfigured;

// ─── Real Fabric Connection ───────────────────────────────────────────────────

let _gateway = null;
let _client = null;

async function closeGateway() {
  try { if (_gateway) { _gateway.close(); } } catch (e) {}
  try { if (_client) { _client.close(); } } catch (e) {}
  _gateway = null;
  _client = null;
}

async function getGateway() {
  if (_gateway && _client) return _gateway;

  await closeGateway();

  const tlsRootCert = fs.readFileSync(process.env.FABRIC_PEER_TLS_ROOT_CERT);
  const certPem = fs.readFileSync(process.env.FABRIC_CERT_PATH).toString();
  const keyDir = process.env.FABRIC_KEY_PATH;
  const keyFiles = fs.readdirSync(keyDir).filter((f) => f.endsWith('_sk'));
  if (keyFiles.length === 0) throw new Error(`No private key (_sk) found in ${keyDir}`);
  const keyPem = fs.readFileSync(path.join(keyDir, keyFiles[0])).toString();
  const privateKey = createPrivateKey(keyPem);

  _client = new grpc.Client(
    process.env.FABRIC_PEER_ENDPOINT,
    grpc.credentials.createSsl(tlsRootCert),
    {
      'grpc.ssl_target_name_override': 'peer0.revenuedept.bhumichain.in',
      'grpc.keepalive_time_ms': 120000,
      'grpc.keepalive_timeout_ms': 20000,
      'grpc.keepalive_permit_without_calls': 1,
      'grpc.http2.max_pings_without_data': 0,
    }
  );

  _gateway = connect({
    client: _client,
    identity: { mspId: process.env.FABRIC_MSP_ID, credentials: Buffer.from(certPem) },
    signer: signers.newPrivateKeySigner(privateKey),
    evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
    submitOptions: () => ({ deadline: Date.now() + 10000 }),
  });

  return _gateway;
}

// ─── Core invoke / query wrappers ─────────────────────────────────────────────

/**
 * Submit a transaction to the ledger (state-changing).
 * In mock mode, returns a pre-scripted response immediately.
 */
async function submit(chaincode, fn, args = [], channel = null) {
  const ch = channel || process.env.FABRIC_CHANNEL;

  if (isMock()) {
    const result = getMockResponse(chaincode, fn, args);
    console.log(`[MOCK] submit ${chaincode}::${fn}`, args);
    return result;
  }

  try {
    const gw = await getGateway();
    const network = gw.getNetwork(ch);
    const contract = network.getContract(chaincode);

    const resultBytes = await contract.submitTransaction(fn, ...args.map(String));
    const str = Buffer.from(resultBytes).toString();
    try {
      return JSON.parse(str);
    } catch (e) {
      return str; // Return raw string if not JSON (like a plain TX ID)
    }
  } catch (err) {
    console.warn(`[Fabric submit ${chaincode}::${fn}] ${err.message}. Auto-resetting gateway & using fallback.`);
    await closeGateway();
    return getMockResponse(chaincode, fn, args);
  }
}

/**
 * Evaluate a query (read-only, no consensus).
 */
async function evaluate(chaincode, fn, args = [], channel = null) {
  const ch = channel || process.env.FABRIC_CHANNEL;

  if (isMock()) {
    const result = getMockResponse(chaincode, fn, args);
    console.log(`[MOCK] evaluate ${chaincode}::${fn}`, args);
    return result;
  }

  try {
    const gw = await getGateway();
    const network = gw.getNetwork(ch);
    const contract = network.getContract(chaincode);

    const resultBytes = await contract.evaluateTransaction(fn, ...args.map(String));
    const str = Buffer.from(resultBytes).toString();
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  } catch (err) {
    console.warn(`[Fabric evaluate ${chaincode}::${fn}] ${err.message}. Auto-resetting gateway & using fallback.`);
    await closeGateway();
    return getMockResponse(chaincode, fn, args);
  }
}

/**
 * Register a Fabric event listener and call handler(event) on each event.
 * Returns an unsubscribe function.
 * In mock mode, the WebSocket service uses manual triggers instead.
 */
async function listenEvents(chaincode, eventName, handler, channel = null) {
  if (isMock()) {
    console.log(`[MOCK] event listener registered for ${chaincode}::${eventName} (no-op in mock mode)`);
    return () => {};
  }

  try {
    const ch = channel || process.env.FABRIC_CHANNEL;
    const gw = await getGateway();
    const network = gw.getNetwork(ch);
    const events = await network.getChaincodeEvents(chaincode);

    (async () => {
      try {
        for await (const event of events) {
          if (event.eventName === eventName || eventName === '*') {
            try {
              const payload = event.payload ? JSON.parse(Buffer.from(event.payload).toString()) : {};
              await handler({ name: event.eventName, payload, txId: event.transactionId });
            } catch (e) {
              console.error(`Event handler error for ${event.eventName}:`, e);
            }
          }
        }
      } catch (streamErr) {
        console.warn(`[Fabric Events] Stream for ${chaincode} ended:`, streamErr.message);
      }
    })();

    return () => { try { events.close(); } catch (_) {} };
  } catch (err) {
    console.warn(`[Fabric Events] Could not subscribe to ${chaincode} events (${err.message}). WebSocket fallback active.`);
    return () => {};
  }
}

async function closeGateway() {
  if (_gateway) { _gateway.close(); _gateway = null; }
  if (_client) { _client.close(); _client = null; }
}

module.exports = { submit, evaluate, listenEvents, closeGateway, isMock };
