'use strict';

require('dotenv').config();

const express = require('express');
const WebSocket = require('ws');

const MOCK         = process.env.TELEGRAM_MODE !== 'real';
const PORT         = parseInt(process.env.BOT_PORT || '8020', 10);
const GW_WS        = process.env.API_GATEWAY_WS || 'ws://localhost:4000';
const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN || '';
const OFFICER_CHAT = process.env.OFFICER_CHAT_ID   || '-100123456789';
const CITIZEN_CHAT = process.env.CITIZEN_ALERT_CHAT_ID || '-100987654321';

// ── In-memory notification log ────────────────────────────────────────────────

const notifications = [];

function addNotification(event, recipient, chatId, message) {
  const entry = {
    id:        `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    event,
    recipient,
    chatId,
    message,
    delivered: true,
    mode:      MOCK ? 'MOCK' : 'REAL',
  };
  notifications.unshift(entry);
  if (notifications.length > 200) notifications.pop();

  const preview = message.length > 80 ? message.slice(0, 80) + '…' : message;
  console.log(`[TelegramBot][${MOCK ? 'MOCK' : 'REAL'}] → ${recipient}: ${preview}`);
  return entry;
}

// ── Telegram sender (real or mock) ────────────────────────────────────────────

async function sendTelegram(chatId, text) {
  if (MOCK) {
    return { ok: true, mock: true };
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}

// ── Message templates ─────────────────────────────────────────────────────────

function formatMutationAlert(payload) {
  return {
    ownerMsg: `⚠️ <b>BhumiChain Alert</b>\n\nMutation <b>${payload.mutationType || 'Mutation'}</b> initiated on parcel <code>${payload.dlpiId}</code>.\n\nNew claimant: <b>${payload.newOwnerName || 'Unknown'}</b>\n\nYou have <b>30 days</b> to raise an objection.\n\nReply /OBJECT or visit bhumi.up.gov.in/mutation/${payload.mutationId}`,
    officerMsg: `✅ <b>BhumiChain</b>: Mutation <code>${payload.mutationId}</code> initiated.\nAlert delivered (SLA: met).\nObjection window open — 30 days.`,
  };
}

function formatConsentAlert(payload) {
  return `✅ <b>BhumiChain Consent Recorded</b>\n\nOwner eSign consent for mutation <code>${payload.mutationId}</code> on <code>${payload.dlpiId}</code> recorded on Hyperledger Fabric.\n\nMutation ready for execution by Patwari.`;
}

function formatObjectionAlert(payload) {
  return `🚨 <b>BhumiChain Objection Filed</b>\n\nOwner has filed objection on mutation <code>${payload.mutationId}</code>.\n\nParcel: <code>${payload.dlpiId}</code>\nReason on record. Tehsil office notified.`;
}

function formatExecutedAlert(payload) {
  return `🏛️ <b>BhumiChain Mutation Executed</b>\n\nMutation <code>${payload.mutationId}</code> on <code>${payload.dlpiId}</code> is now EXECUTED.\n\nNew owner recorded on Hyperledger Fabric.\nTX: <code>${payload.txHash || 'pending'}</code>`;
}

function formatDLPICreated(payload) {
  return `🌿 <b>BhumiChain — New DLPI</b>\n\nParcel <code>${payload.dlpiId}</code> recorded.\nOwner: <b>${payload.ownerName}</b>\nTX: <code>${payload.txHash}</code>`;
}

function formatTransferInitiated(payload) {
  return `🔒 <b>Transfer Initiated</b>\n\nParcel <code>${payload.dlpiId}</code> is now under national transfer lock.\nTransfer ID: <code>${payload.transferId}</code>\n\nAwaiting multi-party consent.`;
}

// ── WebSocket connection to API gateway ───────────────────────────────────────

let wsClient = null;
let wsRetryTimer = null;

function connectWS() {
  if (wsRetryTimer) { clearTimeout(wsRetryTimer); wsRetryTimer = null; }

  try {
    wsClient = new WebSocket(GW_WS);

    wsClient.on('open', () => {
      console.log(`[TelegramBot] Connected to API gateway WS: ${GW_WS}`);
    });

    wsClient.on('message', async (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      const { event, payload = {} } = msg;
      console.log(`[TelegramBot] Event: ${event}`);

      switch (event) {
        case 'MutationInitiated':
        case 'MutationAlert': {
          const { ownerMsg, officerMsg } = formatMutationAlert(payload);
          addNotification(event, `${payload.dlpiId || 'owner'} (current owner)`, CITIZEN_CHAT, ownerMsg);
          addNotification(event, 'Officer group',                                  OFFICER_CHAT, officerMsg);
          await Promise.all([
            sendTelegram(CITIZEN_CHAT, ownerMsg),
            sendTelegram(OFFICER_CHAT, officerMsg),
          ]);
          break;
        }
        case 'OwnerConsentRecorded': {
          const msg2 = formatConsentAlert(payload);
          addNotification(event, 'Officer group', OFFICER_CHAT, msg2);
          await sendTelegram(OFFICER_CHAT, msg2);
          break;
        }
        case 'OwnerObjectionFiled': {
          const msg2 = formatObjectionAlert(payload);
          addNotification(event, 'Tehsil office + officer', OFFICER_CHAT, msg2);
          await sendTelegram(OFFICER_CHAT, msg2);
          break;
        }
        case 'MutationExecuted': {
          const msg2 = formatExecutedAlert(payload);
          addNotification(event, 'Owner + officer group', OFFICER_CHAT, msg2);
          await sendTelegram(OFFICER_CHAT, msg2);
          break;
        }
        case 'DLPICreated': {
          const msg2 = formatDLPICreated(payload);
          addNotification(event, 'Officer group', OFFICER_CHAT, msg2);
          await sendTelegram(OFFICER_CHAT, msg2);
          break;
        }
        case 'TransferInitiated': {
          const msg2 = formatTransferInitiated(payload);
          addNotification(event, 'Owner + officer group', OFFICER_CHAT, msg2);
          await sendTelegram(OFFICER_CHAT, msg2);
          break;
        }
        default:
          break;
      }
    });

    wsClient.on('close', () => {
      console.log('[TelegramBot] WS disconnected. Retrying in 5s…');
      wsRetryTimer = setTimeout(connectWS, 5000);
    });

    wsClient.on('error', (err) => {
      console.error('[TelegramBot] WS error:', err.message);
    });
  } catch (err) {
    console.error('[TelegramBot] WS connect failed:', err.message);
    wsRetryTimer = setTimeout(connectWS, 5000);
  }
}

// ── Pre-seed demo notifications ───────────────────────────────────────────────

function seedDemoNotifications() {
  const demos = [
    {
      event: 'MutationAlert',
      recipient: 'Deepak Narayan Singh (family)',
      chatId: CITIZEN_CHAT,
      message: '⚠️ BhumiChain Alert\n\nMutation Virasat (Inheritance) initiated on parcel DLPI-UP-DAD-00100.\n\nNew claimant: Ankur Singh\n\nYou have 30 days to raise an objection.\n\nReply /OBJECT or visit bhumi.up.gov.in/mutation/MUT-DLPI-UP-DAD-00100-d4e5f6a7',
    },
    {
      event: 'MutationAlert',
      recipient: 'Patwari Ramesh Yadav (officer group)',
      chatId: OFFICER_CHAT,
      message: '✅ BhumiChain: Mutation MUT-DLPI-UP-DAD-00100-d4e5f6a7 initiated. Alert delivered in 64s (SLA: met). Objection window open — 30 days.',
    },
    {
      event: 'MutationAlert',
      recipient: 'Neighbour: Arun Sharma (adjacent parcel DLPI-UP-DAD-00003)',
      chatId: CITIZEN_CHAT,
      message: '📢 Public Notice: Land mutation on adjacent parcel DLPI-UP-DAD-00100 in Gharbara, Dadri. View: bhumi.up.gov.in/mutation/MUT-DLPI-UP-DAD-00100-d4e5f6a7',
    },
    {
      event: 'MutationInitiated',
      recipient: 'Vinod Prasad (owner)',
      chatId: CITIZEN_CHAT,
      message: '⚠️ BhumiChain Alert\n\nMutation Bikri (Sale) initiated on parcel DLPI-UP-DAD-00042.\n\nNew claimant: Suresh Mehta\n\nYou have 15 days to raise an objection.',
    },
    {
      event: 'OwnerConsentRecorded',
      recipient: 'Officer group',
      chatId: OFFICER_CHAT,
      message: '✅ BhumiChain Consent Recorded\n\nOwner eSign consent for mutation MUT-DLPI-UP-DAD-00042-e5f6a7b8 on DLPI-UP-DAD-00042 recorded on Hyperledger Fabric.\n\nMutation ready for execution.',
    },
  ];

  const now = Date.now();
  demos.forEach((d, i) => {
    notifications.push({
      id:        `NOTIF-DEMO-${i + 1}`,
      timestamp: new Date(now - (demos.length - i) * 90000).toISOString(),
      event:     d.event,
      recipient: d.recipient,
      chatId:    d.chatId,
      message:   d.message,
      delivered: true,
      mode:      'MOCK',
    });
  });
}

// ── HTTP API ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status:         'ok',
    mode:           MOCK ? 'mock' : 'real',
    port:           PORT,
    wsConnected:    wsClient?.readyState === WebSocket.OPEN,
    notificationCount: notifications.length,
  });
});

app.get('/notifications', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json(notifications.slice(0, limit));
});

app.post('/notifications/test', (req, res) => {
  const { event = 'TestAlert', recipient = 'Demo User', message = 'Test notification from BhumiChain' } = req.body;
  const entry = addNotification(event, recipient, CITIZEN_CHAT, message);
  res.json({ sent: true, notification: entry });
});

// Simulate sending a mutation alert (for demo triggers from frontend)
app.post('/notifications/simulate', (req, res) => {
  const { mutationId, dlpiId, mutationType, newOwnerName } = req.body;
  if (!mutationId) return res.status(400).json({ error: 'mutationId required' });

  const { ownerMsg, officerMsg } = formatMutationAlert({ mutationId, dlpiId, mutationType, newOwnerName });
  const n1 = addNotification('MutationAlert', `${dlpiId} (current owner)`, CITIZEN_CHAT, ownerMsg);
  const n2 = addNotification('MutationAlert', 'Officer group', OFFICER_CHAT, officerMsg);

  res.json({ sent: true, notifications: [n1, n2] });
});

app.listen(PORT, () => {
  console.log(`\n📱 BhumiChain Telegram Bot`);
  console.log(`   REST  → http://localhost:${PORT}`);
  console.log(`   Mode  → ${MOCK ? 'MOCK (logging only)' : 'REAL (sending to Telegram)'}`);
  console.log(`   WS    → ${GW_WS}`);
  if (MOCK) console.log(`   Note  → Set TELEGRAM_MODE=real + TELEGRAM_BOT_TOKEN to go live\n`);

  seedDemoNotifications();
  connectWS();
});
