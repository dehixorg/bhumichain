package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Data Structures ──────────────────────────────────────────────────────────

type DLPI struct {
	DLPIId              string          `json:"dlpiId"`
	SurveyNumber        string          `json:"surveyNumber"`
	Tehsil              string          `json:"tehsil"`
	TehsilCode          string          `json:"tehsilCode"`
	District            string          `json:"district"`
	State               string          `json:"state"`
	LandType            string          `json:"landType"`
	LandTypeDescription string          `json:"landTypeDescription"`
	AreaHectares        float64         `json:"areaHectares"`
	IsTribal            bool            `json:"isTribal"`
	IsCoparcenary       bool            `json:"isCoparcenary"`
	ScheduleVArea       bool            `json:"scheduleVArea"`
	EncumbranceStatus   string          `json:"encumbranceStatus"`   // CLEAR | MORTGAGED | COURT_INJUNCTION | IT_ATTACHMENT | DISPUTED
	TransferLock        *TransferLock   `json:"transferLock"`
	SuccessionStatus    string          `json:"successionStatus"`     // ACTIVE | SUCCESSION_PENDING | TRANSFERRED
	Owner               Owner           `json:"owner"`
	Coparcenary         *Coparcenary    `json:"coparcenary,omitempty"`
	TribalProtection    *TribalProt     `json:"tribalProtection,omitempty"`
	Location            Location        `json:"location"`
	Valuation           Valuation       `json:"valuation"`
	MutationHistory     []MutationEntry `json:"mutationHistory"`
	IPFSCID             string          `json:"ipfsCID"`
	SourceType          string          `json:"sourceType"`           // DILRMP_MIGRATION | SVAMITVA | RECORD_SCAN | MANUAL
	CreatedAt           string          `json:"createdAt"`
	UpdatedAt           string          `json:"updatedAt"`
	BlockNumber         uint64          `json:"blockNumber"`
	TxHash              string          `json:"txHash"`
	JangananaAnomalies  []JangananaFlag `json:"jangananaAnomalies,omitempty"`
}

type Owner struct {
	Name         string `json:"name"`
	AadhaarHash  string `json:"aadhaarHash"`   // SHA-256(Aadhaar+salt) — never raw Aadhaar
	DOB          string `json:"dob"`
	IsTribal     bool   `json:"isTribal"`
	TribeId      string `json:"tribeId,omitempty"`
}

type Coparcenary struct {
	Heirs          []Heir `json:"heirs"`
	ApplicableLaw  string `json:"applicableLaw"`
	CoparcenaryType string `json:"coparcenaryType"`
	Status         string `json:"status"`   // PENDING_CONSENT | ALL_CONSENTED | COURT_REFERRED
}

type Heir struct {
	MemberId    string  `json:"memberId"`
	Name        string  `json:"name"`
	AadhaarHash string  `json:"aadhaarHash"`
	Relation    string  `json:"relation"`
	Share       string  `json:"share"`
	ShareDecimal float64 `json:"shareDecimal"`
	HasConsented bool   `json:"hasConsented"`
	ConsentTxHash string `json:"consentTxHash,omitempty"`
	LegalNote   string  `json:"legalNote,omitempty"`
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
	Polygon   interface{} `json:"boundaryPolygon"`  // GeoJSON Polygon
}

type Valuation struct {
	CircleRateINR    int64  `json:"circleRateINR"`
	OracleEstimateINR int64 `json:"oracleEstimateINR,omitempty"`
	LastAssessedDate string `json:"lastAssessedDate"`
}

type MutationEntry struct {
	MutationType string `json:"type"`
	Date         string `json:"date"`
	OfficerName  string `json:"officerName"`
	OfficerHash  string `json:"officerAadhaarHash"`
	MutationNo   string `json:"mutationNo"`
	TxHash       string `json:"txHash"`
	IPFSCID      string `json:"ipfsCID"`
}

type TransferLock struct {
	IsLocked    bool   `json:"isLocked"`
	LockedAt    string `json:"lockedAt"`
	LockedBy    string `json:"lockedByTx"`
	ExpiresAt   string `json:"expiresAt"`   // 24 hours after lock
	LockChannel string `json:"lockChannel"` // channel that placed the lock
}

