'use strict';

const { WebSocketServer } = require('ws');
const { listenEvents, isMock } = require('./fabric');
const { DEMO_WS_EVENTS } = require('../mock/responses');

let wss = null;
// Map of clientId → ws connection (for targeted delivery)
const clients = new Map();

// All Fabric events we want to relay to the browser
const WATCHED_EVENTS = [
  { chaincode: 'dlpi',              name: '*' },
  { chaincode: 'property-transfer', name: '*' },
  { chaincode: 'mutation-manager',  name: '*' },
  { chaincode: 'uttaradhikar',      name: '*' },
  { chaincode: 'tribal-guard',      name: '*' },
  { chaincode: 'encumbrance',       name: '*' },
];

/**
 * Broadcast a message to all connected WebSocket clients.
 * Optionally filter by dlpiId so only the right dashboard gets the alert.
 */
function broadcast(eventName, payload, dlpiId = null) {
  if (!wss) return;
  const msg = JSON.stringify({ event: eventName, payload, ts: new Date().toISOString() });
  wss.clients.forEach((ws) => {
    if (ws.readyState !== 1 /* OPEN */) return;
    // If client subscribed to a specific dlpiId, only send matching events
    if (dlpiId && ws.subscribedDlpiId && ws.subscribedDlpiId !== dlpiId) return;
    ws.send(msg);
  });
}

/**
 * Initialise the WebSocket server and start Fabric event listeners.
 * Called once from index.js after Express app starts.
 */
async function init(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    ws.clientId = id;
    clients.set(id, ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        // Client can subscribe to a specific parcel to filter events
        if (msg.type === 'SUBSCRIBE_DLPI') {
          ws.subscribedDlpiId = msg.dlpiId;
          ws.send(JSON.stringify({ event: 'SUBSCRIBED', dlpiId: msg.dlpiId }));
        }
        // Allow frontend to trigger mock demo events in mock mode
        if (msg.type === 'TRIGGER_MOCK_EVENT' && isMock()) {
          const template = DEMO_WS_EVENTS[msg.key];
          if (template) {
            broadcast(template.event, template.payload);
          }
        }
      } catch (_) {}
    });

    ws.on('close', () => clients.delete(id));
    ws.on('error', (e) => console.error('WS client error:', e));

    ws.send(JSON.stringify({
      event: 'CONNECTED',
      mode: isMock() ? 'mock' : 'fabric',
      ts: new Date().toISOString(),
    }));
  });

  // In real mode: subscribe to all chaincode events and relay them
  if (!isMock()) {
    for (const { chaincode, name } of WATCHED_EVENTS) {
      await listenEvents(chaincode, name, ({ name: evName, payload }) => {
        broadcast(evName, payload, payload?.dlpiId);
      });
    }
  }

  console.log(`[WS] WebSocket server ready — mode: ${isMock() ? 'mock' : 'fabric'}`);
}

/**
 * Programmatically fire a mock event (called from demo trigger endpoint).
 */
function triggerMockEvent(key) {
  const template = DEMO_WS_EVENTS[key];
  if (!template) return false;
  broadcast(template.event, template.payload);
  return true;
}

module.exports = { init, broadcast, triggerMockEvent };
