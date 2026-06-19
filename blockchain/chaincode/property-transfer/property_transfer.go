package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Data Structures ──────────────────────────────────────────────────────────

type TransferProposal struct {
	TransferID        string          `json:"transferId"`
	DLPIId            string          `json:"dlpiId"`
	SellerAadhaarHash string          `json:"sellerAadhaarHash"`
	BuyerName         string          `json:"buyerName"`
	BuyerAadhaarHash  string          `json:"buyerAadhaarHash"`
	DeclaredValueINR  int64           `json:"declaredValueINR"`
	OracleValueINR    int64           `json:"oracleValueINR"`   // from ValuationOracle
	StampDutyINR      int64           `json:"stampDutyINR"`
	StampDutyPaidTx   string          `json:"stampDutyPaidTx"`  // UPI/NEFT ref
	SaleAgreementCID  string          `json:"saleAgreementCID"` // IPFS CID of signed deed
	Status            string          `json:"status"`           // see TransferStatus consts
	Consents          []PartyConsent  `json:"consents"`
	FraudScore        float64         `json:"fraudScore"`
	FraudSignals      map[string]float64 `json:"fraudSignals,omitempty"`
	PreemptionWindow  *PreemptionInfo `json:"preemptionWindow,omitempty"`
	InitiatedAt       string          `json:"initiatedAt"`
	UpdatedAt         string          `json:"updatedAt"`
	CompletedAt       string          `json:"completedAt,omitempty"`
	SROOfficerHash    string          `json:"sroOfficerHash"`
	MutationNo        string          `json:"mutationNo"`
	NewTitleCID       string          `json:"newTitleCID,omitempty"` // DigiLocker digital title
	RejectionReason   string          `json:"rejectionReason,omitempty"`
}

type PartyConsent struct {
	PartyType    string `json:"partyType"`   // SELLER | BUYER | COPARCENER | SRO | STAMP_DEPT
	Name         string `json:"name"`
	AadhaarHash  string `json:"aadhaarHash"`
	HasConsented bool   `json:"hasConsented"`
	ConsentedAt  string `json:"consentedAt,omitempty"`
	ESignTxHash  string `json:"eSignTxHash,omitempty"`
}

type PreemptionInfo struct {
	IsApplicable     bool     `json:"isApplicable"`
	AdjacentDLPIs    []string `json:"adjacentDlpis"`
	NotifiedOwners   []string `json:"notifiedOwnerHashes"`
	WindowOpensAt    string   `json:"windowOpensAt"`
	WindowClosesAt   string   `json:"windowClosesAt"`  // 7 days
	PreemptionClaimed bool    `json:"preemptionClaimed"`
}

// Transfer status constants
const (
	StatusInitiated       = "INITIATED"
	StatusAwaitingConsent = "AWAITING_CONSENT"
	StatusStampDutyPending = "STAMP_DUTY_PENDING"
	StatusStampDutyPaid   = "STAMP_DUTY_PAID"
	StatusFabricEndorsed  = "FABRIC_ENDORSED"
	StatusCompleted       = "COMPLETED"
	StatusRejectedFraud   = "REJECTED_FRAUD"
	StatusRejectedLock    = "REJECTED_LOCKED"
	StatusRejectedConsent = "REJECTED_CONSENT"
	StatusExpired         = "EXPIRED"
)

// ─── Smart Contract ───────────────────────────────────────────────────────────

type PropertyTransferContract struct {
	contractapi.Contract
}