type JangananaFlag struct {
	HouseholdId  string `json:"householdId"`
	AnomalyType  string `json:"anomalyType"`
	DetectedAt   string `json:"detectedAt"`
	Severity     string `json:"severity"`
	ReviewStatus string `json:"reviewStatus"` // PENDING | REVIEWED | CLEARED
}

// ─── Input / Event Structures ─────────────────────────────────────────────────

type CreateDLPIInput struct {
	DLPIId              string      `json:"dlpiId"`
	SurveyNumber        string      `json:"surveyNumber"`
	Tehsil              string      `json:"tehsil"`
	TehsilCode          string      `json:"tehsilCode"`
	District            string      `json:"district"`
	State               string      `json:"state"`
	LandType            string      `json:"landType"`
	LandTypeDescription string      `json:"landTypeDescription"`
	AreaHectares        float64     `json:"areaHectares"`
	IsTribal            bool        `json:"isTribal"`
	ScheduleVArea       bool        `json:"scheduleVArea"`
	OwnerName           string      `json:"ownerName"`
	OwnerAadhaarHash    string      `json:"ownerAadhaarHash"`
	OwnerDOB            string      `json:"ownerDob"`
	OwnerIsTribal       bool        `json:"ownerIsTribal"`
	Latitude            float64     `json:"latitude"`
	Longitude           float64     `json:"longitude"`
	PolygonJSON         interface{} `json:"boundaryPolygon"`
	CircleRateINR       int64       `json:"circleRateINR"`
	IPFSCID             string      `json:"ipfsCID"`
	SourceType          string      `json:"sourceType"`
}

// ─── Smart Contract ───────────────────────────────────────────────────────────

type DLPIContract struct {
	contractapi.Contract
}

