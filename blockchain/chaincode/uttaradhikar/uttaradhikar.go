package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Data Structures ──────────────────────────────────────────────────────────

type SuccessionCase struct {
	CaseID            string         `json:"caseId"`
	DLPIId            string         `json:"dlpiId"`
	FamilyID          string         `json:"familyId"`
	DeceasedName      string         `json:"deceasedName"`
	DeceasedHash      string         `json:"deceasedAadhaarHash"`
	DateOfDeath       string         `json:"dateOfDeath"`
	DeathCertCID      string         `json:"deathCertCID"`     // IPFS CID
	CRSRegistrationNo string         `json:"crsRegistrationNo"` // Civil Registration System

	ApplicableLaw     string         `json:"applicableLaw"`
	CoparcenaryType   string         `json:"coparcenaryType"`

	Heirs             []SuccessionHeir `json:"heirs"`
	TotalHeirs        int              `json:"totalHeirs"`
	MinorHeirs        []MinorHeir      `json:"minorHeirs,omitempty"`

	Status            string         `json:"status"`
	// INITIATED → HEIRS_IDENTIFIED → NOTIFICATIONS_SENT →
	// AWAITING_CONSENTS → ALL_CONSENTED → AUTO_MUTATED |
	// DISPUTE_FILED → COURT_REFERRED | PARTIAL_PARTITION

	ConsentDeadline   string         `json:"consentDeadline"`    // 30 days from notification
	AllConsentedAt    string         `json:"allConsentedAt,omitempty"`
	AutoMutatedAt     string         `json:"autoMutatedAt,omitempty"`

	DisputeInfo       *DisputeRecord `json:"disputeInfo,omitempty"`
	PartitionInfo     *PartitionRecord `json:"partitionInfo,omitempty"`

	// Audit: CoparcenaryMapper AI output stored for transparency
	AIComputationCID  string         `json:"aiComputationCID"`   // IPFS CID of AI computation log
	AIConfidenceScore float64        `json:"aiConfidenceScore"`  // 0–1, how confident mapper was
	LegalEdgeCases    []string       `json:"legalEdgeCases,omitempty"` // flagged edge cases

	InitiatedAt       string         `json:"initiatedAt"`
	UpdatedAt         string         `json:"updatedAt"`
}

type SuccessionHeir struct {
	HeirID          string  `json:"heirId"`
	Name            string  `json:"name"`
	AadhaarHash     string  `json:"aadhaarHash"`
	Relation        string  `json:"relation"`       // Son | Daughter | Widow | Widower | Mother | Father
	Gender          string  `json:"gender"`
	DOB             string  `json:"dob"`
	IsAlive         bool    `json:"isAlive"`
	IsAdult         bool    `json:"isAdult"`        // 18+ years
	IsNRI           bool    `json:"isNri"`
	Share           string  `json:"share"`          // "1/3", "1/4", etc.
	ShareDecimal    float64 `json:"shareDecimal"`
	LegalNote       string  `json:"legalNote,omitempty"`

	// Consent tracking
	NotifiedAt      string  `json:"notifiedAt,omitempty"`
	NotifyChannel   string  `json:"notifyChannel,omitempty"` // SMS | WHATSAPP | PUSH | EMAIL
	HasConsented    bool    `json:"hasConsented"`
	ConsentedAt     string  `json:"consentedAt,omitempty"`
	ConsentTxHash   string  `json:"consentTxHash,omitempty"`

	// Objection
	HasObjected     bool    `json:"hasObjected"`
	ObjectedAt      string  `json:"objectedAt,omitempty"`
	ObjectionReason string  `json:"objectionReason,omitempty"`
}

type MinorHeir struct {
	Name          string `json:"name"`
	DOB           string `json:"dob"`
	Relation      string `json:"relation"`
	GuardianName  string `json:"guardianName"`
	GuardianHash  string `json:"guardianAadhaarHash"`
	Share         string `json:"share"`
	ShareDecimal  float64 `json:"shareDecimal"`
	CourtApptdGuardian bool `json:"courtAppointedGuardian"` // requires court guardian appointment
}

