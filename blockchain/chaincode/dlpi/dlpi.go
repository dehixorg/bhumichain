package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Core Data Structures ─────────────────────────────────────────────────────

// CoOwner represents one owner's stake in a parcel.
// A parcel can have 1-N owners, each with a defined share.
type CoOwner struct {
	AadhaarHash  string  `json:"aadhaarHash"`  // sha256(aadhaar+salt) — never raw
	Name         string  `json:"name"`         // display name (off-chain resolved)
	Share        string  `json:"share"`        // "1/3", "1/2", "2/5" etc.
	ShareDecimal float64 `json:"shareDecimal"` // 0.333... for computation
	OwnerSince   string  `json:"ownerSince"`
	IsVerified   bool    `json:"isVerified"`  // has the owner claimed & eSigned?
	VerifiedAt   string  `json:"verifiedAt,omitempty"`
	IsTribal     bool    `json:"isTribal"`
	TribeId      string  `json:"tribeId,omitempty"`
}

type DLPI struct {
	DLPIId              string        `json:"dlpiId"`
	SurveyNumber        string        `json:"surveyNumber"`
	KhasraNo            string        `json:"khasraNo,omitempty"` // UP-specific
	Tehsil              string        `json:"tehsil"`
	TehsilCode          string        `json:"tehsilCode"`
	District            string        `json:"district"`
	State               string        `json:"state"`
	LandType            string        `json:"landType"`
	LandTypeDescription string        `json:"landTypeDescription"`
	AreaHectares        float64       `json:"areaHectares"`
	IsTribal            bool          `json:"isTribal"`
	ScheduleVArea       bool          `json:"scheduleVArea"`

	// Multi-owner: replaces old single Owner struct
	// Every parcel has at least 1 owner. After succession, has N owners.
	Owners        []CoOwner `json:"owners"`
	OwnershipType string    `json:"ownershipType"` // SOLE | JOINT | COPARCENARY

	// Claim status — separate from ownership
	ClaimStatus string `json:"claimStatus"` // SEEDED_UNVERIFIED | OWNER_VERIFIED | DATA_DISPUTED

	// Encumbrance and locks
	EncumbranceStatus string        `json:"encumbranceStatus"` // CLEAR | MORTGAGED | COURT_INJUNCTION | IT_ATTACHMENT | DISPUTED
	TransferLock      *TransferLock `json:"transferLock"`

	// Succession
	SuccessionStatus  string       `json:"successionStatus"` // ACTIVE | SUCCESSION_PENDING | SUCCESSION_COMPLETE
	CoparcenaryMeta   *CoparcenaryMeta `json:"coparcenaryMeta,omitempty"` // law metadata only

	// Tribal
	TribalProtection *TribalProt `json:"tribalProtection,omitempty"`

	// Spatial
	Location  Location  `json:"location"`
	Valuation Valuation `json:"valuation"`

	// Audit
	MutationHistory    []MutationEntry `json:"mutationHistory"`
	IPFSCID            string          `json:"ipfsCID"`
	SourceType         string          `json:"sourceType"` // DILRMP_MIGRATION | RECORD_SCAN | SVAMITVA | MANUAL
	JangananaAnomalies []JangananaFlag `json:"jangananaAnomalies,omitempty"`
	CreatedAt          string          `json:"createdAt"`
	UpdatedAt          string          `json:"updatedAt"`
	TxHash             string          `json:"txHash"`
}

// CoparcenaryMeta holds legal metadata about a coparcenary — NOT the owners themselves.
// After succession, heirs are in Owners[]. This struct just carries law context.
type CoparcenaryMeta struct {
	ApplicableLaw    string `json:"applicableLaw"`    // "HSA 1956/2005" | "Muslim Personal Law" etc.
	CoparcenaryType  string `json:"coparcenaryType"`  // "Mitakshara" | "Dayabhaga"
	FamilyId         string `json:"familyId"`
	CRSCertificateNo string `json:"crsCertificateNo"` // death cert reference
	SuccessionCaseId string `json:"successionCaseId"`
}

