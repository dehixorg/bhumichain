'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes        = require('./routes/auth');
const dlpiRoutes        = require('./routes/dlpi');
const transferRoutes    = require('./routes/transfer');
const mutationRoutes    = require('./routes/mutation');
const uttaradhikarRoutes = require('./routes/uttaradhikar');
const tribalRoutes      = require('./routes/tribal');
const encumbranceRoutes = require('./routes/encumbrance');
const auctionRoutes     = require('./routes/auction');
const { authenticate, ROLES } = require('./middleware/auth');
const { init: initWs, triggerMockEvent } = require('./services/websocket');
const { isMock } = require('./services/fabric');

const app = express();
const server = http.createServer(app);

// ─── Security & Middleware ────────────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ─── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (_, res) =>
  res.json({
    status: 'ok',
    fabricMode: process.env.FABRIC_MODE || 'mock',
    oracleMode: process.env.ORACLE_MODE || 'mock',
    ts: new Date().toISOString(),
  }),
);

// Auth routes handle /api/auth/* — mounted below

// ─── Mock demo event trigger ──────────────────────────────────────────────────
// POST /api/demo/trigger { key: "scene3_death_detected" }
// Used by the demo presenter to fire WebSocket events on cue.
app.post('/api/demo/trigger', authenticate, (req, res) => {
  if (!isMock()) return res.status(403).json({ error: 'Only available in mock mode' });
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  const fired = triggerMockEvent(key);
  if (!fired) return res.status(404).json({ error: `No mock event found for key: ${key}` });
  res.json({ fired: true, key });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.use('/api/auth',        authRoutes);
app.use('/api/dlpi',        dlpiRoutes);
app.use('/api/transfer',    transferRoutes);
app.use('/api/mutation',    mutationRoutes);
app.use('/api/succession',  uttaradhikarRoutes);
app.use('/api/tribal',      tribalRoutes);
app.use('/api/encumbrance', encumbranceRoutes);
app.use('/api/auction',     auctionRoutes);

// Oracle proxy — forward to oracle-service (avoids CORS on frontend)
const axios = require('axios');
app.use('/api/oracle', authenticate, async (req, res) => {
  try {
    const oracleRes = await axios({
      method: req.method,
      url: `${process.env.ORACLE_SERVICE_URL || 'http://localhost:8001'}${req.path}`,
      data: req.body,
      params: req.query,
    });
    res.status(oracleRes.status).json(oracleRes.data);
  } catch (e) {
    const status = e.response?.status || 502;
    res.status(status).json(e.response?.data || { error: 'ORACLE_UNREACHABLE' });
  }
});

// NyayaAI — calls Azure AI (GPT-4.1) when configured, else falls back to local port 8012
app.post('/api/ai/nyaya/predict', authenticate, async (req, res) => {
  const azureEndpoint = process.env.AZURE_AI_ENDPOINT;
  const azureKey      = process.env.AZURE_AI_KEY;
  const azureModel    = process.env.AZURE_AI_MODEL || 'gpt-5.4';

  if (azureEndpoint && azureKey) {
    try {
      const { dlpiId, disputeType, facts } = req.body;
      const systemPrompt = `You are NyayaAI, an Indian land law legal prediction engine specialising in Uttar Pradesh land disputes.
You have been trained on 18 crore eCourts cases. Respond ONLY with a JSON object — no markdown, no preamble.

Schema:
{
  "winProbability": number (0-1),
  "settleProbability": number (0-1),
  "loseProbability": number (0-1),
  "confidence": number (0-1),
  "recommendedAction": string,
  "reasoning": string (2-3 sentences, cite specific acts/sections),
  "precedents": [
    {
      "caseNo": string,
      "court": string,
      "year": number,
      "ruling": string (one sentence),
      "relevance": number (0-1)
    }
  ] (exactly 3 entries)
}

Rules: winProbability + settleProbability + loseProbability must sum to 1.0. Cite real Indian case law.
Jurisdiction: Uttar Pradesh Revenue Law, Hindu Succession Act 1956/2005, UP Zamindari Abolition and Land Reforms Act 1950.`;

      const userMessage = `DLPI: ${dlpiId}\nDispute Type: ${disputeType}\nFacts: ${facts}`;

      const r = await axios.post(azureEndpoint, {
        model: azureModel,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage },
        ],
      }, {
        headers: {
          'api-key': azureKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      // Parse Azure AI Foundry Responses API output
      const outputItems = r.data.output || [];
      const textItem = outputItems.find((o) => o.type === 'message');
      const rawText  = textItem?.content?.find((c) => c.type === 'output_text')?.text || '{}';

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // Strip markdown code fences if present
        const stripped = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        parsed = JSON.parse(stripped);
      }

      return res.json({ ...parsed, modelVersion: `NyayaAI (${azureModel})`, source: 'azure' });
    } catch (e) {
      console.warn('[NyayaAI Azure]', e.message);
      // Fall through to local service below
    }
  }

  // Fallback: local NyayaAI service
  try {
    const url = `${process.env.NYAYA_URL || 'http://localhost:8012'}/nyaya/predict`;
    const r = await axios.post(url, req.body, {
      headers: { 'x-user-role': req.user.role, 'x-aadhaar-hash': req.user.aadhaarHash },
    });
    res.json({ ...r.data, source: 'local' });
  } catch (e) {
    res.status(502).json({ error: 'NYAYA_AI_UNREACHABLE', message: e.message });
  }
});

// NyayaAI other endpoints — proxy to local service
app.use('/api/ai/nyaya', authenticate, async (req, res) => {
  try {
    const url = `${process.env.NYAYA_URL || 'http://localhost:8012'}/nyaya${req.path}`;
    const r = await axios({ method: req.method, url, data: req.body, params: req.query,
      headers: { 'x-user-role': req.user.role, 'x-aadhaar-hash': req.user.aadhaarHash } });
    res.status(r.status).json(r.data);
  } catch (e) {
    res.status(e.response?.status || 502).json(e.response?.data || { error: 'NYAYA_AI_UNREACHABLE' });
  }
});

// RecordScan proxy — port 8010
app.use('/api/ai/record-scan', authenticate, async (req, res) => {
  try {
    const url = `${process.env.RECORD_SCAN_URL || 'http://localhost:8010'}${req.path}`;
    const r = await axios({ method: req.method, url, data: req.body, params: req.query });
    res.status(r.status).json(r.data);
  } catch (e) {
    res.status(e.response?.status || 502).json(e.response?.data || { error: 'RECORD_SCAN_UNREACHABLE' });
  }
});

// CoparcenaryMapper proxy — port 8011
app.use('/api/ai/coparcenary', authenticate, async (req, res) => {
  try {
    const url = `${process.env.COPARCENARY_URL || 'http://localhost:8011'}${req.path}`;
    const r = await axios({ method: req.method, url, data: req.body, params: req.query });
    res.status(r.status).json(r.data);
  } catch (e) {
    res.status(e.response?.status || 502).json(e.response?.data || { error: 'COPARCENARY_UNREACHABLE' });
  }
});

// BhumiSettle + FraudSense proxy — port 8013
app.use('/api/ai/settle', authenticate, async (req, res) => {
  try {
    const url = `${process.env.SETTLE_URL || 'http://localhost:8013'}${req.path}`;
    const r = await axios({ method: req.method, url, data: req.body, params: req.query });
    res.status(r.status).json(r.data);
  } catch (e) {
    res.status(e.response?.status || 502).json(e.response?.data || { error: 'SETTLE_UNREACHABLE' });
  }
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('[Global Error Handler]', err);
  // Send 500 error but scrub message in production
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({ 
    error: 'INTERNAL_ERROR', 
    message: isProd ? 'An unexpected error occurred' : err.message 
  });
});

// Fallback for unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;

server.listen(PORT, async () => {
  console.log(`\n🌿 BhumiChain API Gateway`);
  console.log(`   REST  → http://localhost:${PORT}`);
  console.log(`   WS    → ws://localhost:${PORT}/ws`);
  console.log(`   Mode  → FABRIC=${process.env.FABRIC_MODE || 'mock'} | ORACLE=${process.env.ORACLE_MODE || 'mock'}`);
  await initWs(server);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully.');
  server.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  gracefulShutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

module.exports = { app, server }; // for tests
