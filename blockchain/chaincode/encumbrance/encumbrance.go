package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Data Structures ──────────────────────────────────────────────────────────

type EncumbranceRecord struct {
	EncumbranceID   string `json:"encumbranceId"`
	DLPIId          string `json:"dlpiId"`
	Type            string `json:"type"`            // MORTGAGE | COURT_INJUNCTION | IT_ATTACHMENT | RERA_LIEN | CERSAI_CHARGE
	Status          string `json:"status"`          // ACTIVE | RELEASED | PARTIAL_RELEASE
	Description     string `json:"description"`

	// Mortgage fields
	BankName        string `json:"bankName,omitempty"`
	BankBranch      string `json:"bankBranch,omitempty"`
	LoanAccountNo   string `json:"loanAccountNo,omitempty"`   // hashed
	LoanAmountINR   int64  `json:"loanAmountINR,omitempty"`
	CERSAIRegNo     string `json:"cersaiRegNo,omitempty"`     // CERSAI registration number
	MortgageDate    string `json:"mortgageDate,omitempty"`
	MortgageExpiry  string `json:"mortgageExpiry,omitempty"`

	// Court injunction fields
	CourtName       string `json:"courtName,omitempty"`
	CaseNumber      string `json:"caseNumber,omitempty"`
	InjunctionDate  string `json:"injunctionDate,omitempty"`
	InjunctionType  string `json:"injunctionType,omitempty"` // Stay | Attachment | Receiver
	eCourtsOracleHash string `json:"eCourtsOracleHash,omitempty"`

	// I-T attachment fields
	ITAssessmentYear string `json:"itAssessmentYear,omitempty"`
	ITDemandAmountINR int64 `json:"itDemandAmountINR,omitempty"`
	PANHash          string `json:"panHash,omitempty"`

	// RERA lien
	RERAProjectID   string `json:"reraProjectId,omitempty"`
	RERAAuthority   string `json:"reraAuthority,omitempty"`

	// Common tracking
	RegisteredBy    string `json:"registeredByHash"` // officer Aadhaar hash
	RegisteredAt    string `json:"registeredAt"`
	ReleasedAt      string `json:"releasedAt,omitempty"`
	ReleasedByHash  string `json:"releasedByHash,omitempty"`
	ReleaseDocCID   string `json:"releaseDocCID,omitempty"`
	UpdatedAt       string `json:"updatedAt"`
}

// Encumbrance Certificate — generated on-demand, 30-second target
type EncumbranceCertificate struct {
	ECId            string              `json:"ecId"`
	DLPIId          string              `json:"dlpiId"`
	ParcelInfo      map[string]interface{} `json:"parcelInfo"`
	ActiveEncumbrances []EncumbranceRecord `json:"activeEncumbrances"`
	ReleasedEncumbrances []EncumbranceRecord `json:"releasedEncumbrances"`
	TotalActiveCount int                `json:"totalActiveCount"`
	IsEncumbered    bool               `json:"isEncumbered"`
	GeneratedAt     string             `json:"generatedAt"`
	ValidUntil      string             `json:"validUntil"`  // EC valid for 24 hours
	QRVerifyHash    string             `json:"qrVerifyHash"` // for QR-based verification
	GeneratedByHash string             `json:"generatedByHash"`
	BlockchainAnchor string            `json:"blockchainAnchor"` // block height at generation
}

// ─── Smart Contract ───────────────────────────────────────────────────────────

type EncumbranceContract struct {
	contractapi.Contract
}