// Heir is used during succession workflow only — converted to CoOwner after all consent
type Heir struct {
	MemberId      string  `json:"memberId"`
	Name          string  `json:"name"`
	AadhaarHash   string  `json:"aadhaarHash"`
	Relation      string  `json:"relation"`
	Share         string  `json:"share"`
	ShareDecimal  float64 `json:"shareDecimal"`
	HasConsented  bool    `json:"hasConsented"`
	ConsentTxHash string  `json:"consentTxHash,omitempty"`
	LegalNote     string  `json:"legalNote,omitempty"` // e.g. "HSA 2005 S.6(3) — daughter's equal right"
	IsTribal      bool    `json:"isTribal"`
}

// PendingSuccession tracks in-progress succession before all heirs consent
type PendingSuccession struct {
	SuccessionCaseId string `json:"successionCaseId"`
	Heirs            []Heir `json:"heirs"`
	InitiatedAt      string `json:"initiatedAt"`
}

type TribalProt struct {
	ScheduleType     string   `json:"scheduleType"`
	FRAPatteNumber   string   `json:"fraPatteNumber"`
	GramSabhaVillage string   `json:"gramSabhaVillage"`
	GramSabhaId      string   `json:"gramSabhaId"`
	ProtectionActs   []string `json:"protectionActs"`
}

type Location struct {
	Latitude  float64     `json:"latitude"`
	Longitude float64     `json:"longitude"`
	Polygon   interface{} `json:"boundaryPolygon"`
}

type Valuation struct {
	CircleRateINR     int64  `json:"circleRateINR"`
	OracleEstimateINR int64  `json:"oracleEstimateINR,omitempty"`
	LastAssessedDate  string `json:"lastAssessedDate"`
}

type MutationEntry struct {
	MutationType string `json:"type"`
	Date         string `json:"date"`
	OfficerName  string `json:"officerName"`
	OfficerHash  string `json:"officerAadhaarHash"`
	MutationNo   string `json:"mutationNo"`
	TxHash       string `json:"txHash"`
	IPFSCID      string `json:"ipfsCID"`
	Description  string `json:"description"`
}

type TransferLock struct {
	IsLocked    bool   `json:"isLocked"`
	LockedAt    string `json:"lockedAt"`
	LockedBy    string `json:"lockedByTx"`
	ExpiresAt   string `json:"expiresAt"`
	LockChannel string `json:"lockChannel"`
}

type JangananaFlag struct {
	HouseholdId  string `json:"householdId"`
	AnomalyType  string `json:"anomalyType"`
	DetectedAt   string `json:"detectedAt"`
	Severity     string `json:"severity"`
	ReviewStatus string `json:"reviewStatus"`
}

// CreateDLPIInput is the JSON payload for genesis creation
type CreateDLPIInput struct {
	DLPIId              string      `json:"dlpiId"`
	SurveyNumber        string      `json:"surveyNumber"`
	KhasraNo            string      `json:"khasraNo"`
	Tehsil              string      `json:"tehsil"`
	TehsilCode          string      `json:"tehsilCode"`
	District            string      `json:"district"`
	State               string      `json:"state"`
	LandType            string      `json:"landType"`
	LandTypeDescription string      `json:"landTypeDescription"`
	AreaHectares        float64     `json:"areaHectares"`
	IsTribal            bool        `json:"isTribal"`
	ScheduleVArea       bool        `json:"scheduleVArea"`
	// First owner — can be one person or multiple joint owners
	InitialOwners []CoOwner   `json:"initialOwners"`
	OwnershipType string      `json:"ownershipType"` // SOLE | JOINT
	Latitude      float64     `json:"latitude"`
	Longitude     float64     `json:"longitude"`
	PolygonJSON   interface{} `json:"boundaryPolygon"`
	CircleRateINR int64       `json:"circleRateINR"`
	IPFSCID       string      `json:"ipfsCID"`
	SourceType    string      `json:"sourceType"`
}

// ─── Smart Contract ───────────────────────────────────────────────────────────

type DLPIContract struct {
	contractapi.Contract
}