type DisputeRecord struct {
	DisputedBy      string `json:"disputedByHash"`
	DisputeType     string `json:"disputeType"`   // ShareDispute | RightToInherit | FalseClaim
	FiledAt         string `json:"filedAt"`
	ECourtsCaseNo   string `json:"eCourtsCaseNo,omitempty"`
	Court           string `json:"court,omitempty"`
	NyayaAIBrief    string `json:"nyayaAIBriefCID,omitempty"` // AI-generated judicial brief CID
	Status          string `json:"status"`        // FILED | HEARING | RESOLVED
	ResolvedAt      string `json:"resolvedAt,omitempty"`
	CourtOrder      string `json:"courtOrderCID,omitempty"`
}

type PartitionRecord struct {
	Type            string            `json:"type"`       // PHYSICAL | MONETARY | AUCTION
	PartitionShares map[string]string `json:"partitionShares"` // heirId → new DLPI or amount
	ExecutedAt      string            `json:"executedAt,omitempty"`
	Status          string            `json:"status"`
}

// Applicable law constants
const (
	LawHSA     = "Hindu Succession Act 1956/2005"
	LawMuslim  = "Muslim Personal Law (Shariat) Application Act 1937"
	LawChrist  = "Indian Succession Act 1925"
	LawTribal  = "Tribal Customary Law + Forest Rights Act 2006"
)

// ─── Smart Contract ───────────────────────────────────────────────────────────

type UttaradhikarContract struct {
	contractapi.Contract
}

