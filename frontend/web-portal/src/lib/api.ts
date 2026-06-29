import axios from 'axios';
import type { Parcel, SuccessionCase, Transfer, TribalCheckResult } from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─── Auth store (in-memory for demo; use localStorage in prod) ────────────────

let _token: string | null = null;

export function setToken(token: string) { _token = token; }
export function getToken() { return _token; }

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

// ─── Demo auth ────────────────────────────────────────────────────────────────

export async function getDemoToken(role: string, name: string): Promise<string> {
  const res = await api.get(`/api/auth/demo-token`, { params: { role, name } });
  const token = res.data.token as string;
  setToken(token);
  return token;
}

// ─── DLPI ─────────────────────────────────────────────────────────────────────

export async function getParcel(dlpiId: string): Promise<Parcel> {
  const res = await api.get(`/api/dlpi/${dlpiId}`);
  return res.data;
}

export async function getParcelHistory(dlpiId: string) {
  const res = await api.get(`/api/dlpi/${dlpiId}/history`);
  return res.data;
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

export async function initiateTransfer(payload: {
  dlpiId: string;
  sellerAadhaarHash: string;
  buyerName: string;
  buyerAadhaarHash: string;
  declaredValueINR: number;
  isTribalBuyer?: boolean;
}): Promise<Transfer & { tribalCheck?: TribalCheckResult }> {
  const res = await api.post('/api/transfer/initiate', payload);
  return res.data;
}

export async function recordConsent(transferId: string, payload: {
  partyType: 'SELLER' | 'BUYER';
  aadhaarHash: string;
  eSignTxHash: string;
}) {
  const res = await api.post(`/api/transfer/${transferId}/consent`, payload);
  return res.data;
}

export async function confirmStampDuty(transferId: string, payload: {
  upiRefNo: string;
  saleAgreementCID: string;
}) {
  const res = await api.post(`/api/transfer/${transferId}/stamp-duty`, payload);
  return res.data;
}

export async function executeTransfer(transferId: string, newTitleCID: string) {
  const res = await api.post(`/api/transfer/${transferId}/execute`, { newTitleCID });
  return res.data;
}

// ─── Succession ───────────────────────────────────────────────────────────────

export async function getSuccessionCase(caseId: string): Promise<SuccessionCase> {
  const res = await api.get(`/api/succession/${caseId}`);
  return res.data;
}

export async function getSuccessionByDLPI(dlpiId: string): Promise<SuccessionCase[]> {
  const res = await api.get(`/api/succession/dlpi/${dlpiId}`);
  return res.data;
}

export async function initiateSuccession(payload: {
  dlpiId: string;
  familyId: string;
  deceasedName: string;
  deceasedAadhaarHash: string;
  dateOfDeath: string;
  deathCertCID: string;
  crsRegistrationNo: string;
}) {
  const res = await api.post('/api/succession/initiate', payload);
  return res.data;
}

export async function recordHeirConsent(caseId: string, payload: {
  heirAadhaarHash: string;
  eSignTxHash: string;
}) {
  const res = await api.post(`/api/succession/${caseId}/consent`, payload);
  return res.data;
}

// ─── Tribal Guard ─────────────────────────────────────────────────────────────

export async function checkTribal(payload: {
  dlpiId: string;
  buyerName: string;
  buyerAadhaarHash: string;
  isTribalBuyer?: boolean;
}): Promise<TribalCheckResult> {
  try {
    const res = await api.post('/api/tribal/check', payload);
    return res.data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      return err.response.data as TribalCheckResult;
    }
    throw err;
  }
}

export async function isTribalParcel(dlpiId: string) {
  const res = await api.get(`/api/tribal/parcel/${dlpiId}`);
  return res.data;
}

// ─── Encumbrance Certificate ──────────────────────────────────────────────────

export async function generateEC(dlpiId: string) {
  const res = await api.get(`/api/encumbrance/ec/${dlpiId}`);
  return res.data;
}

// ─── Oracle ───────────────────────────────────────────────────────────────────

export async function calculateStampDuty(payload: {
  dlpiId: string;
  landType: string;
  areaHectares: number;
  declaredValueINR: number;
  tehsilCode: string;
}) {
  const res = await api.post('/api/oracle/stamp-duty/calculate', payload);
  return res.data;
}

export async function verifyCRS(registrationNo: string) {
  const res = await api.post('/api/oracle/crs/verify', { registrationNo });
  return res.data;
}

// ─── NyayaAI ─────────────────────────────────────────────────────────────────

export async function predictDispute(payload: {
  dlpiId: string;
  disputeType: string;
  facts: string;
}) {
  const res = await api.post('/api/ai/nyaya/predict', payload);
  return res.data as {
    winProbability: number;
    settleProbability: number;
    loseProbability: number;
    confidence: number;
    recommendedAction: string;
    reasoning?: string;
    precedents: Array<{
      caseNo: string;
      court: string;
      year: number;
      ruling: string;
      relevance: number;
    }>;
    modelVersion?: string;
    source?: string;
  };
}

// ─── BhumiAuction ─────────────────────────────────────────────────────────────

export async function getAuctions() {
  const res = await api.get('/api/auction');
  return res.data;
}

export async function placeBid(auctionId: string, payload: {
  bidAmountINR: number;
  bidderAadhaarHash: string;
}) {
  const res = await api.post(`/api/auction/${auctionId}/bid`, payload);
  return res.data;
}

// ─── Demo trigger (mock mode only) ───────────────────────────────────────────

export async function triggerDemoEvent(key: string) {
  const res = await api.post('/api/demo/trigger', { key });
  return res.data;
}

export default api;