// CreateDLPI — genesis: Patwari creates a new DLPI record
// Endorsement: AND(Revenue-HQ.member)  (Tehsildar final approve via API layer)
func (c *DLPIContract) CreateDLPI(ctx contractapi.TransactionContextInterface, inputJSON string) error {
	var input CreateDLPIInput
	if err := json.Unmarshal([]byte(inputJSON), &input); err != nil {
		return fmt.Errorf("invalid input JSON: %w", err)
	}

	if input.DLPIId == "" || input.SurveyNumber == "" {
		return fmt.Errorf("dlpiId and surveyNumber are required")
	}
	if len(input.InitialOwners) == 0 {
		return fmt.Errorf("at least one initial owner required")
	}

	existing, _ := ctx.GetStub().GetState(input.DLPIId)
	if existing != nil {
		return fmt.Errorf("DLPI %s already exists — duplicate genesis rejected", input.DLPIId)
	}

	validLandTypes := map[string]bool{
		"Jirayat": true, "Bagayat": true, "Abaadi": true, "Residential": true,
		"Commercial": true, "Industrial": true, "Tribal_FRA": true, "Govt_Reserved": true,
	}
	if !validLandTypes[input.LandType] {
		return fmt.Errorf("invalid land type: %s", input.LandType)
	}
	if input.LandType == "Tribal_FRA" {
		input.IsTribal = true
		input.ScheduleVArea = true
	}

	// Validate share fractions sum to 1
	if err := validateShares(input.InitialOwners); err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	txID := ctx.GetStub().GetTxID()

	ownershipType := input.OwnershipType
	if ownershipType == "" {
		if len(input.InitialOwners) == 1 {
			ownershipType = "SOLE"
		} else {
			ownershipType = "JOINT"
		}
	}

	dlpi := DLPI{
		DLPIId:              input.DLPIId,
		SurveyNumber:        input.SurveyNumber,
		KhasraNo:            input.KhasraNo,
		Tehsil:              input.Tehsil,
		TehsilCode:          input.TehsilCode,
		District:            input.District,
		State:               input.State,
		LandType:            input.LandType,
		LandTypeDescription: input.LandTypeDescription,
		AreaHectares:        input.AreaHectares,
		IsTribal:            input.IsTribal,
		ScheduleVArea:       input.ScheduleVArea,
		Owners:              input.InitialOwners,
		OwnershipType:       ownershipType,
		ClaimStatus:         "SEEDED_UNVERIFIED",
		EncumbranceStatus:   "CLEAR",
		TransferLock:        &TransferLock{IsLocked: false},
		SuccessionStatus:    "ACTIVE",
		Location: Location{
			Latitude:  input.Latitude,
			Longitude: input.Longitude,
			Polygon:   input.PolygonJSON,
		},
		Valuation: Valuation{
			CircleRateINR:    input.CircleRateINR,
			LastAssessedDate: now[:10],
		},
		MutationHistory: []MutationEntry{},
		IPFSCID:         input.IPFSCID,
		SourceType:      input.SourceType,
		CreatedAt:       now,
		UpdatedAt:       now,
		TxHash:          txID,
	}

	dlpiBytes, err := json.Marshal(dlpi)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	if err := ctx.GetStub().PutState(input.DLPIId, dlpiBytes); err != nil {
		return fmt.Errorf("state write error: %w", err)
	}
	_ = ctx.GetStub().SetEvent("DLPICreated", dlpiBytes)
	return nil
}

// ClaimDLPI — owner verifies and claims a seeded record via Aadhaar eSign
func (c *DLPIContract) ClaimDLPI(ctx contractapi.TransactionContextInterface,
	dlpiId, ownerAadhaarHash, eSignTxHash string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}
	if dlpi.ClaimStatus == "OWNER_VERIFIED" {
		return fmt.Errorf("DLPI %s is already verified", dlpiId)
	}

	found := false
	now := time.Now().UTC().Format(time.RFC3339)
	for i, o := range dlpi.Owners {
		if o.AadhaarHash == ownerAadhaarHash {
			dlpi.Owners[i].IsVerified = true
			dlpi.Owners[i].VerifiedAt = now
			found = true
		}
	}
	if !found {
		return fmt.Errorf("aadhaar hash not found among owners of DLPI %s", dlpiId)
	}

	// Mark verified only when ALL owners have verified
	allVerified := true
	for _, o := range dlpi.Owners {
		if !o.IsVerified {
			allVerified = false
			break
		}
	}
	if allVerified {
		dlpi.ClaimStatus = "OWNER_VERIFIED"
	}
	dlpi.UpdatedAt = now

	event, _ := json.Marshal(map[string]string{
		"dlpiId": dlpiId, "ownerHash": ownerAadhaarHash, "status": dlpi.ClaimStatus,
	})
	_ = ctx.GetStub().SetEvent("DLPIClaimed", event)
	return c.saveDLPI(ctx, dlpi)
}