// InitiateTransfer — Step 1: buyer/seller initiate, places national parcel lock
// Endorsement: AND(SRO.member, Seller.consent, Buyer.consent)
func (c *PropertyTransferContract) InitiateTransfer(
	ctx contractapi.TransactionContextInterface,
	dlpiId, sellerAadhaarHash, buyerName, buyerAadhaarHash string,
	declaredValueINR, oracleValueINR int64,
	sroOfficerHash, preemptionJSON string,
) (string, error) {

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()

	// Compute stamp duty: max(declared, 80% of oracle) × state rate (Maharashtra = 5%)
	effectiveValue := declaredValueINR
	oracleFloor := int64(float64(oracleValueINR) * 0.80)
	if oracleFloor > effectiveValue {
		effectiveValue = oracleFloor
	}
	stampDuty := int64(float64(effectiveValue) * 0.05) // 5% Maharashtra stamp duty

	// Build initial consent list
	consents := []PartyConsent{
		{PartyType: "SELLER", AadhaarHash: sellerAadhaarHash, HasConsented: false},
		{PartyType: "BUYER", Name: buyerName, AadhaarHash: buyerAadhaarHash, HasConsented: false},
		{PartyType: "SRO", AadhaarHash: sroOfficerHash, HasConsented: false},
		{PartyType: "STAMP_DEPT", HasConsented: false}, // auto-consented after UPI confirmation
	}

	// Parse preemption info if provided
	var preemption *PreemptionInfo
	if preemptionJSON != "" && preemptionJSON != "null" {
		preemption = &PreemptionInfo{}
		if err := json.Unmarshal([]byte(preemptionJSON), preemption); err != nil {
			return "", fmt.Errorf("invalid preemption JSON: %w", err)
		}
		if preemption.IsApplicable {
			preemption.WindowOpensAt = now.Format(time.RFC3339)
			preemption.WindowClosesAt = now.Add(7 * 24 * time.Hour).Format(time.RFC3339)
		}
	}

	transferID := fmt.Sprintf("TXF-%s-%s", dlpiId, txID[:8])
	mutationNo := fmt.Sprintf("MUT/%d/%s", now.Year(), txID[:6])

	proposal := TransferProposal{
		TransferID:        transferID,
		DLPIId:            dlpiId,
		SellerAadhaarHash: sellerAadhaarHash,
		BuyerName:         buyerName,
		BuyerAadhaarHash:  buyerAadhaarHash,
		DeclaredValueINR:  declaredValueINR,
		OracleValueINR:    oracleValueINR,
		StampDutyINR:      stampDuty,
		Status:            StatusInitiated,
		Consents:          consents,
		FraudScore:        0,
		PreemptionWindow:  preemption,
		InitiatedAt:       now.Format(time.RFC3339),
		UpdatedAt:         now.Format(time.RFC3339),
		SROOfficerHash:    sroOfficerHash,
		MutationNo:        mutationNo,
	}

	// Save proposal to state
	if err := c.saveProposal(ctx, &proposal); err != nil {
		return "", err
	}

	// Place national parcel lock via DLPI chaincode cross-call
	lockArgs := [][]byte{
		[]byte("SetTransferLock"),
		[]byte(dlpiId),
		[]byte(txID),
	}
	lockResponse := ctx.GetStub().InvokeChaincode("dlpi", lockArgs, "")
	if lockResponse.Status != 200 {
		// Roll back proposal if lock fails
		_ = ctx.GetStub().DelState(transferID)
		return "", fmt.Errorf("LOCK_FAILED: %s", lockResponse.Message)
	}

	// Emit event for frontend — both terminals will see the lock
	event, _ := json.Marshal(map[string]interface{}{
		"transferId":   transferID,
		"dlpiId":       dlpiId,
		"status":       StatusInitiated,
		"stampDutyINR": stampDuty,
		"lockedAt":     now.Format(time.RFC3339),
		"expiresAt":    now.Add(24 * time.Hour).Format(time.RFC3339),
	})
	_ = ctx.GetStub().SetEvent("TransferInitiated", event)

	return transferID, nil
}

// RecordFraudScore — Step 2: FraudSense oracle submits anomaly score before consents collected
func (c *PropertyTransferContract) RecordFraudScore(
	ctx contractapi.TransactionContextInterface,
	transferID string,
	fraudScore float64,
	fraudSignalsJSON string,
) error {
	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}

	var signals map[string]float64
	if fraudSignalsJSON != "" {
		_ = json.Unmarshal([]byte(fraudSignalsJSON), &signals)
	}

	proposal.FraudScore = fraudScore
	proposal.FraudSignals = signals
	proposal.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Auto-reject if fraud score critically high
	if fraudScore >= 0.90 {
		proposal.Status = StatusRejectedFraud
		proposal.RejectionReason = fmt.Sprintf(
			"FraudSense score %.2f exceeds threshold 0.90. Transaction auto-escalated to I-T Department. "+
				"This attempt has been permanently recorded on-chain.", fraudScore)

		// Release the parcel lock
		_ = c.releaseLock(ctx, proposal.DLPIId)

		event, _ := json.Marshal(map[string]interface{}{
			"transferId":      transferID,
			"dlpiId":          proposal.DLPIId,
			"fraudScore":      fraudScore,
			"rejectionReason": proposal.RejectionReason,
			"escalatedToIT":   true,
		})
		_ = ctx.GetStub().SetEvent("TransferRejectedFraud", event)
	}

	return c.saveProposal(ctx, proposal)
}

