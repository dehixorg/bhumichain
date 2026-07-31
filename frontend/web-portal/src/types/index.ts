// ─── Core domain types matching chaincode structs ─────────────────────────────

// Bihar land types (primary) + Maharashtra legacy
export type LandType =
  | 'Raiyati' | 'Gair Mazarua' | 'Asamiyadar' | 'Residential' | 'Commercial'
  | 'Govt_Reserved'
  | 'Bagayat' | 'Jirayat' | 'Kharaba' | 'Government' | 'Forest';

export type EncumbranceStatus = 'CLEAR' | 'MORTGAGED' | 'COURT_INJUNCTION' | 'IT_ATTACHMENT' | 'MULTIPLE';

// Bihar anchal codes (primary) + Maharashtra legacy
export type TehsilCode = 'PHU' | 'NDA' | 'JWR' | 'BSK' | 'SNN' | 'IGT' | 'NSK' | 'DIN' | 'NIK';

export interface ParcelOwner {
  name: string;
  aadhaarNumber: string;
  dob?: string;
}

export interface CoparcenaryHeir {
  name: string;
  aadhaarNumber: string;
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
  anchal: string;
  tehsilCode: TehsilCode;
  district: string;
  state: string;
  landType: LandType;
  landTypeDescription: string;
  areaHectares: number;
  rakbaBigha?: number;
  rakbaKatha?: number;
  rakbaDhur?: number;
  rakbaDecimal?: number;
  isCoparcenary: boolean;
  scheduleVArea: boolean;
  encumbranceStatus: EncumbranceStatus;
  claimStatus?: string;
  isTribal?: boolean;
  owner: ParcelOwner;
  owners?: ParcelOwner[];
  ownershipType?: string;
  coparcenary?: Coparcenary;
  location: ParcelLocation;
  valuation?: { circleRateINR: number; estimatedValueINR: number };
  activeLease?: { leaseId: string, tenantName: string, endDate: string };
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
  rakbaBigha?: number;
  rakbaKatha?: number;
  rakbaDhur?: number;
  rakbaDecimal?: number;
    encumbranceStatus: EncumbranceStatus;
    isCoparcenary: boolean;
    anchal: string;
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
  aadhaarNumber: string;
  aadhaar?: string;
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
  sellerAadhaarNumber: string;
  buyerName: string;
  buyerAadhaarNumber: string;
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
  aadhaarNumber?: string;
}