// DisputeDLPI — owner disputes the seeded data
func (c *DLPIContract) DisputeDLPI(ctx contractapi.TransactionContextInterface,
	dlpiId, ownerAadhaarHash, reason string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}
	found := false
	for _, o := range dlpi.Owners {
		if o.AadhaarHash == ownerAadhaarHash {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("only a registered owner can dispute this record")
	}
	dlpi.ClaimStatus = "DATA_DISPUTED"
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveDLPI(ctx, dlpi)
}

// GetDLPI — retrieve DLPI by ID
func (c *DLPIContract) GetDLPI(ctx contractapi.TransactionContextInterface, dlpiId string) (*DLPI, error) {
	data, err := ctx.GetStub().GetState(dlpiId)
	if err != nil {
		return nil, fmt.Errorf("state read error: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("DLPI %s not found", dlpiId)
	}
	var dlpi DLPI
	if err := json.Unmarshal(data, &dlpi); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &dlpi, nil
}

// GetDLPIHistory — full audit trail from blockchain ledger
func (c *DLPIContract) GetDLPIHistory(ctx contractapi.TransactionContextInterface, dlpiId string) (string, error) {
	iter, err := ctx.GetStub().GetHistoryForKey(dlpiId)
	if err != nil {
		return "", err
	}
	defer iter.Close()

	type HistoryEntry struct {
		TxID      string      `json:"txId"`
		Timestamp string      `json:"timestamp"`
		IsDelete  bool        `json:"isDelete"`
		Value     interface{} `json:"value"`
	}

	var history []HistoryEntry
	for iter.HasNext() {
		h, err := iter.Next()
		if err != nil {
			return "", err
		}
		entry := HistoryEntry{
			TxID:      h.TxId,
			Timestamp: time.Unix(h.Timestamp.Seconds, 0).UTC().Format(time.RFC3339),
			IsDelete:  h.IsDelete,
		}
		if !h.IsDelete {
			var v interface{}
			_ = json.Unmarshal(h.Value, &v)
			entry.Value = v
		}
		history = append(history, entry)
	}

	out, _ := json.Marshal(history)
	return string(out), nil
}

// SetTransferLock — 24-hour national parcel lock when transfer initiated
// Called cross-chaincode by PropertyTransfer
func (c *DLPIContract) SetTransferLock(ctx contractapi.TransactionContextInterface,
	dlpiId, lockingTxId string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}
	if dlpi.TransferLock != nil && dlpi.TransferLock.IsLocked {
		return fmt.Errorf("PARCEL_LOCKED: %s already locked by %s, expires %s",
			dlpiId, dlpi.TransferLock.LockedBy, dlpi.TransferLock.ExpiresAt)
	}
	if dlpi.EncumbranceStatus != "CLEAR" {
		return fmt.Errorf("TRANSFER_BLOCKED: encumbrance = %s", dlpi.EncumbranceStatus)
	}
	if dlpi.SuccessionStatus == "SUCCESSION_PENDING" {
		return fmt.Errorf("TRANSFER_BLOCKED: succession pending — resolve first")
	}

	now := time.Now().UTC()
	dlpi.TransferLock = &TransferLock{
		IsLocked:    true,
		LockedAt:    now.Format(time.RFC3339),
		LockedBy:    lockingTxId,
		ExpiresAt:   now.Add(24 * time.Hour).Format(time.RFC3339),
		LockChannel: "national-channel",
	}
	dlpi.UpdatedAt = now.Format(time.RFC3339)

	event, _ := json.Marshal(map[string]string{
		"dlpiId": dlpiId, "lockedBy": lockingTxId, "expiresAt": dlpi.TransferLock.ExpiresAt,
	})
	_ = ctx.GetStub().SetEvent("ParcelLocked", event)
	return c.saveDLPI(ctx, dlpi)
}