// RecordConsent — Step 3: any party records their Aadhaar eSign consent
func (c *PropertyTransferContract) RecordConsent(
	ctx contractapi.TransactionContextInterface,
	transferID, partyType, aadhaarHash, eSignTxHash string,
) error {
	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}

	if proposal.Status == StatusRejectedFraud || proposal.Status == StatusCompleted {
		return fmt.Errorf("transfer %s is in terminal state: %s", transferID, proposal.Status)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	found := false

	for i, consent := range proposal.Consents {
		if consent.PartyType == partyType {
			// Verify aadhaar hash matches (seller/buyer/coparcener verification)
			if partyType != "STAMP_DEPT" && partyType != "SRO" && consent.AadhaarHash != aadhaarHash {
				return fmt.Errorf("aadhaar hash mismatch for party type %s — consent rejected", partyType)
			}
			proposal.Consents[i].HasConsented = true
			proposal.Consents[i].ConsentedAt = now
			proposal.Consents[i].ESignTxHash = eSignTxHash
			found = true
			break
		}
	}

	if !found {
		// May be a coparcener consent — add dynamically
		proposal.Consents = append(proposal.Consents, PartyConsent{
			PartyType:    "COPARCENER",
			AadhaarHash:  aadhaarHash,
			HasConsented: true,
			ConsentedAt:  now,
			ESignTxHash:  eSignTxHash,
		})
	}

	// Check if all required parties have consented
	if c.allRequiredConsentsGiven(proposal) {
		proposal.Status = StatusStampDutyPending
		event, _ := json.Marshal(map[string]string{
			"transferId": transferID,
			"status":     StatusStampDutyPending,
			"nextStep":   "PAY_STAMP_DUTY",
		})
		_ = ctx.GetStub().SetEvent("AllConsentsReceived", event)
	} else {
		proposal.Status = StatusAwaitingConsent
	}

	proposal.UpdatedAt = now
	return c.saveProposal(ctx, proposal)
}

// ConfirmStampDutyPayment — Step 4: stamp duty oracle confirms UPI/NEFT payment
func (c *PropertyTransferContract) ConfirmStampDutyPayment(
	ctx contractapi.TransactionContextInterface,
	transferID, upiRefNo, saleAgreementCID string,
) error {
	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}

	if proposal.Status != StatusStampDutyPending {
		return fmt.Errorf("transfer %s is not in STAMP_DUTY_PENDING state (current: %s)",
			transferID, proposal.Status)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	proposal.StampDutyPaidTx = upiRefNo
	proposal.SaleAgreementCID = saleAgreementCID
	proposal.Status = StatusStampDutyPaid

	// Auto-consent stamp department
	for i, consent := range proposal.Consents {
		if consent.PartyType == "STAMP_DEPT" {
			proposal.Consents[i].HasConsented = true
			proposal.Consents[i].ConsentedAt = now
			proposal.Consents[i].ESignTxHash = upiRefNo
			break
		}
	}

	proposal.UpdatedAt = now

	event, _ := json.Marshal(map[string]interface{}{
		"transferId":    transferID,
		"stampDutyPaid": proposal.StampDutyINR,
		"upiRef":        upiRefNo,
		"agreementCID":  saleAgreementCID,
	})
	_ = ctx.GetStub().SetEvent("StampDutyConfirmed", event)

	return c.saveProposal(ctx, proposal)
}

// ExecuteTransfer — Step 5: final execution after all endorsements collected
// This is the atomic commit — all state changes happen in one transaction
// Endorsement: AND(SRO.member, StampDept.member)
func (c *PropertyTransferContract) ExecuteTransfer(
	ctx contractapi.TransactionContextInterface,
	transferID, newTitleCID string,
) error {
	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}

	if proposal.Status != StatusStampDutyPaid && proposal.Status != StatusFabricEndorsed {
		return fmt.Errorf("transfer %s cannot be executed — current status: %s", transferID, proposal.Status)
	}

	if proposal.FraudScore >= 0.75 && proposal.FraudScore < 0.90 {
		// Score in review range — require manual override from Revenue HQ
		return fmt.Errorf("FRAUD_REVIEW_PENDING: FraudSense score %.2f requires Revenue HQ manual approval",
			proposal.FraudScore)
	}

	// Final validation: all required consents
	if !c.allRequiredConsentsGiven(proposal) {
		return fmt.Errorf("CONSENT_INCOMPLETE: not all required parties have consented")
	}

	now := time.Now().UTC()
	txID := ctx.GetStub().GetTxID()

	// Update DLPI owner via cross-chaincode call
	updateArgs := [][]byte{
		[]byte("UpdateOwner"),
		[]byte(proposal.DLPIId),
		[]byte(proposal.BuyerName),
		[]byte(proposal.BuyerAadhaarHash),
		[]byte("Sale"),
		[]byte("SRO Officer"),
		[]byte(proposal.SROOfficerHash),
		[]byte(proposal.MutationNo),
		[]byte(proposal.SaleAgreementCID),
	}
	updateResponse := ctx.GetStub().InvokeChaincode("dlpi", updateArgs, "")
	if updateResponse.Status != 200 {
		return fmt.Errorf("DLPI update failed: %s", updateResponse.Message)
	}

	// Mark transfer complete
	proposal.Status = StatusCompleted
	proposal.NewTitleCID = newTitleCID
	proposal.CompletedAt = now.Format(time.RFC3339)
	proposal.UpdatedAt = now.Format(time.RFC3339)

	if err := c.saveProposal(ctx, proposal); err != nil {
		return err
	}

	// Emit completion event — triggers DigiLocker title delivery, owner notification
	completionEvent, _ := json.Marshal(map[string]interface{}{
		"transferId":      transferID,
		"dlpiId":          proposal.DLPIId,
		"newOwner":        proposal.BuyerName,
		"newOwnerHash":    proposal.BuyerAadhaarHash,
		"mutationNo":      proposal.MutationNo,
		"newTitleCID":     newTitleCID,
		"stampDutyPaid":   proposal.StampDutyINR,
		"txHash":          txID,
		"completedAt":     proposal.CompletedAt,
		"processingTimeSec": now.Unix() - mustParseTime(proposal.InitiatedAt).Unix(),
	})
	_ = ctx.GetStub().SetEvent("TransferCompleted", completionEvent)

	return nil
}

