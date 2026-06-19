'use strict';

const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const grpc = require('@grpc/grpc-js');
const fs = require('fs');
const path = require('path');
const { getMockResponse } = require('../mock/responses');

const isMock = () => process.env.FABRIC_MODE === 'mock';

// ─── Real Fabric Connection ───────────────────────────────────────────────────

let _gateway = null;
let _client = null;

async function getGateway() {
  if (_gateway) return _gateway;

  const tlsRootCert = fs.readFileSync(process.env.FABRIC_PEER_TLS_ROOT_CERT);
  const certPem = fs.readFileSync(process.env.FABRIC_CERT_PATH).toString();
  const keyDir = process.env.FABRIC_KEY_PATH;
  const keyPem = fs
    .readdirSync(keyDir)
    .filter((f) => f.endsWith('_sk'))
    .map((f) => fs.readFileSync(path.join(keyDir, f)).toString())[0];

  _client = new grpc.Client(process.env.FABRIC_PEER_ENDPOINT, grpc.credentials.createSsl(tlsRootCert));

  _gateway = connect({
    client: _client,
    identity: { mspId: process.env.FABRIC_MSP_ID, credentials: Buffer.from(certPem) },
    signer: signers.newPrivateKeySigner(hash.SHA256, Buffer.from(keyPem)),
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
  if (!resultBytes || resultBytes.length === 0) return { success: true };
  return JSON.parse(Buffer.from(resultBytes).toString());
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
  if (!resultBytes || resultBytes.length === 0) return null;
  return JSON.parse(Buffer.from(resultBytes).toString());
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

  const ch = channel || process.env.FABRIC_CHANNEL;
  const gw = await getGateway();
  const network = gw.getNetwork(ch);
  const events = await network.getChaincodeEvents(chaincode);

  (async () => {
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
  })();

  return () => events.close();
}

async function closeGateway() {
  if (_gateway) { _gateway.close(); _gateway = null; }
  if (_client) { _client.close(); _client = null; }
}

module.exports = { submit, evaluate, listenEvents, closeGateway, isMock };