// ReleaseTransferLock — removes lock after transfer completes or is rejected
func (c *DLPIContract) ReleaseTransferLock(ctx contractapi.TransactionContextInterface, dlpiId string) error {
	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}
	dlpi.TransferLock = &TransferLock{IsLocked: false}
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveDLPI(ctx, dlpi)
}

// UpdateOwners — called by PropertyTransfer after ExecuteTransfer
// Atomically removes selling owners and adds buying owners
func (c *DLPIContract) UpdateOwners(ctx contractapi.TransactionContextInterface,
	dlpiId string,
	sellerHashesJSON string, // []string of aadhaarHashes to remove
	newBuyersJSON string,    // []CoOwner to add
	mutationType, officerName, officerHash, mutationNo, ipfsCID, description string,
) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	var sellerHashes []string
	if err := json.Unmarshal([]byte(sellerHashesJSON), &sellerHashes); err != nil {
		return fmt.Errorf("invalid sellerHashes JSON: %w", err)
	}
	var newBuyers []CoOwner
	if err := json.Unmarshal([]byte(newBuyersJSON), &newBuyers); err != nil {
		return fmt.Errorf("invalid newBuyers JSON: %w", err)
	}

	// Build set of hashes to remove
	removeSet := make(map[string]bool)
	for _, h := range sellerHashes {
		removeSet[h] = true
	}

	// Keep all owners NOT in the remove set
	remaining := []CoOwner{}
	for _, o := range dlpi.Owners {
		if !removeSet[o.AadhaarHash] {
			remaining = append(remaining, o)
		}
	}

	// Add new buyers (already verified at transfer time)
	now := time.Now().UTC().Format(time.RFC3339)
	for i := range newBuyers {
		newBuyers[i].OwnerSince = now
		newBuyers[i].IsVerified = true
		newBuyers[i].VerifiedAt = now
		remaining = append(remaining, newBuyers[i])
	}

	// Validate final shares still sum to ~1
	if err := validateShares(remaining); err != nil {
		return fmt.Errorf("owner update would produce invalid shares: %w", err)
	}

	// Update ownership type
	if len(remaining) == 1 {
		dlpi.OwnershipType = "SOLE"
	} else {
		dlpi.OwnershipType = "JOINT"
	}

	dlpi.Owners = remaining
	dlpi.ClaimStatus = "OWNER_VERIFIED"
	dlpi.TransferLock = &TransferLock{IsLocked: false}
	dlpi.UpdatedAt = now

	txID := ctx.GetStub().GetTxID()
	dlpi.MutationHistory = append(dlpi.MutationHistory, MutationEntry{
		MutationType: mutationType,
		Date:         now[:10],
		OfficerName:  officerName,
		OfficerHash:  officerHash,
		MutationNo:   mutationNo,
		TxHash:       txID,
		IPFSCID:      ipfsCID,
		Description:  description,
	})

	event, _ := json.Marshal(map[string]interface{}{
		"dlpiId":      dlpiId,
		"mutationNo":  mutationNo,
		"newOwners":   remaining,
		"mutationType": mutationType,
		"txHash":      txID,
	})
	_ = ctx.GetStub().SetEvent("MutationCompleted", event)

	return c.saveDLPI(ctx, dlpi)
}