// RejectTransfer — rejects and releases lock (e.g., fraud, timeout, seller withdrawal)
func (c *PropertyTransferContract) RejectTransfer(
	ctx contractapi.TransactionContextInterface,
	transferID, reason, rejectorHash string,
) error {
	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}

	if proposal.Status == StatusCompleted {
		return fmt.Errorf("cannot reject a completed transfer")
	}

	proposal.Status = StatusRejectedConsent
	proposal.RejectionReason = reason
	proposal.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	// Release the parcel lock
	if err := c.releaseLock(ctx, proposal.DLPIId); err != nil {
		return err
	}

	event, _ := json.Marshal(map[string]string{
		"transferId": transferID,
		"dlpiId":     proposal.DLPIId,
		"reason":     reason,
	})
	_ = ctx.GetStub().SetEvent("TransferRejected", event)

	return c.saveProposal(ctx, proposal)
}

// GetTransferProposal — retrieve a transfer by ID
func (c *PropertyTransferContract) GetTransferProposal(
	ctx contractapi.TransactionContextInterface,
	transferID string,
) (*TransferProposal, error) {
	return c.getProposal(ctx, transferID)
}

// QueryTransfersByDLPI — all transfers for a parcel (CouchDB rich query)
func (c *PropertyTransferContract) QueryTransfersByDLPI(
	ctx contractapi.TransactionContextInterface,
	dlpiId string,
) ([]*TransferProposal, error) {
	query := fmt.Sprintf(`{"selector":{"dlpiId":"%s"}}`, dlpiId)
	return c.executeQuery(ctx, query)
}

// QueryActiveTransfers — all in-progress transfers (for dashboard)
func (c *PropertyTransferContract) QueryActiveTransfers(
	ctx contractapi.TransactionContextInterface,
) ([]*TransferProposal, error) {
	query := `{"selector":{"status":{"$nin":["COMPLETED","REJECTED_FRAUD","REJECTED_CONSENT","EXPIRED"]}}}`
	return c.executeQuery(ctx, query)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

func (c *PropertyTransferContract) allRequiredConsentsGiven(p *TransferProposal) bool {
	required := map[string]bool{"SELLER": false, "BUYER": false, "SRO": false}
	for _, consent := range p.Consents {
		if _, isRequired := required[consent.PartyType]; isRequired {
			if consent.HasConsented {
				required[consent.PartyType] = true
			}
		}
	}
	for _, consented := range required {
		if !consented {
			return false
		}
	}
	return true
}

func (c *PropertyTransferContract) releaseLock(ctx contractapi.TransactionContextInterface, dlpiId string) error {
	args := [][]byte{[]byte("ReleaseTransferLock"), []byte(dlpiId)}
	resp := ctx.GetStub().InvokeChaincode("dlpi", args, "")
	if resp.Status != 200 {
		return fmt.Errorf("lock release failed: %s", resp.Message)
	}
	return nil
}

func (c *PropertyTransferContract) getProposal(ctx contractapi.TransactionContextInterface, transferID string) (*TransferProposal, error) {
	data, err := ctx.GetStub().GetState(transferID)
	if err != nil {
		return nil, fmt.Errorf("state read error: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("transfer %s not found", transferID)
	}
	var p TransferProposal
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &p, nil
}

func (c *PropertyTransferContract) saveProposal(ctx contractapi.TransactionContextInterface, p *TransferProposal) error {
	data, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return ctx.GetStub().PutState(p.TransferID, data)
}

func (c *PropertyTransferContract) executeQuery(ctx contractapi.TransactionContextInterface, query string) ([]*TransferProposal, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*TransferProposal
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var p TransferProposal
		if err := json.Unmarshal(r.Value, &p); err != nil {
			return nil, err
		}
		results = append(results, &p)
	}
	return results, nil
}

func mustParseTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

func main() {
	chaincode, err := contractapi.NewChaincode(&PropertyTransferContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating PropertyTransfer chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error starting PropertyTransfer chaincode: %v", err))
	}
}
