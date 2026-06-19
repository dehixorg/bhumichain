package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Data Structures ──────────────────────────────────────────────────────────

type MutationRequest struct {
	MutationID     string `json:"mutationId"`
	DLPIId         string `json:"dlpiId"`
	MutationType   string `json:"mutationType"`   // Sale | Inheritance | Partition | Gift | Court_Order | Correction
	OfficerName    string `json:"officerName"`
	OfficerHash    string `json:"officerAadhaarHash"` // officer accountability — permanent on chain
	OfficerRank    string `json:"officerRank"`        // Patwari | Tahsildar | District Collector
	NewOwnerName   string `json:"newOwnerName"`
	NewOwnerHash   string `json:"newOwnerAadhaarHash"`
	Reason         string `json:"reason"`
	SupportingCID  string `json:"supportingDocCID"` // IPFS CID of mutation supporting document

	Status         string `json:"status"` // see MutationStatus consts

	// Owner consent tracking
	OwnerAlertSentAt  string `json:"ownerAlertSentAt"`
	OwnerAlertChannel string `json:"ownerAlertChannel"` // SMS | WHATSAPP | PUSH | ALL
	OwnerConsentHash  string `json:"ownerConsentHash,omitempty"`
	OwnerConsentAt    string `json:"ownerConsentAt,omitempty"`
	OwnerObjectedAt   string `json:"ownerObjectedAt,omitempty"`
	ObjectionReason   string `json:"objectionReason,omitempty"`

	// For court-ordered mutations — no owner consent required
	CourtOrderNo      string `json:"courtOrderNo,omitempty"`
	CourtOracleHash   string `json:"courtOracleHash,omitempty"` // eCourts API verification hash

	// Public notice (required for partition / inheritance mutations)
	PublicNoticeCID    string `json:"publicNoticeCID,omitempty"`
	PublicNoticeFrom   string `json:"publicNoticeFrom,omitempty"`
	PublicNoticeTill   string `json:"publicNoticeTill,omitempty"` // 30 days
	PublicNoticeObjects int   `json:"publicNoticeObjects"`

	MutationNo     string `json:"mutationNo"`
	InitiatedAt    string `json:"initiatedAt"`
	UpdatedAt      string `json:"updatedAt"`
	ExecutedAt     string `json:"executedAt,omitempty"`
}

// Mutation status constants
const (
	MutStatusDraft              = "DRAFT"
	MutStatusAlertSent          = "OWNER_ALERT_SENT"       // alert fired within 60 seconds
	MutStatusAwaitingConsent    = "AWAITING_OWNER_CONSENT"
	MutStatusOwnerConsented     = "OWNER_CONSENTED"
	MutStatusOwnerObjected      = "OWNER_OBJECTED"          // goes to dispute resolution
	MutStatusPublicNoticePeriod = "PUBLIC_NOTICE_PERIOD"    // 30-day window
	MutStatusPendingExecution   = "PENDING_EXECUTION"
	MutStatusExecuted           = "EXECUTED"
	MutStatusRejected           = "REJECTED"
	MutStatusCourtReferred      = "COURT_REFERRED"
)

// Mutation types requiring public notice (30 days)
var requiresPublicNotice = map[string]bool{
	"Inheritance": true,
	"Partition":   true,
	"Gift":        true,
}

// Mutation types that bypass owner consent (court-ordered)
var courtOrderedTypes = map[string]bool{
	"Court_Order": true,
}

// ─── Smart Contract ───────────────────────────────────────────────────────────

type MutationManagerContract struct {
	contractapi.Contract
}