// InitiateSuccession — marks parcel SUCCESSION_PENDING and records heirs from CoparcenaryMapper
func (c *DLPIContract) InitiateSuccession(ctx contractapi.TransactionContextInterface,
	dlpiId, successionCaseId, crsNo, deathCertIPFS, heirsJSON string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	var heirs []Heir
	if err := json.Unmarshal([]byte(heirsJSON), &heirs); err != nil {
		return fmt.Errorf("invalid heirs JSON: %w", err)
	}
	if len(heirs) == 0 {
		return fmt.Errorf("at least one heir required")
	}

	// HSA 2005 audit: log if daughters present
	for _, h := range heirs {
		if h.Relation == "Daughter" && h.LegalNote == "" {
			// Force legal note for daughters — cannot silently omit
			return fmt.Errorf("daughter heir %s must have legalNote citing HSA 2005 S.6(3)", h.Name)
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	dlpi.SuccessionStatus = "SUCCESSION_PENDING"
	dlpi.OwnershipType = "COPARCENARY"

	// Store pending succession separately — owners[] NOT changed yet, only after all consent
	pendingKey := "PENDING_SUCCESSION_" + dlpiId
	pending := PendingSuccession{
		SuccessionCaseId: successionCaseId,
		Heirs:            heirs,
		InitiatedAt:      now,
	}
	pendingBytes, _ := json.Marshal(pending)
	if err := ctx.GetStub().PutState(pendingKey, pendingBytes); err != nil {
		return err
	}

	dlpi.CoparcenaryMeta = &CoparcenaryMeta{
		ApplicableLaw:    "Hindu Succession Act 1956/2005",
		CoparcenaryType:  "Mitakshara",
		CRSCertificateNo: crsNo,
		SuccessionCaseId: successionCaseId,
	}
	dlpi.UpdatedAt = now

	event, _ := json.Marshal(map[string]interface{}{
		"dlpiId": dlpiId, "caseId": successionCaseId, "heirs": heirs,
	})
	_ = ctx.GetStub().SetEvent("SuccessionInitiated", event)

	return c.saveDLPI(ctx, dlpi)
}

// RecordHeirConsent — individual heir's Aadhaar eSign consent
func (c *DLPIContract) RecordHeirConsent(ctx contractapi.TransactionContextInterface,
	dlpiId, heirAadhaarHash, consentTxHash string) error {

	pendingKey := "PENDING_SUCCESSION_" + dlpiId
	pendingBytes, err := ctx.GetStub().GetState(pendingKey)
	if err != nil || pendingBytes == nil {
		return fmt.Errorf("no pending succession found for DLPI %s", dlpiId)
	}
	var pending PendingSuccession
	if err := json.Unmarshal(pendingBytes, &pending); err != nil {
		return err
	}

	found := false
	for i, h := range pending.Heirs {
		if h.AadhaarHash == heirAadhaarHash {
			pending.Heirs[i].HasConsented = true
			pending.Heirs[i].ConsentTxHash = consentTxHash
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("heir not found in pending succession for DLPI %s", dlpiId)
	}

	// Check if all heirs have consented
	allConsented := true
	for _, h := range pending.Heirs {
		if !h.HasConsented {
			allConsented = false
			break
		}
	}

	// Save updated pending succession
	pendingBytes, _ = json.Marshal(pending)
	if err := ctx.GetStub().PutState(pendingKey, pendingBytes); err != nil {
		return err
	}

	if allConsented {
		return c.completeMutation(ctx, dlpiId, pending)
	}

	event, _ := json.Marshal(map[string]string{
		"dlpiId": dlpiId, "heirHash": heirAadhaarHash, "allConsented": "false",
	})
	_ = ctx.GetStub().SetEvent("HeirConsentRecorded", event)
	return nil
}

// completeMutation — called when all heirs consent. Converts heirs → Owners[].
func (c *DLPIContract) completeMutation(ctx contractapi.TransactionContextInterface,
	dlpiId string, pending PendingSuccession) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	txID := ctx.GetStub().GetTxID()

	// Convert heirs → CoOwner entries
	newOwners := make([]CoOwner, len(pending.Heirs))
	for i, h := range pending.Heirs {
		newOwners[i] = CoOwner{
			AadhaarHash:  h.AadhaarHash,
			Name:         h.Name,
			Share:        h.Share,
			ShareDecimal: h.ShareDecimal,
			OwnerSince:   now,
			IsVerified:   true,
			VerifiedAt:   now,
			IsTribal:     h.IsTribal,
		}
	}

	dlpi.Owners = newOwners
	dlpi.OwnershipType = "COPARCENARY"
	dlpi.SuccessionStatus = "SUCCESSION_COMPLETE"
	dlpi.ClaimStatus = "OWNER_VERIFIED"
	dlpi.UpdatedAt = now

	mutationNo := fmt.Sprintf("MUT/%d/%s", time.Now().Year(), txID[:6])
	dlpi.MutationHistory = append(dlpi.MutationHistory, MutationEntry{
		MutationType: "Succession",
		Date:         now[:10],
		OfficerName:  "Uttaradhikar Engine (Auto)",
		OfficerHash:  "system",
		MutationNo:   mutationNo,
		TxHash:       txID,
		Description:  fmt.Sprintf("Succession complete. %d heirs now co-owners.", len(newOwners)),
	})

	// Clean up pending succession state
	_ = ctx.GetStub().DelState("PENDING_SUCCESSION_" + dlpiId)

	event, _ := json.Marshal(map[string]interface{}{
		"dlpiId": dlpiId, "newOwners": newOwners, "mutationNo": mutationNo,
	})
	_ = ctx.GetStub().SetEvent("SuccessionCompleted", event)

	return c.saveDLPI(ctx, dlpi)
}

// SetEncumbrance — records mortgage, court order, or IT attachment
func (c *DLPIContract) SetEncumbrance(ctx contractapi.TransactionContextInterface,
	dlpiId, encumbranceType, note string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}
	valid := map[string]bool{
		"MORTGAGED": true, "COURT_INJUNCTION": true,
		"IT_ATTACHMENT": true, "DISPUTED": true,
	}
	if !valid[encumbranceType] {
		return fmt.Errorf("invalid encumbrance type: %s", encumbranceType)
	}
	dlpi.EncumbranceStatus = encumbranceType
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveDLPI(ctx, dlpi)
}

// ClearEncumbrance — removes encumbrance (bank releases mortgage, court lifts injunction)
func (c *DLPIContract) ClearEncumbrance(ctx contractapi.TransactionContextInterface,
	dlpiId, authOfficerHash string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}
	dlpi.EncumbranceStatus = "CLEAR"
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveDLPI(ctx, dlpi)
}

