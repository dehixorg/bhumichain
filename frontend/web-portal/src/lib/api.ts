import axios from 'axios';
import type { Parcel, SuccessionCase, Transfer, TribalCheckResult } from '@/types';
import { apiFetch } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('bhumichain_token');
  }
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      (config.headers as any)['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Demo auth ────────────────────────────────────────────────────────────────

export async function getDemoToken(role: string, name: string): Promise<string> {
  // CRITICAL FIX: Never overwrite the currently logged-in user's token.
  // If a valid session exists, return the existing token and do NOT switch identity.
  if (typeof window !== 'undefined') {
    const existingToken = localStorage.getItem('bhumichain_token');
    if (existingToken) {
      // Return existing token — preserve citizen/officer session as-is
      return existingToken;
    }
  }
  // Only fetch a demo token if no session exists (e.g. direct API page access)
  const persona = role === 'oracle' ? 'circle_officer' : (role || 'citizen');
  try {
    const res = await api.post(`/api/auth/demo-token`, { persona });
    const token = res.data.token as string;
    if (typeof window !== 'undefined') {
      // Only store if still no token (double-check race condition)
      if (!localStorage.getItem('bhumichain_token')) {
        localStorage.setItem('bhumichain_token', token);
      }
    }
    return token;
  } catch {
    return '';
  }
}

// ─── DLPI ─────────────────────────────────────────────────────────────────────

export async function getParcel(dlpiId: string): Promise<Parcel> {
  const res = await apiFetch(`/api/dlpi/${dlpiId}`);
  return res.json();
}

export async function getParcelHistory(dlpiId: string) {
  const res = await apiFetch(`/api/dlpi/${dlpiId}/history`);
  return res.json();
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

export async function initiateTransfer(payload: {
  dlpiId: string;
  sellerName?: string;
  sellerAadhaarNumber?: string;
  sellerAadhaar?: string;
  buyerName: string;
  buyerAadhaarNumber?: string;
  buyerAadhaar?: string;
  declaredValueINR: number;
  isTribalBuyer?: boolean;
}): Promise<Transfer & { tribalCheck?: TribalCheckResult }> {
  const sellerNum = (payload.sellerAadhaarNumber || payload.sellerAadhaar || '').replace(/\D/g, '') || payload.sellerAadhaarNumber || '';
  const buyerNum = (payload.buyerAadhaarNumber || payload.buyerAadhaar || '').replace(/\D/g, '') || payload.buyerAadhaarNumber || '';
  const res = await apiFetch('/api/transfer/initiate', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      sellerAadhaarNumber: sellerNum,
      sellerAadhaar: sellerNum,
      buyerAadhaarNumber: buyerNum,
      buyerAadhaar: buyerNum,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Failed to initiate transfer');
  return data;
}

export async function getMyPendingTransfers(): Promise<any[]> {
  try {
    const res = await apiFetch('/api/transfer/my-pending');
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function recordConsent(transferId: string, payload: {
  partyType: 'SELLER' | 'BUYER';
  aadhaarNumber?: string;
  aadhaar?: string;
  eSignTxHash: string;
}) {
  const aadhaarNum = ((payload.aadhaarNumber || payload.aadhaar || '').replace(/\D/g, '') || payload.aadhaarNumber || '');
  const res = await apiFetch(`/api/transfer/${transferId}/consent`, {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      aadhaarNumber: aadhaarNum,
      aadhaar: aadhaarNum,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Failed to record consent');
  return data;
}

export async function confirmStampDuty(transferId: string, payload: {
  upiRefNo: string;
  saleAgreementCID: string;
}) {
  const res = await apiFetch(`/api/transfer/${transferId}/stamp-duty`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function approveTransferByPatwari(transferId: string) {
  const res = await apiFetch(`/api/transfer/${transferId}/approve/karmachari`, { method: 'POST' });
  return res.json();
}

export async function approveTransferByCI(transferId: string) {
  const res = await apiFetch(`/api/transfer/${transferId}/approve/ci`, { method: 'POST' });
  return res.json();
}

export async function getTransferHistory(transferId: string) {
  try {
    const res = await apiFetch(`/api/transfer/${transferId}/history`);
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function approveTransferBySRO(transferId: string, newTitleCID: string) {
  const res = await apiFetch(`/api/transfer/${transferId}/approve/sro`, {
    method: 'POST',
    body: JSON.stringify({ newTitleCID }),
  });
  return res.json();
}

export async function approveTransferByTehsildar(transferId: string) {
  const res = await apiFetch(`/api/transfer/${transferId}/approve/circle_officer`, { method: 'POST' });
  return res.json();
}

// ─── Succession ───────────────────────────────────────────────────────────────

export async function getSuccessionCase(caseId: string): Promise<SuccessionCase> {
  const res = await apiFetch(`/api/succession/${caseId}`);
  return res.json();
}

export async function getSuccessionByDLPI(dlpiId: string): Promise<SuccessionCase[]> {
  const res = await apiFetch(`/api/succession/dlpi/${dlpiId}`);
  return res.json();
}

export async function initiateSuccession(payload: {
  dlpiId: string;
  familyId: string;
  deceasedName: string;
  deceasedAadhaarNumber: string;
  dateOfDeath: string;
  deathCertCID: string;
  crsRegistrationNo: string;
  heirs?: { name: string; aadhaar: string }[];
}) {
  const res = await apiFetch(`/api/succession/initiate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function recordHeirConsent(caseId: string, payload: {
  heirAadhaarNumber: string;
  eSignTxHash: string;
}) {
  const res = await apiFetch(`/api/succession/${caseId}/consent`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getMyPendingSuccessions() {
  const res = await apiFetch(`/api/succession/my-pending`);
  return res.json();
}

export async function executeSuccession(caseId: string) {
  const res = await apiFetch(`/api/succession/${caseId}/execute`, { method: 'POST' });
  return res.json();
}

export async function nominateHeirs(payload: {
  dlpiId: string;
  heirs: { name: string; aadhaarNumber: string; }[];
}) {
  const res = await apiFetch(`/api/succession/nominate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getInheritorNominations() {
  const res = await apiFetch(`/api/succession/nominations`);
  return res.json();
}

export async function acceptNomination(nominationId: string) {
  const res = await apiFetch(`/api/succession/accept-nomination`, {
    method: 'POST',
    body: JSON.stringify({ nominationId }),
  });
  return res.json();
}

export async function executeSuccessionClaim(payload: {
  dlpiId: string;
  nominationId: string;
  deathCertCID: string;
}) {
  const res = await apiFetch(`/api/succession/execute-claim`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ─── Tribal Guard ─────────────────────────────────────────────────────────────

export async function checkTribal(payload: {
  dlpiId: string;
  buyerName: string;
  buyerAadhaarNumber: string;
  isTribalBuyer?: boolean;
}): Promise<TribalCheckResult> {
  const res = await apiFetch('/api/tribal/check', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (res.status === 403) {
    return await res.json() as TribalCheckResult;
  }
  return res.json();
}

export async function isTribalParcel(dlpiId: string) {
  const res = await apiFetch(`/api/tribal/parcel/${dlpiId}`);
  return res.json();
}

// ─── Encumbrance Certificate ──────────────────────────────────────────────────

export async function generateEC(dlpiId: string) {
  const res = await apiFetch(`/api/encumbrance/ec/${dlpiId}`);
  return res.json();
}

// ─── Oracle ───────────────────────────────────────────────────────────────────

export async function calculateStampDuty(payload: {
  dlpiId: string;
  landType: string;
  areaHectares: number;
  declaredValueINR: number;
  tehsilCode: string;
}) {
  const res = await apiFetch('/api/oracle/stamp-duty/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function verifyCRS(registrationNo: string) {
  const res = await apiFetch('/api/oracle/crs/verify', {
    method: 'POST',
    body: JSON.stringify({ registrationNo }),
  });
  return res.json();
}

// ─── NyayaAI ─────────────────────────────────────────────────────────────────

export async function predictDispute(payload: {
  dlpiId: string;
  disputeType: string;
  facts: string;
}) {
  const res = await apiFetch('/api/ai/nyaya/predict', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return await res.json() as {
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
  const res = await apiFetch('/api/auction');
  return res.json();
}

export async function placeBid(auctionId: string, payload: {
  bidAmountINR: number;
  bidderAadhaarNumber: string;
}) {
  const res = await apiFetch(`/api/auction/${auctionId}/bid`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ─── Demo trigger (mock mode only) ───────────────────────────────────────────

export async function triggerDemoEvent(key: string) {
  const res = await apiFetch('/api/demo/trigger', {
    method: 'POST',
    body: JSON.stringify({ key }),
  });
  return res.json();
}

export async function clearAllHistory() {
  const res = await apiFetch('/api/dlpi/clear-history', { method: 'POST' });
  return res.json();
}

export async function resetDemoRecords() {
  const res = await apiFetch('/api/dlpi/reset-demo', { method: 'POST' });
  return res.json();
}

export async function seedAtomicParcel(payload: any) {
  const res = await apiFetch('/api/dlpi/seed', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}

export default api;