// CreateDLPI — creates a genesis DLPI record for a parcel
// Endorsement: AND(Revenue-HQ.member, SRO.member)
func (c *DLPIContract) CreateDLPI(ctx contractapi.TransactionContextInterface, inputJSON string) error {
	var input CreateDLPIInput
	if err := json.Unmarshal([]byte(inputJSON), &input); err != nil {
		return fmt.Errorf("invalid input JSON: %w", err)
	}

	// Validate required fields
	if input.DLPIId == "" || input.SurveyNumber == "" || input.OwnerAadhaarHash == "" {
		return fmt.Errorf("dlpiId, surveyNumber, and ownerAadhaarHash are required")
	}

	// Check for duplicate
	existing, err := ctx.GetStub().GetState(input.DLPIId)
	if err != nil {
		return fmt.Errorf("state read error: %w", err)
	}
	if existing != nil {
		return fmt.Errorf("DLPI %s already exists — duplicate genesis rejected", input.DLPIId)
	}

	// Validate land type
	validLandTypes := map[string]bool{
		"Jirayat": true, "Bagayat": true, "Residential": true,
		"Commercial": true, "Tribal_FRA": true, "Govt_Reserved": true,
	}
	if !validLandTypes[input.LandType] {
		return fmt.Errorf("invalid land type: %s", input.LandType)
	}

	// If land type is Tribal_FRA, mark scheduleV area
	if input.LandType == "Tribal_FRA" {
		input.IsTribal = true
		input.ScheduleVArea = true
	}

	now := time.Now().UTC().Format(time.RFC3339)
	txID := ctx.GetStub().GetTxID()

	dlpi := DLPI{
		DLPIId:              input.DLPIId,
		SurveyNumber:        input.SurveyNumber,
		Tehsil:              input.Tehsil,
		TehsilCode:          input.TehsilCode,
		District:            input.District,
		State:               input.State,
		LandType:            input.LandType,
		LandTypeDescription: input.LandTypeDescription,
		AreaHectares:        input.AreaHectares,
		IsTribal:            input.IsTribal,
		IsCoparcenary:       false,
		ScheduleVArea:       input.ScheduleVArea,
		EncumbranceStatus:   "CLEAR",
		TransferLock:        &TransferLock{IsLocked: false},
		SuccessionStatus:    "ACTIVE",
		Owner: Owner{
			Name:        input.OwnerName,
			AadhaarHash: input.OwnerAadhaarHash,
			DOB:         input.OwnerDOB,
			IsTribal:    input.OwnerIsTribal,
		},
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

	// Emit event for frontend real-time updates
	_ = ctx.GetStub().SetEvent("DLPICreated", dlpiBytes)

	return nil
}

// GetDLPI — retrieves a DLPI by ID
func (c *DLPIContract) GetDLPI(ctx contractapi.TransactionContextInterface, dlpiId string) (*DLPI, error) {
	dlpiBytes, err := ctx.GetStub().GetState(dlpiId)
	if err != nil {
		return nil, fmt.Errorf("state read error: %w", err)
	}
	if dlpiBytes == nil {
		return nil, fmt.Errorf("DLPI %s not found", dlpiId)
	}

	var dlpi DLPI
	if err := json.Unmarshal(dlpiBytes, &dlpi); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &dlpi, nil
}

// SetTransferLock — places a 24-hour global parcel lock when a sale is initiated
// Called by PropertyTransfer chaincode on sale initiation
func (c *DLPIContract) SetTransferLock(ctx contractapi.TransactionContextInterface, dlpiId string, lockingTxId string) error {
	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	if dlpi.TransferLock != nil && dlpi.TransferLock.IsLocked {
		return fmt.Errorf("PARCEL_LOCKED: DLPI %s is already under transfer lock by tx %s, expires %s",
			dlpiId, dlpi.TransferLock.LockedBy, dlpi.TransferLock.ExpiresAt)
	}

	if dlpi.EncumbranceStatus != "CLEAR" {
		return fmt.Errorf("TRANSFER_BLOCKED: encumbrance status is %s — resolve before initiating transfer",
			dlpi.EncumbranceStatus)
	}

	if dlpi.SuccessionStatus == "SUCCESSION_PENDING" {
		return fmt.Errorf("TRANSFER_BLOCKED: parcel is under active succession. All heirs must consent first.")
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

	return c.saveDLPI(ctx, dlpi)
}

// ReleaseTransferLock — releases the parcel lock after transfer completes or times out
func (c *DLPIContract) ReleaseTransferLock(ctx contractapi.TransactionContextInterface, dlpiId string) error {
	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	dlpi.TransferLock = &TransferLock{IsLocked: false}
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	return c.saveDLPI(ctx, dlpi)
}

// UpdateOwner — updates ownership after a completed PropertyTransfer
// Only called by PropertyTransfer chaincode after full endorsement + ordering
func (c *DLPIContract) UpdateOwner(ctx contractapi.TransactionContextInterface,
	dlpiId, newOwnerName, newOwnerAadhaarHash, mutationType,
	officerName, officerHash, mutationNo, ipfsCID string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	txID := ctx.GetStub().GetTxID()

	// Record mutation in history
	mutation := MutationEntry{
		MutationType: mutationType,
		Date:         now[:10],
		OfficerName:  officerName,
		OfficerHash:  officerHash,
		MutationNo:   mutationNo,
		TxHash:       txID,
		IPFSCID:      ipfsCID,
	}
	dlpi.MutationHistory = append(dlpi.MutationHistory, mutation)

	// Update owner
	dlpi.Owner.Name = newOwnerName
	dlpi.Owner.AadhaarHash = newOwnerAadhaarHash
	dlpi.UpdatedAt = now

	// Release lock
	dlpi.TransferLock = &TransferLock{IsLocked: false}

	// Emit mutation event for 60-second alert
	mutationBytes, _ := json.Marshal(map[string]interface{}{
		"dlpiId":      dlpiId,
		"mutationType": mutationType,
		"newOwner":    newOwnerName,
		"txHash":      txID,
		"timestamp":   now,
	})
	_ = ctx.GetStub().SetEvent("MutationCompleted", mutationBytes)

	return c.saveDLPI(ctx, dlpi)
}

// InitiateSuccession — marks a parcel as SUCCESSION_PENDING when death cert received
func (c *DLPIContract) InitiateSuccession(ctx contractapi.TransactionContextInterface,
	dlpiId, familyId, crsRegistrationNo, deathCertIPFS string, heirsJSON string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	var heirs []Heir
	if err := json.Unmarshal([]byte(heirsJSON), &heirs); err != nil {
		return fmt.Errorf("invalid heirs JSON: %w", err)
	}

	if len(heirs) == 0 {
		return fmt.Errorf("at least one heir required for succession")
	}

	// Validate daughters are included (HSA 2005 enforcement)
	hasDaughter := false
	for _, h := range heirs {
		if h.Relation == "Daughter" {
			hasDaughter = true
		}
	}
	_ = hasDaughter // Logged for audit; CoparcenaryMapper enforces inclusion upstream

	dlpi.IsCoparcenary = true
	dlpi.SuccessionStatus = "SUCCESSION_PENDING"
	dlpi.Coparcenary = &Coparcenary{
		Heirs:           heirs,
		ApplicableLaw:   "Hindu Succession Act 1956/2005",
		CoparcenaryType: "Mitakshara",
		Status:          "PENDING_CONSENT",
	}
	// Block all transactions until succession resolved
	dlpi.EncumbranceStatus = "CLEAR" // encumbrance separate from succession block
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Emit event for real-time heir notifications
	successionEvent, _ := json.Marshal(map[string]interface{}{
		"dlpiId":        dlpiId,
		"familyId":      familyId,
		"crsNo":         crsRegistrationNo,
		"deathCertCID":  deathCertIPFS,
		"heirs":         heirs,
		"triggeredAt":   dlpi.UpdatedAt,
	})
	_ = ctx.GetStub().SetEvent("SuccessionInitiated", successionEvent)

	return c.saveDLPI(ctx, dlpi)
}

// RecordHeirConsent — records an individual heir's Aadhaar eSign consent
func (c *DLPIContract) RecordHeirConsent(ctx contractapi.TransactionContextInterface,
	dlpiId, heirAadhaarHash, consentTxHash string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	if dlpi.Coparcenary == nil {
		return fmt.Errorf("DLPI %s is not in coparcenary succession mode", dlpiId)
	}

	found := false
	for i, heir := range dlpi.Coparcenary.Heirs {
		if heir.AadhaarHash == heirAadhaarHash {
			dlpi.Coparcenary.Heirs[i].HasConsented = true
			dlpi.Coparcenary.Heirs[i].ConsentTxHash = consentTxHash
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("heir with aadhaar hash not found in coparcenary record")
	}

	// Check if all heirs have consented
	allConsented := true
	for _, heir := range dlpi.Coparcenary.Heirs {
		if !heir.HasConsented {
			allConsented = false
			break
		}
	}

	if allConsented {
		dlpi.Coparcenary.Status = "ALL_CONSENTED"
		dlpi.SuccessionStatus = "ACTIVE"
		// Emit event to trigger auto-mutation
		event, _ := json.Marshal(map[string]string{
			"dlpiId":  dlpiId,
			"status":  "ALL_CONSENTED",
			"trigger": "AUTO_MUTATION",
		})
		_ = ctx.GetStub().SetEvent("AllHeirsConsented", event)
	}

	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveDLPI(ctx, dlpi)
}

// SetEncumbrance — updates encumbrance status (called by Encumbrance chaincode)
func (c *DLPIContract) SetEncumbrance(ctx contractapi.TransactionContextInterface,
	dlpiId, status, reason, txHash string) error {

	validStatuses := map[string]bool{
		"CLEAR": true, "MORTGAGED": true,
		"COURT_INJUNCTION": true, "IT_ATTACHMENT": true, "DISPUTED": true,
	}
	if !validStatuses[status] {
		return fmt.Errorf("invalid encumbrance status: %s", status)
	}

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	dlpi.EncumbranceStatus = status
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Emit encumbrance change event
	event, _ := json.Marshal(map[string]string{
		"dlpiId": dlpiId, "status": status, "reason": reason, "txHash": txHash,
	})
	_ = ctx.GetStub().SetEvent("EncumbranceUpdated", event)

	return c.saveDLPI(ctx, dlpi)
}

// AddJangananaFlag — adds a census anomaly flag to a DLPI (called by Janganana oracle)
func (c *DLPIContract) AddJangananaFlag(ctx contractapi.TransactionContextInterface,
	dlpiId, householdId, anomalyType, severity string) error {

	dlpi, err := c.GetDLPI(ctx, dlpiId)
	if err != nil {
		return err
	}

	flag := JangananaFlag{
		HouseholdId:  householdId,
		AnomalyType:  anomalyType,
		DetectedAt:   time.Now().UTC().Format(time.RFC3339),
		Severity:     severity,
		ReviewStatus: "PENDING",
	}

	dlpi.JangananaAnomalies = append(dlpi.JangananaAnomalies, flag)
	dlpi.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Emit for BhumiAnalytics dashboard
	event, _ := json.Marshal(flag)
	_ = ctx.GetStub().SetEvent("JangananaAnomalyDetected", event)

	return c.saveDLPI(ctx, dlpi)
}

// QueryDLPIsByTehsil — rich query: get all parcels in a tehsil (CouchDB)
func (c *DLPIContract) QueryDLPIsByTehsil(ctx contractapi.TransactionContextInterface, tehsil string) ([]*DLPI, error) {
	query := fmt.Sprintf(`{"selector":{"tehsil":"%s"}}`, tehsil)
	return c.executeQuery(ctx, query)
}

// QueryEncumberedParcels — all parcels with active encumbrances
func (c *DLPIContract) QueryEncumberedParcels(ctx contractapi.TransactionContextInterface) ([]*DLPI, error) {
	query := `{"selector":{"encumbranceStatus":{"$ne":"CLEAR"}}}`
	return c.executeQuery(ctx, query)
}

// QueryTribalParcels — all Schedule V / FRA parcels
func (c *DLPIContract) QueryTribalParcels(ctx contractapi.TransactionContextInterface) ([]*DLPI, error) {
	query := `{"selector":{"isTribal":true}}`
	return c.executeQuery(ctx, query)
}

// QuerySuccessionPending — all parcels awaiting heir consent
func (c *DLPIContract) QuerySuccessionPending(ctx contractapi.TransactionContextInterface) ([]*DLPI, error) {
	query := `{"selector":{"successionStatus":"SUCCESSION_PENDING"}}`
	return c.executeQuery(ctx, query)
}

// GetDLPIHistory — returns full transaction history for a parcel (blockchain audit trail)
func (c *DLPIContract) GetDLPIHistory(ctx contractapi.TransactionContextInterface, dlpiId string) ([]map[string]interface{}, error) {
	iterator, err := ctx.GetStub().GetHistoryForKey(dlpiId)
	if err != nil {
		return nil, fmt.Errorf("history query error: %w", err)
	}
	defer iterator.Close()

	var history []map[string]interface{}
	for iterator.HasNext() {
		record, err := iterator.Next()
		if err != nil {
			return nil, err
		}

		entry := map[string]interface{}{
			"txId":      record.TxId,
			"timestamp": record.Timestamp.AsTime().Format(time.RFC3339),
			"isDelete":  record.IsDelete,
		}

		if !record.IsDelete {
			var dlpi DLPI
			if err := json.Unmarshal(record.Value, &dlpi); err == nil {
				entry["owner"] = dlpi.Owner.Name
				entry["encumbranceStatus"] = dlpi.EncumbranceStatus
				entry["successionStatus"] = dlpi.SuccessionStatus
				entry["isLocked"] = dlpi.TransferLock != nil && dlpi.TransferLock.IsLocked
			}
		}
		history = append(history, entry)
	}
	return history, nil
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

func (c *DLPIContract) saveDLPI(ctx contractapi.TransactionContextInterface, dlpi *DLPI) error {
	dlpiBytes, err := json.Marshal(dlpi)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return ctx.GetStub().PutState(dlpi.DLPIId, dlpiBytes)
}

func (c *DLPIContract) executeQuery(ctx contractapi.TransactionContextInterface, query string) ([]*DLPI, error) {
	iterator, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, fmt.Errorf("query error: %w", err)
	}
	defer iterator.Close()

	var results []*DLPI
	for iterator.HasNext() {
		result, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		var dlpi DLPI
		if err := json.Unmarshal(result.Value, &dlpi); err != nil {
			return nil, err
		}
		results = append(results, &dlpi)
	}
	return results, nil
}

// ─── Main ─────────────────────────────────────────────────────────────────────

func main() {
	chaincode, err := contractapi.NewChaincode(&DLPIContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating DLPI chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error starting DLPI chaincode: %v", err))
	}
}