// AddJangananaFlag — census anomaly flag from oracle
func (c *DLPIContract) AddJangananaFlag(ctx contractapi.TransactionContextInterface,
	dlpiId, householdId, anomalyType, severity string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}
	dlpi.JangananaAnomalies = append(dlpi.JangananaAnomalies, JangananaFlag{
		HouseholdId:  householdId,
		AnomalyType:  anomalyType,
		DetectedAt:   time.Now().UTC().Format(time.RFC3339),
		Severity:     severity,
		ReviewStatus: "PENDING",
	})
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveDLPI(ctx, dlpi)
}

// QueryDLPIsByOwner — find all parcels owned by a given aadhaarHash (CouchDB)
func (c *DLPIContract) QueryDLPIsByOwner(ctx contractapi.TransactionContextInterface,
	ownerAadhaarHash string) ([]*DLPI, error) {

	// CouchDB query: parcels where owners array contains this hash
	query := fmt.Sprintf(
		`{"selector":{"owners":{"$elemMatch":{"aadhaarHash":"%s"}}}}`,
		ownerAadhaarHash,
	)
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var results []*DLPI
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var d DLPI
		if err := json.Unmarshal(r.Value, &d); err != nil {
			return nil, err
		}
		results = append(results, &d)
	}
	return results, nil
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

func (c *DLPIContract) saveDLPI(ctx contractapi.TransactionContextInterface, dlpi *DLPI) error {
	data, err := json.Marshal(dlpi)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return ctx.GetStub().PutState(dlpi.DLPIId, data)
}

// validateShares: all shares must sum to exactly 1.0 (within floating point tolerance)
func validateShares(owners []CoOwner) error {
	if len(owners) == 0 {
		return fmt.Errorf("owners list cannot be empty")
	}
	var total float64
	for _, o := range owners {
		if o.ShareDecimal <= 0 || o.ShareDecimal > 1 {
			return fmt.Errorf("owner %s has invalid shareDecimal: %f", o.AadhaarHash, o.ShareDecimal)
		}
		total += o.ShareDecimal
	}
	if total < 0.999 || total > 1.001 {
		return fmt.Errorf("owner shares sum to %f — must sum to 1.0", total)
	}
	return nil
}

func main() {
	cc, err := contractapi.NewChaincode(&DLPIContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating DLPI chaincode: %v", err))
	}
	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("Error starting DLPI chaincode: %v", err))
	}
}