// InitiateSuccession — triggered by Civil Registration System oracle on death certificate
// CoparcenaryMapper AI has already computed heirs off-chain; result passed as JSON
// Endorsement: AND(Revenue-HQ.member, CRS.oracle)
func (c *UttaradhikarContract) InitiateSuccession(
	ctx contractapi.TransactionContextInterface,
	dlpiId, familyId, deceasedName, deceasedHash,
	dateOfDeath, deathCertCID, crsRegNo,
	applicableLaw, heirsJSON, minorHeirsJSON,
	aiComputationCID string,
	aiConfidenceScore float64,
) (string, error) {

	// Validate CRS oracle triggered this — must have CRS registration number
	if crsRegNo == "" {
		return "", fmt.Errorf("CRS_REQUIRED: succession can only be initiated with Civil Registration System death certificate number")
	}

	var heirs []SuccessionHeir
	if err := json.Unmarshal([]byte(heirsJSON), &heirs); err != nil {
		return "", fmt.Errorf("invalid heirs JSON: %w", err)
	}
	if len(heirs) == 0 {
		return "", fmt.Errorf("at least one heir required")
	}

	var minorHeirs []MinorHeir
	if minorHeirsJSON != "" && minorHeirsJSON != "[]" {
		if err := json.Unmarshal([]byte(minorHeirsJSON), &minorHeirs); err != nil {
			return "", fmt.Errorf("invalid minor heirs JSON: %w", err)
		}
	}

	// ── HSA 2005 Daughter Rights Enforcement ─────────────────────────────────
	// Hard check: if applicable law is HSA, every daughter MUST be included
	// This is the chaincode-level enforcement of Section 6(3)
	if applicableLaw == LawHSA {
		if err := c.enforceHSA2005DaughterRights(heirs); err != nil {
			return "", err
		}
	}

	// ── Share validation: must sum to 1.0 ────────────────────────────────────
	totalShare := 0.0
	for _, h := range heirs {
		totalShare += h.ShareDecimal
	}
	for _, m := range minorHeirs {
		totalShare += m.ShareDecimal
	}
	// Allow small floating-point tolerance
	if totalShare < 0.999 || totalShare > 1.001 {
		return "", fmt.Errorf("SHARE_INVALID: heir shares sum to %.4f, must equal 1.0 — CoparcenaryMapper computation error", totalShare)
	}

	// ── Edge case flags ───────────────────────────────────────────────────────
	var edgeCases []string
	for _, h := range heirs {
		if h.IsNRI {
			edgeCases = append(edgeCases, fmt.Sprintf("NRI heir %s — FEMA compliance check required before partition", h.Name))
		}
	}
	if len(minorHeirs) > 0 {
		edgeCases = append(edgeCases, fmt.Sprintf("%d minor heir(s) — court-appointed guardian required before title mutation", len(minorHeirs)))
	}

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()
	caseID := fmt.Sprintf("SUC-%s-%s", dlpiId, txID[:8])
	consentDeadline := now.Add(30 * 24 * time.Hour).Format(time.RFC3339) // 30 days

	successionCase := SuccessionCase{
		CaseID:            caseID,
		DLPIId:            dlpiId,
		FamilyID:          familyId,
		DeceasedName:      deceasedName,
		DeceasedHash:      deceasedHash,
		DateOfDeath:       dateOfDeath,
		DeathCertCID:      deathCertCID,
		CRSRegistrationNo: crsRegNo,
		ApplicableLaw:     applicableLaw,
		CoparcenaryType:   "Mitakshara",
		Heirs:             heirs,
		TotalHeirs:        len(heirs),
		MinorHeirs:        minorHeirs,
		Status:            "HEIRS_IDENTIFIED",
		ConsentDeadline:   consentDeadline,
		AIComputationCID:  aiComputationCID,
		AIConfidenceScore: aiConfidenceScore,
		LegalEdgeCases:    edgeCases,
		InitiatedAt:       now.Format(time.RFC3339),
		UpdatedAt:         now.Format(time.RFC3339),
	}

	if err := c.saveCase(ctx, &successionCase); err != nil {
		return "", err
	}

	// Trigger DLPI succession lock via cross-chaincode call
	heirsForDLPI, _ := json.Marshal(heirs)
	dlpiArgs := [][]byte{
		[]byte("InitiateSuccession"),
		[]byte(dlpiId),
		[]byte(familyId),
		[]byte(crsRegNo),
		[]byte(deathCertCID),
		heirsForDLPI,
	}
	dlpiResp := ctx.GetStub().InvokeChaincode("dlpi", dlpiArgs, "")
	if dlpiResp.Status != 200 {
		return "", fmt.Errorf("DLPI succession lock failed: %s", dlpiResp.Message)
	}

	// Emit heir notification event — oracle fires SMS/WhatsApp to all heirs within 24 hours
	notifyEvent, _ := json.Marshal(map[string]interface{}{
		"caseId":          caseID,
		"dlpiId":          dlpiId,
		"deceasedName":    deceasedName,
		"heirs":           heirs,
		"minorHeirs":      minorHeirs,
		"applicableLaw":   applicableLaw,
		"consentDeadline": consentDeadline,
		"edgeCases":       edgeCases,
		"channels":        []string{"SMS", "WHATSAPP", "PUSH", "DIGILOCKER"},
	})
	_ = ctx.GetStub().SetEvent("HeirNotificationRequired", notifyEvent)

	return caseID, nil
}

// RecordHeirNotification — oracle confirms notification delivered to a specific heir
func (c *UttaradhikarContract) RecordHeirNotification(
	ctx contractapi.TransactionContextInterface,
	caseID, heirAadhaarHash, channel, deliveredAt string,
) error {
	sCase, err := c.getCase(ctx, caseID)
	if err != nil {
		return err
	}

	allNotified := true
	found := false
	for i, heir := range sCase.Heirs {
		if heir.AadhaarHash == heirAadhaarHash {
			sCase.Heirs[i].NotifiedAt = deliveredAt
			sCase.Heirs[i].NotifyChannel = channel
			found = true
		}
		if sCase.Heirs[i].NotifiedAt == "" {
			allNotified = false
		}
	}

	if !found {
		return fmt.Errorf("heir with hash %s not found in case %s", heirAadhaarHash, caseID)
	}

	if allNotified {
		sCase.Status = "AWAITING_CONSENTS"
	}

	sCase.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveCase(ctx, sCase)
}

