"""
Satbara Utara (7/12) field schema.
Satbara is the primary land record document in Maharashtra.
It has two parts:
  - Part I  (7): Survey details, owner, area, land type
  - Part II (12): Encumbrances, loans, cultivation details
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class LandType(str, Enum):
    BAGAYAT = "Bagayat"
    JIRAYAT = "Jirayat"
    KHARABA = "Kharaba"
    TRIBAL_FRA = "Tribal_FRA"
    GOVERNMENT = "Government"
    FOREST = "Forest"


class SatbaraOwner(BaseModel):
    name: str
    fatherHusbandName: Optional[str] = None
    share: Optional[str] = None          # e.g. "1/3"
    ownershipType: str = "Individual"    # Individual | Joint | Coparcenary | Government


class SatbaraEncumbrance(BaseModel):
    type: str                            # Mortgage | Court_Order | IT_Demand
    creditorName: Optional[str] = None
    amount: Optional[int] = None
    date: Optional[str] = None
    remarks: Optional[str] = None


class SatbaraExtraction(BaseModel):
    """Structured output from RecordScan AI — mirrors DLPI fields."""

    # Part I (7) — Survey & Ownership
    districtName: str
    tehsilName: str
    villageName: str
    surveyNumber: str
    subdivisionNumber: Optional[str] = None
    localName: Optional[str] = None      # Gut number / plot name

    totalAreaHectares: float
    landType: LandType
    irrigationSource: Optional[str] = None  # Well | Canal | None

    owners: List[SatbaraOwner]
    hasJointOwnership: bool = False
    hasCoparcenary: bool = False

    # Part II (12) — Liabilities & Cultivation
    encumbrances: List[SatbaraEncumbrance] = []
    currentCultivator: Optional[str] = None
    cropDetails: Optional[str] = None
    possessionType: str = "Self"         # Self | Tenant | Mortgagee

    # Metadata
    surveyDate: Optional[str] = None
    registeredAt: Optional[str] = None   # Talathi office timestamp
    talathiSignature: Optional[str] = None

    # AI confidence
    ocrConfidence: float = Field(ge=0.0, le=1.0)
    nerConfidence: float = Field(ge=0.0, le=1.0)
    overallConfidence: float = Field(ge=0.0, le=1.0)
    flaggedFields: List[str] = []        # fields needing officer review
    requiresManualReview: bool = False


class ScanResult(BaseModel):
    """Full pipeline result returned to the frontend."""
    scanId: str
    fileName: str
    fileSizeKB: float
    ipfsCID: str                         # document stored on IPFS
    processingSteps: List[dict]          # pipeline trace for UI
    extraction: SatbaraExtraction
    suggestedDlpiId: str                 # pre-generated, officer confirms
    processingTimeMs: int