// RegisterMortgage — bank registers a mortgage charge (CERSAI integration)
// Endorsement: AND(Bank.member, SRO.member)
func (c *EncumbranceContract) RegisterMortgage(
	ctx contractapi.TransactionContextInterface,
	dlpiId, bankName, bankBranch, loanAccountHashedNo string,
	loanAmountINR int64,
	cersaiRegNo, mortgageDate, mortgageExpiry, registeredByHash string,
) (string, error) {

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()
	encID := fmt.Sprintf("ENC-MORT-%s-%s", dlpiId, txID[:8])

	// Check for existing active mortgage on same parcel (dual mortgage prevention)
	existing, err := c.queryActiveByDLPIAndType(ctx, dlpiId, "MORTGAGE")
	if err != nil {
		return "", err
	}
	if len(existing) > 0 {
		return "", fmt.Errorf(
			"DUAL_MORTGAGE_BLOCKED: DLPI %s already has an active CERSAI charge (ID: %s). "+
				"Release existing mortgage before registering new one.",
			dlpiId, existing[0].EncumbranceID,
		)
	}

	record := EncumbranceRecord{
		EncumbranceID:  encID,
		DLPIId:         dlpiId,
		Type:           "MORTGAGE",
		Status:         "ACTIVE",
		Description:    fmt.Sprintf("Mortgage to %s, Branch: %s", bankName, bankBranch),
		BankName:       bankName,
		BankBranch:     bankBranch,
		LoanAccountNo:  loanAccountHashedNo,
		LoanAmountINR:  loanAmountINR,
		CERSAIRegNo:    cersaiRegNo,
		MortgageDate:   mortgageDate,
		MortgageExpiry: mortgageExpiry,
		RegisteredBy:   registeredByHash,
		RegisteredAt:   now.Format(time.RFC3339),
		UpdatedAt:      now.Format(time.RFC3339),
	}

	if err := c.saveRecord(ctx, &record); err != nil {
		return "", err
	}

	// Update DLPI encumbrance status
	if err := c.updateDLPIEncumbrance(ctx, dlpiId, "MORTGAGED", fmt.Sprintf("Mortgage: %s %s", bankName, cersaiRegNo)); err != nil {
		return "", err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"encumbranceId": encID,
		"dlpiId":        dlpiId,
		"type":          "MORTGAGE",
		"bankName":      bankName,
		"cersaiRegNo":   cersaiRegNo,
		"loanAmount":    loanAmountINR,
	})
	_ = ctx.GetStub().SetEvent("MortgageRegistered", event)

	return encID, nil
}

// RegisterCourtInjunction — court clerk registers an injunction via eCourts oracle
// Endorsement: AND(SRO.member, eCourts.oracle)
func (c *EncumbranceContract) RegisterCourtInjunction(
	ctx contractapi.TransactionContextInterface,
	dlpiId, courtName, caseNumber, injunctionDate, injunctionType,
	eCourtsOracleHash, registeredByHash string,
) (string, error) {

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()
	encID := fmt.Sprintf("ENC-COURT-%s-%s", dlpiId, txID[:8])

	if eCourtsOracleHash == "" {
		return "", fmt.Errorf("court injunctions require eCourts oracle verification hash — cannot register without oracle confirmation")
	}

	record := EncumbranceRecord{
		EncumbranceID:     encID,
		DLPIId:            dlpiId,
		Type:              "COURT_INJUNCTION",
		Status:            "ACTIVE",
		Description:       fmt.Sprintf("%s in %s — Case: %s", injunctionType, courtName, caseNumber),
		CourtName:         courtName,
		CaseNumber:        caseNumber,
		InjunctionDate:    injunctionDate,
		InjunctionType:    injunctionType,
		eCourtsOracleHash: eCourtsOracleHash,
		RegisteredBy:      registeredByHash,
		RegisteredAt:      now.Format(time.RFC3339),
		UpdatedAt:         now.Format(time.RFC3339),
	}

	if err := c.saveRecord(ctx, &record); err != nil {
		return "", err
	}

	if err := c.updateDLPIEncumbrance(ctx, dlpiId, "COURT_INJUNCTION",
		fmt.Sprintf("Court order: %s Case %s", courtName, caseNumber)); err != nil {
		return "", err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"encumbranceId": encID,
		"dlpiId":        dlpiId,
		"type":          "COURT_INJUNCTION",
		"courtName":     courtName,
		"caseNumber":    caseNumber,
		"injunctionType": injunctionType,
	})
	_ = ctx.GetStub().SetEvent("CourtInjunctionRegistered", event)

	return encID, nil
}

