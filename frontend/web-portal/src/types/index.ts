// ─── Core domain types matching chaincode structs ─────────────────────────────

export type LandType = 'Bagayat' | 'Jirayat' | 'Kharaba' | 'Tribal_FRA' | 'Government' | 'Forest';
export type EncumbranceStatus = 'CLEAR' | 'MORTGAGED' | 'COURT_INJUNCTION' | 'IT_ATTACHMENT' | 'MULTIPLE';
export type TehsilCode = 'SNN' | 'IGT' | 'NSK' | 'DIN' | 'NIK';

export interface ParcelOwner {
  name: string;
  aadhaarHash: string;
  dob?: string;
  isTribal?: boolean;
}

export interface CoparcenaryHeir {
  name: string;
  aadhaarHash: string;
  relation: string;
  share: string;
  shareDecimal: number;
  dob?: string;
  legalNote?: string;
}

export interface Coparcenary {
  heirs: CoparcenaryHeir[];
  applicableLaw: string;
  familyId?: string;
}

export interface ParcelLocation {
  latitude: number;
  longitude: number;
  tehsilName: string;
  villageName: string;
  districtName: string;
}

export interface Parcel {
  dlpiId: string;
  surveyNumber: string;
  tehsil: string;
  tehsilCode: TehsilCode;
  district: string;
  state: string;
  landType: LandType;
  landTypeDescription: string;
  areaHectares: number;
  isTribal: boolean;
  isCoparcenary: boolean;
  scheduleVArea: boolean;
  encumbranceStatus: EncumbranceStatus;
  owner: ParcelOwner;
  coparcenary?: Coparcenary;
  location: ParcelLocation;
  valuation?: { circleRateINR: number; estimatedValueINR: number };
  ipfsCID?: string;
  createdAt: string;
  txHash?: string;
  isDemoParcel?: boolean;
  demoScene?: number;
}

export interface GeoFeature {
  type: 'Feature';
  properties: {
    dlpiId: string;
    owner: string;
    landType: LandType;
    areaHectares: number;
    encumbranceStatus: EncumbranceStatus;
    isTribal: boolean;
    isCoparcenary: boolean;
    tehsil: string;
    surveyNumber: string;
    circleRateINR: number;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

// ─── Succession ───────────────────────────────────────────────────────────────

export interface SuccessionHeir {
  heirId: string;
  name: string;
  aadhaarHash: string;
  relation: string;
  gender: string;
  dob: string;
  isAlive: boolean;
  isAdult: boolean;
  isNri: boolean;
  share: string;
  shareDecimal: number;
  legalNote?: string;
  hasConsented: boolean;
  consentedAt?: string;
  hasObjected: boolean;
}

export interface SuccessionCase {
  caseId: string;
  dlpiId: string;
  familyId: string;
  deceasedName: string;
  dateOfDeath: string;
  deathCertCID: string;
  crsRegistrationNo: string;
  applicableLaw: string;
  heirs: SuccessionHeir[];
  totalHeirs: number;
  status: string;
  consentDeadline: string;
  aiConfidenceScore: number;
  legalEdgeCases?: string[];
  initiatedAt: string;
  updatedAt: string;
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

export interface Transfer {
  transferId: string;
  dlpiId: string;
  sellerAadhaarHash: string;
  buyerName: string;
  buyerAadhaarHash: string;
  declaredValueINR: number;
  oracleValueINR: number;
  stampDutyINR: number;
  status: string;
  fraudScore: number;
  nationalLockAcquired: boolean;
  lockExpiry?: string;
  consentSeller: boolean;
  consentBuyer: boolean;
  initiatedAt: string;
}

// ─── Tribal Guard ─────────────────────────────────────────────────────────────

export interface TribalCheckResult {
  dlpiId: string;
  attemptId?: string;
  isTribalParcel: boolean;
  scheduleType?: string;
  community?: string;
  decision: 'ALLOWED_NOT_TRIBAL' | 'ALLOWED_PENDING_APPROVALS' | 'HARD_REJECTED' | 'APPROVED';
  rejectionCode?: string;
  rejectionReason?: string;
  legalCitations?: string[];
  requiredApprovals?: string[];
  responseTimeMs: number;
}

// ─── WebSocket events ─────────────────────────────────────────────────────────

export interface WsMessage {
  event: string;
  payload: Record<string, unknown>;
  ts: string;
}

export type WsEventHandler = (msg: WsMessage) => void;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'citizen'
  | 'revenue_officer'
  | 'circle_officer'
  | 'sro'
  | 'collector'
  | 'nalsa'
  | 'bank'
  | 'oracle';

export interface AuthUser {
  token: string;
  role: UserRole;
  name: string;
  aadhaarHash?: string;
}