// InitiateMutation — officer submits mutation request
// This IMMEDIATELY triggers owner alert (event emitted, oracle picks up within 60 sec)
// Endorsement: AND(SRO.member) for initiation; full endorsement at execution
func (c *MutationManagerContract) InitiateMutation(
	ctx contractapi.TransactionContextInterface,
	dlpiId, mutationType, officerName, officerHash, officerRank,
	newOwnerName, newOwnerHash, reason, supportingCID,
	courtOrderNo, courtOracleHash string,
) (string, error) {

	validTypes := map[string]bool{
		"Sale": true, "Inheritance": true, "Partition": true,
		"Gift": true, "Court_Order": true, "Correction": true,
	}
	if !validTypes[mutationType] {
		return "", fmt.Errorf("invalid mutation type: %s", mutationType)
	}

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()

	mutationID := fmt.Sprintf("MUT-%s-%s", dlpiId, txID[:8])
	mutationNo := fmt.Sprintf("MUT/%d/%s", now.Year(), txID[:6])

	// Determine consent requirements
	needsOwnerConsent := !courtOrderedTypes[mutationType]
	needsPublicNotice := requiresPublicNotice[mutationType]

	initialStatus := MutStatusDraft
	if courtOrderedTypes[mutationType] {
		if courtOrderNo == "" || courtOracleHash == "" {
			return "", fmt.Errorf("Court_Order mutations require courtOrderNo and courtOracleHash from eCourts oracle")
		}
		initialStatus = MutStatusPendingExecution
	}

	mutation := MutationRequest{
		MutationID:    mutationID,
		DLPIId:        dlpiId,
		MutationType:  mutationType,
		OfficerName:   officerName,
		OfficerHash:   officerHash,
		OfficerRank:   officerRank,
		NewOwnerName:  newOwnerName,
		NewOwnerHash:  newOwnerHash,
		Reason:        reason,
		SupportingCID: supportingCID,
		Status:        initialStatus,
		CourtOrderNo:  courtOrderNo,
		CourtOracleHash: courtOracleHash,
		PublicNoticeObjects: 0,
		MutationNo:    mutationNo,
		InitiatedAt:   now.Format(time.RFC3339),
		UpdatedAt:     now.Format(time.RFC3339),
	}

	if err := c.saveMutation(ctx, &mutation); err != nil {
		return "", err
	}

	// IMMEDIATELY emit alert event — oracle service picks this up and fires
	// SMS/WhatsApp/push notification to owner within 60 seconds
	if needsOwnerConsent {
		alertEvent, _ := json.Marshal(map[string]interface{}{
			"mutationId":    mutationID,
			"dlpiId":        dlpiId,
			"mutationType":  mutationType,
			"officerName":   officerName,
			"officerRank":   officerRank,
			"newOwnerName":  newOwnerName,
			"reason":        reason,
			"alertChannels": []string{"SMS", "WHATSAPP", "PUSH"},
			"consentDeadline": now.Add(72 * time.Hour).Format(time.RFC3339), // 72hr to respond
			"initiatedAt":   now.Format(time.RFC3339),
		})
		_ = ctx.GetStub().SetEvent("MutationAlertRequired", alertEvent)

		mutation.Status = MutStatusAlertSent
		mutation.OwnerAlertSentAt = now.Format(time.RFC3339)
		mutation.OwnerAlertChannel = "ALL"
	}

	// Start public notice period if required
	if needsPublicNotice {
		noticeFrom := now.Format(time.RFC3339)
		noticeTill := now.Add(30 * 24 * time.Hour).Format(time.RFC3339)
		mutation.PublicNoticeFrom = noticeFrom
		mutation.PublicNoticeTill = noticeTill
		mutation.Status = MutStatusPublicNoticePeriod

		noticeEvent, _ := json.Marshal(map[string]interface{}{
			"mutationId":  mutationID,
			"dlpiId":      dlpiId,
			"noticeFrom":  noticeFrom,
			"noticeTill":  noticeTill,
			"mutationType": mutationType,
		})
		_ = ctx.GetStub().SetEvent("PublicNoticeStarted", noticeEvent)
	}

	// Save updated status
	if err := c.saveMutation(ctx, &mutation); err != nil {
		return "", err
	}

	return mutationID, nil
}

// RecordOwnerAlertDelivery — oracle confirms alert was delivered (≤60 sec SLA)
func (c *MutationManagerContract) RecordOwnerAlertDelivery(
	ctx contractapi.TransactionContextInterface,
	mutationID, channel, deliveryTimestamp string,
) error {
	mutation, err := c.getMutation(ctx, mutationID)
	if err != nil {
		return err
	}

	mutation.OwnerAlertChannel = channel
	mutation.Status = MutStatusAwaitingConsent
	mutation.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Verify 60-second SLA
	alertTime := mustParseTime(mutation.OwnerAlertSentAt)
	deliveredTime := mustParseTime(deliveryTimestamp)
	elapsed := deliveredTime.Sub(alertTime).Seconds()

	// Record SLA metric as event (for BhumiAnalytics dashboard)
	slaEvent, _ := json.Marshal(map[string]interface{}{
		"mutationId":    mutationID,
		"dlpiId":        mutation.DLPIId,
		"alertChannel":  channel,
		"elapsedSeconds": elapsed,
		"slaMet":        elapsed <= 60,
	})
	_ = ctx.GetStub().SetEvent("AlertSLARecorded", slaEvent)

	return c.saveMutation(ctx, mutation)
}