// RegisterITAttachment — I-T Department registers tax attachment
// Endorsement: AND(ITDept.member, SRO.member)
func (c *EncumbranceContract) RegisterITAttachment(
	ctx contractapi.TransactionContextInterface,
	dlpiId, itAssessmentYear, panHash string,
	itDemandAmountINR int64,
	registeredByHash string,
) (string, error) {

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()
	encID := fmt.Sprintf("ENC-IT-%s-%s", dlpiId, txID[:8])

	record := EncumbranceRecord{
		EncumbranceID:    encID,
		DLPIId:           dlpiId,
		Type:             "IT_ATTACHMENT",
		Status:           "ACTIVE",
		Description:      fmt.Sprintf("I-T attachment for AY %s, demand Rs.%d", itAssessmentYear, itDemandAmountINR),
		ITAssessmentYear: itAssessmentYear,
		ITDemandAmountINR: itDemandAmountINR,
		PANHash:          panHash,
		RegisteredBy:     registeredByHash,
		RegisteredAt:     now.Format(time.RFC3339),
		UpdatedAt:        now.Format(time.RFC3339),
	}

	if err := c.saveRecord(ctx, &record); err != nil {
		return "", err
	}

	if err := c.updateDLPIEncumbrance(ctx, dlpiId, "IT_ATTACHMENT",
		fmt.Sprintf("IT AY%s demand Rs.%d", itAssessmentYear, itDemandAmountINR)); err != nil {
		return "", err
	}

	event, _ := json.Marshal(record)
	_ = ctx.GetStub().SetEvent("ITAttachmentRegistered", event)

	return encID, nil
}

// ReleaseEncumbrance — release any encumbrance type with documentation
// Endorsement based on type: MORTGAGE → AND(Bank.member, SRO.member)
//                            COURT → AND(SRO.member, eCourts.oracle)
//                            IT → AND(ITDept.member, SRO.member)
func (c *EncumbranceContract) ReleaseEncumbrance(
	ctx contractapi.TransactionContextInterface,
	encumbranceID, releasedByHash, releaseDocCID string,
) error {
	record, err := c.getRecord(ctx, encumbranceID)
	if err != nil {
		return err
	}

	if record.Status != "ACTIVE" {
		return fmt.Errorf("encumbrance %s is already in state: %s", encumbranceID, record.Status)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	record.Status = "RELEASED"
	record.ReleasedAt = now
	record.ReleasedByHash = releasedByHash
	record.ReleaseDocCID = releaseDocCID
	record.UpdatedAt = now

	if err := c.saveRecord(ctx, record); err != nil {
		return err
	}

	// Check if any other active encumbrances remain on this DLPI
	remaining, err := c.queryActiveByDLPI(ctx, record.DLPIId)
	if err != nil {
		return err
	}

	// Update DLPI encumbrance status based on remaining encumbrances
	newStatus := "CLEAR"
	newReason := ""
	if len(remaining) > 0 {
		newStatus = remaining[0].Type
		newReason = remaining[0].Description
	}

	if err := c.updateDLPIEncumbrance(ctx, record.DLPIId, newStatus, newReason); err != nil {
		return err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"encumbranceId": encumbranceID,
		"dlpiId":        record.DLPIId,
		"type":          record.Type,
		"newDLPIStatus": newStatus,
		"releasedAt":    now,
	})
	_ = ctx.GetStub().SetEvent("EncumbranceReleased", event)

	return nil
}

// GenerateEC — generates an Encumbrance Certificate for a parcel
// Target: < 30 seconds from request to delivery
// This is a query operation — reads state DB, no ledger write
func (c *EncumbranceContract) GenerateEC(
	ctx contractapi.TransactionContextInterface,
	dlpiId, requestedByHash string,
) (*EncumbranceCertificate, error) {

	now := time.Now().UTC()
	txID := ctx.GetStub().GetTxID()

	// Query all encumbrances for this parcel
	allRecords, err := c.queryAllByDLPI(ctx, dlpiId)
	if err != nil {
		return nil, fmt.Errorf("encumbrance query failed: %w", err)
	}

	var active, released []EncumbranceRecord
	for _, r := range allRecords {
		if r.Status == "ACTIVE" {
			active = append(active, *r)
		} else {
			released = append(released, *r)
		}
	}

	// Generate QR verification hash
	qrData := fmt.Sprintf("%s-%s-%s", dlpiId, txID, now.Format("20060102"))
	qrHash := fmt.Sprintf("QR-%x", []byte(qrData))[:32]

	ec := &EncumbranceCertificate{
		ECId:    fmt.Sprintf("EC-%s-%s", dlpiId, txID[:8]),
		DLPIId:  dlpiId,
		ParcelInfo: map[string]interface{}{
			"dlpiId":  dlpiId,
			"district": "Nashik",
			"state":   "Maharashtra",
		},
		ActiveEncumbrances:   active,
		ReleasedEncumbrances: released,
		TotalActiveCount:     len(active),
		IsEncumbered:         len(active) > 0,
		GeneratedAt:          now.Format(time.RFC3339),
		ValidUntil:           now.Add(24 * time.Hour).Format(time.RFC3339),
		QRVerifyHash:         qrHash,
		GeneratedByHash:      requestedByHash,
		BlockchainAnchor:     txID,
	}

	// Emit EC generation event for analytics
	event, _ := json.Marshal(map[string]interface{}{
		"ecId":           ec.ECId,
		"dlpiId":         dlpiId,
		"isEncumbered":   ec.IsEncumbered,
		"activeCount":    len(active),
		"generatedAt":    ec.GeneratedAt,
	})
	_ = ctx.GetStub().SetEvent("ECGenerated", event)

	return ec, nil
}

