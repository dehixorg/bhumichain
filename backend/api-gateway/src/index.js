'use strict';

require('dotenv').config();

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const dlpiRoutes = require('./routes/dlpi');
const transferRoutes = require('./routes/transfer');
const mutationRoutes = require('./routes/mutation');
const uttaradhikarRoutes = require('./routes/uttaradhikar');
const tribalRoutes = require('./routes/tribal');
const encumbranceRoutes = require('./routes/encumbrance');
const { authenticate, issueDemoToken, ROLES } = require('./middleware/auth');
const { init: initWs, triggerMockEvent } = require('./services/websocket');
const { isMock } = require('./services/fabric');

const app = express();
const server = http.createServer(app);

// ─── Security & Middleware ────────────────────────────────────────────────────

app.use(helmet());
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

// ─── Demo auth (mock mode only) ───────────────────────────────────────────────
// Issues a JWT for the demo without a real IdP.
// GET /api/auth/demo-token?role=revenue_officer&name=Prakash+Kulkarni
app.get('/api/auth/demo-token', (req, res) => {
  if (!isMock()) return res.status(403).json({ error: 'Demo tokens only in mock mode' });
  const role = req.query.role || ROLES.CITIZEN;
  const name = req.query.name || 'Demo User';
  const aadhaarHash = `sha256:demo-${role}-hash-placeholder000000000000000000000000000000000`;
  try {
    const token = issueDemoToken(role, name, aadhaarHash);
    res.json({ token, role, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

app.use('/api/dlpi',        dlpiRoutes);
app.use('/api/transfer',    transferRoutes);
app.use('/api/mutation',    mutationRoutes);
app.use('/api/succession',  uttaradhikarRoutes);
app.use('/api/tribal',      tribalRoutes);
app.use('/api/encumbrance', encumbranceRoutes);

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

// BhumiGPT proxy — routes to dedicated port 8012
app.use('/api/ai/bhumi-gpt', authenticate, async (req, res) => {
  try {
    const bgurlBase = process.env.BHUMI_GPT_URL || 'http://localhost:8012';
    const bgurlFull = `${bgurlBase}/bhumi-gpt${req.path}`;
    const bgRes = await axios({ method: req.method, url: bgurlFull, data: req.body, params: req.query });
    res.status(bgRes.status).json(bgRes.data);
  } catch (e) {
    const status = e.response?.status || 502;
    res.status(status).json(e.response?.data || { error: 'BHUMI_GPT_UNREACHABLE' });
  }
});

// Generic AI service proxy (CoparcenaryMapper, RecordScan, etc.)
app.use('/api/ai', authenticate, async (req, res) => {
  try {
    const aiRes = await axios({
      method: req.method,
      url: `${process.env.AI_SERVICE_URL || 'http://localhost:8002'}${req.path}`,
      data: req.body,
      params: req.query,
    });
    res.status(aiRes.status).json(aiRes.data);
  } catch (e) {
    const status = e.response?.status || 502;
    res.status(status).json(e.response?.data || { error: 'AI_SERVICE_UNREACHABLE' });
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