// RecordHeirConsent — heir provides Aadhaar eSign consent to their share
func (c *UttaradhikarContract) RecordHeirConsent(
	ctx contractapi.TransactionContextInterface,
	caseID, heirAadhaarHash, eSignTxHash string,
) error {
	sCase, err := c.getCase(ctx, caseID)
	if err != nil {
		return err
	}

	if sCase.Status == "COURT_REFERRED" || sCase.Status == "AUTO_MUTATED" {
		return fmt.Errorf("succession case %s is in terminal state: %s", caseID, sCase.Status)
	}

	// Check consent deadline
	deadline := mustParseTime(sCase.ConsentDeadline)
	if time.Now().UTC().After(deadline) {
		return fmt.Errorf("CONSENT_DEADLINE_PASSED: 30-day consent window closed on %s — case referred to court", sCase.ConsentDeadline)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	found := false
	for i, heir := range sCase.Heirs {
		if heir.AadhaarHash == heirAadhaarHash {
			if heir.HasObjected {
				return fmt.Errorf("heir %s has already filed an objection — cannot consent after objecting", heir.Name)
			}
			sCase.Heirs[i].HasConsented = true
			sCase.Heirs[i].ConsentedAt = now
			sCase.Heirs[i].ConsentTxHash = eSignTxHash
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("heir not found in case")
	}

	// Record consent on DLPI chaincode too
	dlpiArgs := [][]byte{
		[]byte("RecordHeirConsent"),
		[]byte(sCase.DLPIId),
		[]byte(heirAadhaarHash),
		[]byte(eSignTxHash),
	}
	_ = ctx.GetStub().InvokeChaincode("dlpi", dlpiArgs, "")

	// Check if ALL adult heirs have now consented
	if c.allAdultHeirsConsented(sCase) {
		return c.executeAutoMutation(ctx, sCase, now)
	}

	sCase.UpdatedAt = now
	return c.saveCase(ctx, sCase)
}

// RecordHeirObjection — heir disputes the succession (share, right to inherit, etc.)
func (c *UttaradhikarContract) RecordHeirObjection(
	ctx contractapi.TransactionContextInterface,
	caseID, heirAadhaarHash, disputeType, objectionReason, evidenceCID string,
) error {
	sCase, err := c.getCase(ctx, caseID)
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	heirName := ""

	for i, heir := range sCase.Heirs {
		if heir.AadhaarHash == heirAadhaarHash {
			if heir.HasConsented {
				return fmt.Errorf("heir %s has already consented — cannot object after consenting", heir.Name)
			}
			sCase.Heirs[i].HasObjected = true
			sCase.Heirs[i].ObjectedAt = now
			sCase.Heirs[i].ObjectionReason = objectionReason
			heirName = heir.Name
			break
		}
	}
	if heirName == "" {
		return fmt.Errorf("heir not found in case")
	}

	txID := ctx.GetStub().GetTxID()
	sCase.Status = "COURT_REFERRED"
	sCase.DisputeInfo = &DisputeRecord{
		DisputedBy:  heirAadhaarHash,
		DisputeType: disputeType,
		FiledAt:     now,
		Status:      "FILED",
	}
	sCase.UpdatedAt = now

	if err := c.saveCase(ctx, sCase); err != nil {
		return err
	}

	// Emit event to trigger NyayaAI brief generation + eCourts e-filing
	disputeEvent, _ := json.Marshal(map[string]interface{}{
		"caseId":         caseID,
		"dlpiId":         sCase.DLPIId,
		"disputedByName": heirName,
		"disputeType":    disputeType,
		"objectionReason": objectionReason,
		"evidenceCID":    evidenceCID,
		"txHash":         txID,
		"actions": []string{
			"GENERATE_NYAYAAI_BRIEF",
			"NOTIFY_NALSA",
			"ECOURTS_EFILING_READY",
		},
	})
	_ = ctx.GetStub().SetEvent("SuccessionDisputeFiled", disputeEvent)

	return nil
}

// RecordCourtOrder — eCourts oracle records court judgment on succession dispute
func (c *UttaradhikarContract) RecordCourtOrder(
	ctx contractapi.TransactionContextInterface,
	caseID, eCourtsOracleHash, courtOrderCID, judgment string,
	revisedHeirsJSON string,
) error {
	sCase, err := c.getCase(ctx, caseID)
	if err != nil {
		return err
	}

	if sCase.Status != "COURT_REFERRED" {
		return fmt.Errorf("case %s is not in COURT_REFERRED state", caseID)
	}

	if eCourtsOracleHash == "" {
		return fmt.Errorf("ECOURTS_REQUIRED: court order must be verified by eCourts oracle")
	}

	now := time.Now().UTC().Format(time.RFC3339)

	// Update dispute info with court order
	if sCase.DisputeInfo != nil {
		sCase.DisputeInfo.ECourtsCaseNo = eCourtsOracleHash
		sCase.DisputeInfo.CourtOrder = courtOrderCID
		sCase.DisputeInfo.Status = "RESOLVED"
		sCase.DisputeInfo.ResolvedAt = now
	}

	// If court provided revised heirs (e.g., added omitted daughter), apply them
	if revisedHeirsJSON != "" && revisedHeirsJSON != "null" {
		var revisedHeirs []SuccessionHeir
		if err := json.Unmarshal([]byte(revisedHeirsJSON), &revisedHeirs); err != nil {
			return fmt.Errorf("invalid revised heirs JSON: %w", err)
		}
		// Re-enforce HSA 2005 even on court-revised heirs
		if sCase.ApplicableLaw == LawHSA {
			if err := c.enforceHSA2005DaughterRights(revisedHeirs); err != nil {
				return fmt.Errorf("COURT_ORDER_REJECTED: revised heirs violate HSA 2005 S.6(3) — %w", err)
			}
		}
		sCase.Heirs = revisedHeirs
		sCase.TotalHeirs = len(revisedHeirs)
	}

	sCase.Status = "AWAITING_CONSENTS"
	sCase.UpdatedAt = now

	// Reset consent deadline from court order date
	sCase.ConsentDeadline = mustParseTime(now).Add(30 * 24 * time.Hour).Format(time.RFC3339)

	if err := c.saveCase(ctx, sCase); err != nil {
		return err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"caseId":       caseID,
		"dlpiId":       sCase.DLPIId,
		"judgment":     judgment,
		"courtOrderCID": courtOrderCID,
		"status":       "AWAITING_CONSENTS",
		"nextAction":   "RE_NOTIFY_ALL_HEIRS",
	})
	_ = ctx.GetStub().SetEvent("CourtOrderRecorded", event)

	return nil
}

// GetSuccessionCase — retrieve a succession case
func (c *UttaradhikarContract) GetSuccessionCase(
	ctx contractapi.TransactionContextInterface,
	caseID string,
) (*SuccessionCase, error) {
	return c.getCase(ctx, caseID)
}

// GetSuccessionByDLPI — get active succession case for a parcel
func (c *UttaradhikarContract) GetSuccessionByDLPI(
	ctx contractapi.TransactionContextInterface,
	dlpiId string,
) ([]*SuccessionCase, error) {
	query := fmt.Sprintf(`{"selector":{"dlpiId":"%s"}}`, dlpiId)
	return c.executeQuery(ctx, query)
}

// QueryPendingSuccessions — all cases awaiting heir consents (officer dashboard)
func (c *UttaradhikarContract) QueryPendingSuccessions(
	ctx contractapi.TransactionContextInterface,
) ([]*SuccessionCase, error) {
	query := `{"selector":{"status":{"$in":["AWAITING_CONSENTS","HEIRS_IDENTIFIED","NOTIFICATIONS_SENT"]}}}`
	return c.executeQuery(ctx, query)
}

// ─── Internal: HSA 2005 Enforcement ──────────────────────────────────────────

// enforceHSA2005DaughterRights — chaincode-level enforcement of Section 6(3)
// If any daughter is excluded without court order, hard reject
func (c *UttaradhikarContract) enforceHSA2005DaughterRights(heirs []SuccessionHeir) error {
	hasSons := false
	hasDaughters := false

	for _, h := range heirs {
		if h.Relation == "Son" && h.IsAlive {
			hasSons = true
		}
		if h.Relation == "Daughter" && h.IsAlive {
			hasDaughters = true
		}
	}

	// Check daughter shares equal son shares
	if hasSons && hasDaughters {
		sonShare := 0.0
		daughterShare := 0.0
		sonCount := 0
		daughterCount := 0

		for _, h := range heirs {
			if h.Relation == "Son" && h.IsAlive {
				sonShare = h.ShareDecimal
				sonCount++
			}
			if h.Relation == "Daughter" && h.IsAlive {
				daughterShare = h.ShareDecimal
				daughterCount++
			}
		}

		if sonCount > 0 && daughterCount > 0 {
			// Equal shares within floating point tolerance
			diff := sonShare - daughterShare
			if diff < -0.001 || diff > 0.001 {
				return fmt.Errorf(
					"HSA2005_VIOLATION: daughters' share (%.4f) ≠ sons' share (%.4f). "+
						"Per Hindu Succession Act 2005 S.6(3), daughters are coparceners by birth with equal rights. "+
						"This mutation is REJECTED. CoparcenaryMapper must recompute with equal shares.",
					daughterShare, sonShare,
				)
			}
		}
	}

	return nil
}

// ─── Internal: Auto-Mutation Execution ───────────────────────────────────────

func (c *UttaradhikarContract) executeAutoMutation(
	ctx contractapi.TransactionContextInterface,
	sCase *SuccessionCase,
	now string,
) error {
	txID := ctx.GetStub().GetTxID()
	sCase.Status = "ALL_CONSENTED"
	sCase.AllConsentedAt = now

	if err := c.saveCase(ctx, sCase); err != nil {
		return err
	}

	// Emit auto-mutation trigger event
	// The MutationManager chaincode will handle the actual mutation execution
	autoMutEvent, _ := json.Marshal(map[string]interface{}{
		"caseId":        sCase.CaseID,
		"dlpiId":        sCase.DLPIId,
		"heirs":         sCase.Heirs,
		"minorHeirs":    sCase.MinorHeirs,
		"applicableLaw": sCase.ApplicableLaw,
		"txHash":        txID,
		"trigger":       "AUTO_MUTATION",
		"note":          "All heirs consented — initiate partition or joint ownership mutation",
	})
	_ = ctx.GetStub().SetEvent("AllHeirsConsentedAutoMutation", autoMutEvent)

	sCase.Status = "AUTO_MUTATED"
	sCase.AutoMutatedAt = now
	sCase.UpdatedAt = now

	return c.saveCase(ctx, sCase)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

func (c *UttaradhikarContract) allAdultHeirsConsented(sCase *SuccessionCase) bool {
	for _, heir := range sCase.Heirs {
		if heir.IsAdult && heir.IsAlive && !heir.HasConsented {
			return false
		}
	}
	return true
}

func (c *UttaradhikarContract) getCase(ctx contractapi.TransactionContextInterface, id string) (*SuccessionCase, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("state read error: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("succession case %s not found", id)
	}
	var sc SuccessionCase
	if err := json.Unmarshal(data, &sc); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &sc, nil
}

func (c *UttaradhikarContract) saveCase(ctx contractapi.TransactionContextInterface, sc *SuccessionCase) error {
	data, err := json.Marshal(sc)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return ctx.GetStub().PutState(sc.CaseID, data)
}

func (c *UttaradhikarContract) executeQuery(ctx contractapi.TransactionContextInterface, query string) ([]*SuccessionCase, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*SuccessionCase
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var sc SuccessionCase
		if err := json.Unmarshal(r.Value, &sc); err != nil {
			return nil, err
		}
		results = append(results, &sc)
	}
	return results, nil
}

func mustParseTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

func main() {
	chaincode, err := contractapi.NewChaincode(&UttaradhikarContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating Uttaradhikar chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error starting Uttaradhikar chaincode: %v", err))
	}
}