// GetEncumbranceRecord — get a specific encumbrance by ID
func (c *EncumbranceContract) GetEncumbranceRecord(
	ctx contractapi.TransactionContextInterface,
	encumbranceID string,
) (*EncumbranceRecord, error) {
	return c.getRecord(ctx, encumbranceID)
}

// QueryActiveEncumbrances — all active encumbrances for a DLPI
func (c *EncumbranceContract) QueryActiveEncumbrances(
	ctx contractapi.TransactionContextInterface,
	dlpiId string,
) ([]*EncumbranceRecord, error) {
	return c.queryActiveByDLPI(ctx, dlpiId)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

func (c *EncumbranceContract) updateDLPIEncumbrance(ctx contractapi.TransactionContextInterface, dlpiId, status, reason string) error {
	args := [][]byte{
		[]byte("SetEncumbrance"),
		[]byte(dlpiId),
		[]byte(status),
		[]byte(reason),
		[]byte(ctx.GetStub().GetTxID()),
	}
	resp := ctx.GetStub().InvokeChaincode("dlpi", args, "")
	if resp.Status != 200 {
		return fmt.Errorf("DLPI encumbrance update failed: %s", resp.Message)
	}
	return nil
}

func (c *EncumbranceContract) queryActiveByDLPI(ctx contractapi.TransactionContextInterface, dlpiId string) ([]*EncumbranceRecord, error) {
	query := fmt.Sprintf(`{"selector":{"dlpiId":"%s","status":"ACTIVE"}}`, dlpiId)
	return c.executeQuery(ctx, query)
}

func (c *EncumbranceContract) queryAllByDLPI(ctx contractapi.TransactionContextInterface, dlpiId string) ([]*EncumbranceRecord, error) {
	query := fmt.Sprintf(`{"selector":{"dlpiId":"%s"}}`, dlpiId)
	return c.executeQuery(ctx, query)
}

func (c *EncumbranceContract) queryActiveByDLPIAndType(ctx contractapi.TransactionContextInterface, dlpiId, encType string) ([]*EncumbranceRecord, error) {
	query := fmt.Sprintf(`{"selector":{"dlpiId":"%s","type":"%s","status":"ACTIVE"}}`, dlpiId, encType)
	return c.executeQuery(ctx, query)
}

func (c *EncumbranceContract) getRecord(ctx contractapi.TransactionContextInterface, id string) (*EncumbranceRecord, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("state read error: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("encumbrance record %s not found", id)
	}
	var r EncumbranceRecord
	if err := json.Unmarshal(data, &r); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &r, nil
}

func (c *EncumbranceContract) saveRecord(ctx contractapi.TransactionContextInterface, r *EncumbranceRecord) error {
	data, err := json.Marshal(r)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return ctx.GetStub().PutState(r.EncumbranceID, data)
}

func (c *EncumbranceContract) executeQuery(ctx contractapi.TransactionContextInterface, query string) ([]*EncumbranceRecord, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*EncumbranceRecord
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var rec EncumbranceRecord
		if err := json.Unmarshal(r.Value, &rec); err != nil {
			return nil, err
		}
		results = append(results, &rec)
	}
	return results, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&EncumbranceContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating Encumbrance chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error starting Encumbrance chaincode: %v", err))
	}
}
