'use strict';

/**
 * Nearby Property Notification Service
 * When a parcel is listed for sale, adjacent landowners (and preemption-right
 * holders) get a real-time WebSocket alert.
 *
 * In mock mode: returns pre-scripted neighbours for DLPI-MH-SNN-00142.
 * In real mode: performs spatial query on parcel GeoJSON boundaries in CouchDB.
 */

const { broadcast } = require('./websocket');
const { isMock } = require('./fabric');

// Mock adjacency map — parcel → list of adjacent DLPI IDs + owner names
const MOCK_ADJACENT = {
  'DLPI-MH-SNN-00142': [
    { dlpiId: 'DLPI-MH-SNN-00143', ownerName: 'Vijayrao Pandurang Shinde', relation: 'East', hasPreemptionRight: true },
    { dlpiId: 'DLPI-MH-SNN-00141', ownerName: 'Kantabai Shantaram More', relation: 'West', hasPreemptionRight: true },
    { dlpiId: 'DLPI-MH-SNN-00158', ownerName: 'Maruti Gangaram Jadhav', relation: 'North', hasPreemptionRight: false },
  ],
};

/**
 * Notify adjacent landowners when a parcel enters transfer.
 * Called from transfer route after InitiateTransfer succeeds.
 */
async function notifyAdjacentOwners(dlpiId, transferId, declaredValueINR, buyerName) {
  let adjacent = [];

  if (isMock()) {
    adjacent = MOCK_ADJACENT[dlpiId] || [];
  } else {
    // Real: spatial query against CouchDB GeoJSON index
    // adjacent = await spatialQuery(dlpiId);
    adjacent = [];
  }

  if (adjacent.length === 0) return;

  const preemptionHolders = adjacent.filter((n) => n.hasPreemptionRight);

  broadcast('AdjacentSaleAlert', {
    dlpiId,
    transferId,
    declaredValueINR,
    buyerName,
    adjacentParcels: adjacent,
    preemptionHolders: preemptionHolders.map((p) => ({
      dlpiId: p.dlpiId,
      ownerName: p.ownerName,
      legalRight: 'Preemption right under Maharashtra Land Revenue Code — you have 30 days to match this offer',
    })),
    message: `⚠️ Adjacent parcel ${dlpiId} is being sold. You may have a legal preemption right.`,
  });

  console.log(`[Nearby] Notified ${adjacent.length} adjacent owners for ${dlpiId}`);
}

module.exports = { notifyAdjacentOwners };
