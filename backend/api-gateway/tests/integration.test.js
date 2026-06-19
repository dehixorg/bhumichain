'use strict';

/**
 * Integration tests for the API Gateway in FABRIC_MODE=mock.
 * Run: npm test
 * These tests verify every endpoint returns the correct shape,
 * and that the demo flow from Scene 2 through Scene 6 works end-to-end.
 */

process.env.FABRIC_MODE = 'mock';
process.env.ORACLE_MODE = 'mock';
process.env.JWT_SECRET = 'test-secret-123';
process.env.PORT = '4099';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../src/index');

function makeToken(role = 'revenue_officer') {
  return jwt.sign({ role, name: 'Test User', aadhaarHash: 'sha256:' + 'a'.repeat(64) }, 'test-secret-123');
}

const AUTH = { Authorization: `Bearer ${makeToken()}` };
const SRO_AUTH = { Authorization: `Bearer ${makeToken('sro')}` };
const CITIZEN_AUTH = { Authorization: `Bearer ${makeToken('citizen')}` };

describe('Health', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.fabricMode).toBe('mock');
  });
});

describe('Demo Token', () => {
  it('GET /api/auth/demo-token returns JWT', async () => {
    const res = await request(app)
      .get('/api/auth/demo-token?role=revenue_officer&name=Prakash');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.role).toBe('revenue_officer');
  });
});

describe('DLPI Routes', () => {
  it('GET /api/dlpi/DLPI-MH-SNN-00142 returns parcel data', async () => {
    const res = await request(app)
      .get('/api/dlpi/DLPI-MH-SNN-00142')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.dlpiId).toBe('DLPI-MH-SNN-00142');
    expect(res.body.ownerName).toBe('Ramesh Dattatray Patil');
  });

  it('GET /api/dlpi/DLPI-MH-IGT-T0023 returns tribal parcel', async () => {
    const res = await request(app)
      .get('/api/dlpi/DLPI-MH-IGT-T0023')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.landType).toBe('Tribal_FRA');
  });

  it('GET /api/dlpi/DLPI-MH-SNN-00142/history returns array', async () => {
    const res = await request(app)
      .get('/api/dlpi/DLPI-MH-SNN-00142/history')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/dlpi/INVALID rejects bad DLPI format', async () => {
    const res = await request(app)
      .get('/api/dlpi/INVALID')
      .set(AUTH);
    expect(res.status).toBe(400);
  });
});

describe('Transfer Routes', () => {
  it('POST /api/transfer/initiate succeeds for non-tribal parcel', async () => {
    const res = await request(app)
      .post('/api/transfer/initiate')
      .set({ Authorization: `Bearer ${makeToken('sro')}` })
      .send({
        dlpiId: 'DLPI-MH-SNN-00142',
        sellerAadhaarHash: 'sha256:' + 'a'.repeat(64),
        buyerName: 'Suresh Deshmukh',
        buyerAadhaarHash: 'sha256:' + 'b'.repeat(64),
        declaredValueINR: 4800000,
      });
    expect(res.status).toBe(201);
    expect(res.body.transferId).toBeDefined();
  });

  it('POST /api/transfer/initiate is HARD_REJECTED for tribal parcel (Scene 6)', async () => {
    const res = await request(app)
      .post('/api/transfer/initiate')
      .set({ Authorization: `Bearer ${makeToken('sro')}` })
      .send({
        dlpiId: 'DLPI-MH-IGT-T0023',
        sellerAadhaarHash: 'sha256:' + 'a'.repeat(64),
        buyerName: 'Rahul Shinde',
        buyerAadhaarHash: 'sha256:' + 'c'.repeat(64),
        declaredValueINR: 1800000,
        isTribalBuyer: false,
      });
    expect(res.status).toBe(403);
    expect(res.body.decision).toBe('HARD_REJECTED');
    expect(res.body.rejectionCode).toBe('SCHEDULE_V_NON_TRIBAL');
    expect(res.body.legalCitations.length).toBeGreaterThan(0);
    expect(res.body.responseTimeMs).toBeLessThan(500);
  });
});

describe('Succession Routes (Scene 3)', () => {
  it('POST /api/succession/initiate creates succession case', async () => {
    const res = await request(app)
      .post('/api/succession/initiate')
      .set({ Authorization: `Bearer ${makeToken('oracle')}` })
      .send({
        dlpiId: 'DLPI-MH-SNN-00142',
        familyId: 'FAM-001',
        deceasedName: 'Ramesh Dattatray Patil',
        deceasedAadhaarHash: 'sha256:' + 'a'.repeat(64),
        dateOfDeath: '2026-05-20',
        deathCertCID: 'QmDeathCertMock',
        crsRegistrationNo: 'CRS-NSK-2026-00541',
      });
    expect(res.status).toBe(201);
    expect(res.body.caseId).toBeDefined();
  });

  it('GET /api/succession/:caseId returns case with 3 heirs', async () => {
    const res = await request(app)
      .get('/api/succession/SUC-DLPI-MH-SNN-00142-a1b2c3d4')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.heirs).toHaveLength(3);
    const daughter = res.body.heirs.find((h) => h.relation === 'Daughter');
    expect(daughter).toBeDefined();
    expect(daughter.share).toBe('1/3');
    expect(daughter.legalNote).toMatch(/HSA 2005/);
  });
});

describe('TribalGuard Routes (Scene 6)', () => {
  it('POST /api/tribal/check hard-rejects non-tribal buyer', async () => {
    const res = await request(app)
      .post('/api/tribal/check')
      .set(AUTH)
      .send({
        dlpiId: 'DLPI-MH-IGT-T0023',
        buyerName: 'Rahul Shinde',
        buyerAadhaarHash: 'sha256:' + 'c'.repeat(64),
        isTribalBuyer: false,
      });
    expect(res.status).toBe(403);
    expect(res.body.decision).toBe('HARD_REJECTED');
    expect(res.body.legalCitations).toContainEqual(
      expect.stringMatching(/Samatha v\. State/),
    );
  });

  it('GET /api/tribal/parcel/DLPI-MH-IGT-T0023 returns tribal registry', async () => {
    const res = await request(app)
      .get('/api/tribal/parcel/DLPI-MH-IGT-T0023')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.isTribal).toBe(true);
  });
});

describe('Encumbrance Routes', () => {
  it('GET /api/encumbrance/ec/DLPI-MH-SNN-00142 generates EC', async () => {
    const res = await request(app)
      .get('/api/encumbrance/ec/DLPI-MH-SNN-00142')
      .set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.ecId).toBeDefined();
    expect(res.body.summary).toMatch(/CLEAR/);
  });
});

describe('Auth Guard', () => {
  it('requests without token return 401', async () => {
    const res = await request(app).get('/api/dlpi/DLPI-MH-SNN-00142');
    expect(res.status).toBe(401);
  });

  it('citizen cannot initiate mutation', async () => {
    const res = await request(app)
      .post('/api/mutation/initiate')
      .set(CITIZEN_AUTH)
      .send({
        dlpiId: 'DLPI-MH-SNN-00142',
        mutationType: 'Sale',
        officerName: 'X',
        officerHash: 'sha256:' + 'a'.repeat(64),
        officerRank: 'Circle Officer',
        newOwnerName: 'Y',
        newOwnerHash: 'sha256:' + 'b'.repeat(64),
        reason: 'Test',
        supportingCID: 'QmTest',
      });
    expect(res.status).toBe(403);
  });
});