// RecordOwnerConsent — owner provides Aadhaar eSign consent to mutation
func (c *MutationManagerContract) RecordOwnerConsent(
	ctx contractapi.TransactionContextInterface,
	mutationID, ownerAadhaarHash, eSignTxHash string,
) error {
	mutation, err := c.getMutation(ctx, mutationID)
	if err != nil {
		return err
	}

	if mutation.Status != MutStatusAwaitingConsent && mutation.Status != MutStatusPublicNoticePeriod {
		return fmt.Errorf("mutation %s is not awaiting consent (status: %s)", mutationID, mutation.Status)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	mutation.OwnerConsentHash = ownerAadhaarHash
	mutation.OwnerConsentAt = now
	mutation.Status = MutStatusOwnerConsented
	mutation.UpdatedAt = now

	consentEvent, _ := json.Marshal(map[string]string{
		"mutationId": mutationID,
		"dlpiId":     mutation.DLPIId,
		"status":     MutStatusOwnerConsented,
	})
	_ = ctx.GetStub().SetEvent("OwnerConsented", consentEvent)

	return c.saveMutation(ctx, mutation)
}

// RecordOwnerObjection — owner objects to mutation (goes to dispute)
func (c *MutationManagerContract) RecordOwnerObjection(
	ctx contractapi.TransactionContextInterface,
	mutationID, ownerAadhaarHash, objectionReason, evidenceCID string,
) error {
	mutation, err := c.getMutation(ctx, mutationID)
	if err != nil {
		return err
	}

	if mutation.Status != MutStatusAwaitingConsent {
		return fmt.Errorf("mutation %s is not awaiting consent", mutationID)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	mutation.OwnerObjectedAt = now
	mutation.ObjectionReason = objectionReason
	mutation.Status = MutStatusOwnerObjected
	mutation.UpdatedAt = now

	// This auto-suspends the mutation and notifies District Collector
	objectionEvent, _ := json.Marshal(map[string]interface{}{
		"mutationId":      mutationID,
		"dlpiId":          mutation.DLPIId,
		"officerName":     mutation.OfficerName,
		"officerHash":     mutation.OfficerHash, // officer identified permanently
		"officerRank":     mutation.OfficerRank,
		"objectionReason": objectionReason,
		"evidenceCID":     evidenceCID,
		"notifyAuthority": "DISTRICT_COLLECTOR",
	})
	_ = ctx.GetStub().SetEvent("MutationObjectionFiled", objectionEvent)

	return c.saveMutation(ctx, mutation)
}

// RecordPublicNoticeObjection — third party files objection during 30-day public notice
func (c *MutationManagerContract) RecordPublicNoticeObjection(
	ctx contractapi.TransactionContextInterface,
	mutationID, objectorAadhaarHash, objectionText, evidenceCID string,
) error {
	mutation, err := c.getMutation(ctx, mutationID)
	if err != nil {
		return err
	}

	if mutation.Status != MutStatusPublicNoticePeriod {
		return fmt.Errorf("mutation %s is not in public notice period", mutationID)
	}

	// Verify still within notice period
	if mutation.PublicNoticeTill != "" {
		noticeTill := mustParseTime(mutation.PublicNoticeTill)
		if time.Now().UTC().After(noticeTill) {
			return fmt.Errorf("public notice period has expired")
		}
	}

	mutation.PublicNoticeObjects++
	mutation.Status = MutStatusCourtReferred
	mutation.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	objectionEvent, _ := json.Marshal(map[string]interface{}{
		"mutationId":         mutationID,
		"dlpiId":             mutation.DLPIId,
		"objectorHash":       objectorAadhaarHash,
		"objectionText":      objectionText,
		"evidenceCID":        evidenceCID,
		"totalObjections":    mutation.PublicNoticeObjects,
		"referredTo":         "CIVIL_COURT_NASHIK",
		"nyayaAIBriefNeeded": true,
	})
	_ = ctx.GetStub().SetEvent("PublicNoticeObjectionFiled", objectionEvent)

	return c.saveMutation(ctx, mutation)
}

// ExecuteMutation — final execution: writes mutation to DLPI chain
// Endorsement: AND(SRO.member, Tahsildar.member) — two officers must endorse
func (c *MutationManagerContract) ExecuteMutation(
	ctx contractapi.TransactionContextInterface,
	mutationID, finalDocCID string,
) error {
	mutation, err := c.getMutation(ctx, mutationID)
	if err != nil {
		return err
	}

	// Validate execution eligibility
	switch mutation.Status {
	case MutStatusOwnerConsented, MutStatusPendingExecution:
		// Eligible
	case MutStatusPublicNoticePeriod:
		// Check if notice period has passed with no objections
		if mutation.PublicNoticeTill != "" {
			noticeTill := mustParseTime(mutation.PublicNoticeTill)
			if time.Now().UTC().Before(noticeTill) {
				return fmt.Errorf("public notice period not yet complete — expires %s", mutation.PublicNoticeTill)
			}
		}
		if mutation.PublicNoticeObjects > 0 {
			return fmt.Errorf("public notice has %d objection(s) — mutation referred to court", mutation.PublicNoticeObjects)
		}
	default:
		return fmt.Errorf("mutation %s cannot be executed in state: %s", mutationID, mutation.Status)
	}

	now := time.Now().UTC()
	txID := ctx.GetStub().GetTxID()

	// Update DLPI via cross-chaincode call
	updateArgs := [][]byte{
		[]byte("UpdateOwner"),
		[]byte(mutation.DLPIId),
		[]byte(mutation.NewOwnerName),
		[]byte(mutation.NewOwnerHash),
		[]byte(mutation.MutationType),
		[]byte(mutation.OfficerName),
		[]byte(mutation.OfficerHash),
		[]byte(mutation.MutationNo),
		[]byte(finalDocCID),
	}
	updateResp := ctx.GetStub().InvokeChaincode("dlpi", updateArgs, "")
	if updateResp.Status != 200 {
		return fmt.Errorf("DLPI update failed: %s", updateResp.Message)
	}

	mutation.Status = MutStatusExecuted
	mutation.ExecutedAt = now.Format(time.RFC3339)
	mutation.UpdatedAt = now.Format(time.RFC3339)
	mutation.SupportingCID = finalDocCID

	if err := c.saveMutation(ctx, mutation); err != nil {
		return err
	}

	// Emit mutation completed event — triggers 60-second owner notification
	completionEvent, _ := json.Marshal(map[string]interface{}{
		"mutationId":   mutationID,
		"mutationNo":   mutation.MutationNo,
		"dlpiId":       mutation.DLPIId,
		"mutationType": mutation.MutationType,
		"newOwner":     mutation.NewOwnerName,
		"officerName":  mutation.OfficerName,
		"officerHash":  mutation.OfficerHash, // permanently recorded — officer accountability
		"executedAt":   mutation.ExecutedAt,
		"txHash":       txID,
	})
	_ = ctx.GetStub().SetEvent("MutationExecuted", completionEvent)

	return nil
}

// GetMutation — retrieve mutation request by ID
func (c *MutationManagerContract) GetMutation(
	ctx contractapi.TransactionContextInterface,
	mutationID string,
) (*MutationRequest, error) {
	return c.getMutation(ctx, mutationID)
}

// QueryPendingMutations — all mutations awaiting action (officer dashboard)
func (c *MutationManagerContract) QueryPendingMutations(
	ctx contractapi.TransactionContextInterface,
) ([]*MutationRequest, error) {
	query := `{"selector":{"status":{"$in":["AWAITING_OWNER_CONSENT","PENDING_EXECUTION","PUBLIC_NOTICE_PERIOD","OWNER_CONSENTED"]}}}`
	return c.executeQuery(ctx, query)
}

// QueryOfficerMutations — all mutations initiated by a specific officer (accountability audit)
func (c *MutationManagerContract) QueryOfficerMutations(
	ctx contractapi.TransactionContextInterface,
	officerHash string,
) ([]*MutationRequest, error) {
	query := fmt.Sprintf(`{"selector":{"officerAadhaarHash":"%s"}}`, officerHash)
	return c.executeQuery(ctx, query)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

func (c *MutationManagerContract) getMutation(ctx contractapi.TransactionContextInterface, id string) (*MutationRequest, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("state read error: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("mutation %s not found", id)
	}
	var m MutationRequest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &m, nil
}

func (c *MutationManagerContract) saveMutation(ctx contractapi.TransactionContextInterface, m *MutationRequest) error {
	data, err := json.Marshal(m)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return ctx.GetStub().PutState(m.MutationID, data)
}

func (c *MutationManagerContract) executeQuery(ctx contractapi.TransactionContextInterface, query string) ([]*MutationRequest, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*MutationRequest
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var m MutationRequest
		if err := json.Unmarshal(r.Value, &m); err != nil {
			return nil, err
		}
		results = append(results, &m)
	}
	return results, nil
}

func mustParseTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

func main() {
	chaincode, err := contractapi.NewChaincode(&MutationManagerContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating MutationManager chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error starting MutationManager chaincode: %v", err))
	}
}
