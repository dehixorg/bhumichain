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

async function getGateway() {
  if (_gateway) return _gateway;

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
    { 'grpc.ssl_target_name_override': 'peer0.revenuedept.bhumichain.in' }
  );

  _gateway = connect({
    client: _client,
    identity: { mspId: process.env.FABRIC_MSP_ID, credentials: Buffer.from(certPem) },
    signer: signers.newPrivateKeySigner(privateKey),
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
