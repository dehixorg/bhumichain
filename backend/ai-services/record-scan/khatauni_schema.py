"""
UP Khatauni (खतौनी) field schema — Uttar Pradesh land records.

Khatauni is the primary agricultural land record register in UP.
It lists all Khasra numbers (gata) under a Khata, with owner,
area, land type, and encumbrances.

Equivalent to Maharashtra Satbara (7/12) but different format/terminology.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class LandType(str, Enum):
    BHUMIDHARI   = "Bhumidhari"    # खातेदारी (hereditary full rights) — most common
    SIRDAR       = "Sirdar"        # सीर / सिरदार (hereditary limited rights)
    ASAMIYADAR   = "Asamiyadar"    # असामीदार (temporary tenant)
    RESIDENTIAL  = "Residential"   # आवासीय
    COMMERCIAL   = "Commercial"    # व्यावसायिक / औद्योगिक
    TRIBAL_FRA   = "Tribal_FRA"    # आदिवासी वन अधिकार (FRA patta)
    GOVT_RESERVED = "Govt_Reserved" # सरकारी / ग्रामसभा


class KhatedaOwner(BaseModel):
    """खातेदार — land owner entry in Khatauni."""
    name: str                           # नाम
    fatherHusbandName: Optional[str] = None  # पिता / पति का नाम
    share: Optional[str] = None         # हिस्सा (e.g. "1/2", "पूर्ण")
    ownershipType: str = "Individual"   # Individual | Joint | Coparcenary | Government
    isScheduledTribe: bool = False


class KhataEncumbrance(BaseModel):
    """Encumbrance / lien on the parcel."""
    type: str                            # Mortgage | Court_Order | IT_Demand | Bank_Lien
    creditorName: Optional[str] = None
    amount: Optional[int] = None
    date: Optional[str] = None
    remarks: Optional[str] = None


class KhatauniExtraction(BaseModel):
    """
    Structured output from RecordScan AI — fields extracted from UP Khatauni.
    Maps directly onto DLPI fields for Fabric chaincode.
    """

    # ── Header fields ─────────────────────────────────────────────────────────
    zila: str                            # जिला (district), e.g. "Gautam Buddha Nagar"
    tehsil: str                          # तहसील, e.g. "Dadri"
    gram: str                            # ग्राम (village)
    fasalVarsh: Optional[str] = None     # फसल वर्ष (crop year), e.g. "2025-26"

    # ── Parcel identifiers ────────────────────────────────────────────────────
    khataNo: str                         # खाता संख्या (Khata number)
    khasraNo: str                        # खसरा / गाटा संख्या

    # ── Area ──────────────────────────────────────────────────────────────────
    areaHectares: float                  # क्षेत्रफल (hectares)
    areaBigha: Optional[float] = None    # बीघा (1 bigha ≈ 0.2529 ha in UP)

    # ── Land type & use ───────────────────────────────────────────────────────
    landType: LandType                   # भूमि प्रकार
    irrigationSource: Optional[str] = None  # सिंचाई स्रोत (Well/Canal/Tubewell)
    cropDetails: Optional[str] = None   # फसल विवरण

    # ── Ownership ─────────────────────────────────────────────────────────────
    khatedars: List[KhatedaOwner]        # खातेदार (owners)
    hasJointOwnership: bool = False
    hasCoparcenary: bool = False
    currentPossessor: Optional[str] = None  # वास्तविक कृषक / आसामी

    # ── Encumbrances ──────────────────────────────────────────────────────────
    encumbrances: List[KhataEncumbrance] = []

    # ── Metadata ──────────────────────────────────────────────────────────────
    khatabandiDate: Optional[str] = None  # खतौनी तैयारी दिनांक
    lekhpalSignature: Optional[str] = None   # लेखपाल (village accountant)
    naibTehsildarSignature: Optional[str] = None

    # ── AI confidence ─────────────────────────────────────────────────────────
    ocrConfidence: float = Field(ge=0.0, le=1.0)
    nerConfidence: float = Field(ge=0.0, le=1.0)
    overallConfidence: float = Field(ge=0.0, le=1.0)
    flaggedFields: List[str] = []
    requiresManualReview: bool = False


class ScanResult(BaseModel):
    """Full pipeline result returned to the officer UI."""
    scanId: str
    fileName: str
    fileSizeKB: float
    ipfsCID: str
    processingSteps: List[dict]
    extraction: KhatauniExtraction
    suggestedDlpiId: str
    processingTimeMs: int
    storedInDynamoDB: bool = False
