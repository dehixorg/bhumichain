package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Transfer Types ───────────────────────────────────────────────────────────
//
// FULL_SALE:   ALL current owners sell together → one or more buyers take 100% of parcel.
//              Every current owner MUST consent. Most common for single-owner parcels.
//
// SHARE_SALE:  ONE co-owner sells only their share to an outsider.
//              Preemption right: other co-owners get 30 days to buy at same price first.
//              (UP Revenue Code 2006 S.54)
//              Only the selling co-owner + buyer need to consent.
//              Non-selling co-owners either exercise preemption OR waive within 30 days.
//
// GIFT:        Same as FULL_SALE but zero or nominal consideration.
//              Stamp duty: UP gift deed rate (different from sale deed rate).

const (
	TransferTypeFull  = "FULL_SALE"
	TransferTypeShare = "SHARE_SALE"
	TransferTypeGift  = "GIFT"
)

// ─── Data Structures ─────────────────────────────────────────────────────────

// TransferParty — a seller or buyer in a transfer, with their share info
type TransferParty struct {
	AadhaarHash   string  `json:"aadhaarHash"`
	Name          string  `json:"name"`
	ShareFraction string  `json:"shareFraction"` // "1/3", "1/2" etc.
	ShareDecimal  float64 `json:"shareDecimal"`
	HasConsented  bool    `json:"hasConsented"`
	ConsentedAt   string  `json:"consentedAt,omitempty"`
	ESignTxHash   string  `json:"eSignTxHash,omitempty"`
}

// PreemptionRecord — tracks co-owner preemption rights for SHARE_SALE
type PreemptionRecord struct {
	IsApplicable      bool     `json:"isApplicable"`
	CoOwnerHashes     []string `json:"coOwnerHashes"`    // co-owners notified
	Waivers           []string `json:"waivers"`          // co-owners who waived
	PreemptionClaimed string   `json:"preemptionClaimed,omitempty"` // hash of co-owner exercising preemption
	WindowOpensAt     string   `json:"windowOpensAt"`
	WindowClosesAt    string   `json:"windowClosesAt"` // 30 days (UP Rev Code S.54)
	Resolved          bool     `json:"resolved"`        // true when window passed or preemption exercised
}

// TransferProposal — the main transfer record
type TransferProposal struct {
	TransferID   string `json:"transferId"`
	DLPIId       string `json:"dlpiId"`
	TransferType string `json:"transferType"` // FULL_SALE | SHARE_SALE | GIFT

	// Who is selling (with their shares)
	Sellers []TransferParty `json:"sellers"`
	// Who is buying (with their new shares after transfer)
	Buyers []TransferParty `json:"buyers"`

	// Preemption — only relevant for SHARE_SALE
	Preemption *PreemptionRecord `json:"preemption,omitempty"`

	// Endorsing officer (Tehsildar acts as SRO for demo)
	OfficerHash string `json:"officerHash"`

	// Financial
	DeclaredValueINR int64  `json:"declaredValueINR"`
	OracleValueINR   int64  `json:"oracleValueINR"`
	StampDutyINR     int64  `json:"stampDutyINR"`
	StampDutyPaidTx  string `json:"stampDutyPaidTx,omitempty"`
	SaleAgreementCID string `json:"saleAgreementCID,omitempty"`

	// Fraud
	FraudScore   float64            `json:"fraudScore"`
	FraudSignals map[string]float64 `json:"fraudSignals,omitempty"`

	// Status tracking
	Status          string `json:"status"`
	RejectionReason string `json:"rejectionReason,omitempty"`
	MutationNo      string `json:"mutationNo"`
	NewTitleCID     string `json:"newTitleCID,omitempty"`

	InitiatedAt string `json:"initiatedAt"`
	UpdatedAt   string `json:"updatedAt"`
	CompletedAt string `json:"completedAt,omitempty"`
}

// Transfer status constants
const (
	StatusInitiated            = "INITIATED"
	StatusPreemptionWindow     = "PREEMPTION_WINDOW" // SHARE_SALE only
	StatusAwaitingConsent      = "AWAITING_CONSENT"
	StatusStampDutyPending     = "STAMP_DUTY_PENDING"
	StatusStampDutyPaid        = "STAMP_DUTY_PAID"
	StatusCompleted            = "COMPLETED"
	StatusRejectedFraud        = "REJECTED_FRAUD"
	StatusRejectedLocked       = "REJECTED_LOCKED"
	StatusRejectedConsent      = "REJECTED_CONSENT"
	StatusPreemptionExercised  = "PREEMPTION_EXERCISED" // co-owner bought the share instead
	StatusExpired              = "EXPIRED"
)

// ─── Smart Contract ───────────────────────────────────────────────────────────

type PropertyTransferContract struct {
	contractapi.Contract
}

// InitiateTransfer — Step 1: start a transfer proposal and place national parcel lock
//
// sellersJSON:  JSON array of TransferParty (the owners selling — all for FULL_SALE, one for SHARE_SALE)
// buyersJSON:   JSON array of TransferParty (the buyers and their incoming shares)
// coOwnerHashesJSON: JSON array of strings — other co-owners (for preemption notification in SHARE_SALE)
func (c *PropertyTransferContract) InitiateTransfer(
	ctx contractapi.TransactionContextInterface,
	dlpiId, transferType,
	sellersJSON, buyersJSON,
	officerHash,
	coOwnerHashesJSON string,
	declaredValueINR, oracleValueINR int64,
) (string, error) {

	now := time.Now().UTC()
	txID := ctx.GetStub().GetTxID()

	// Validate transfer type
	if transferType != TransferTypeFull && transferType != TransferTypeShare && transferType != TransferTypeGift {
		return "", fmt.Errorf("invalid transferType: %s", transferType)
	}

	var sellers []TransferParty
	if err := json.Unmarshal([]byte(sellersJSON), &sellers); err != nil {
		return "", fmt.Errorf("invalid sellers JSON: %w", err)
	}
	if len(sellers) == 0 {
		return "", fmt.Errorf("at least one seller required")
	}

	var buyers []TransferParty
	if err := json.Unmarshal([]byte(buyersJSON), &buyers); err != nil {
		return "", fmt.Errorf("invalid buyers JSON: %w", err)
	}
	if len(buyers) == 0 {
		return "", fmt.Errorf("at least one buyer required")
	}

	// Validate buyer shares sum to the total share being sold
	if err := validateBuyerShares(sellers, buyers, transferType); err != nil {
		return "", err
	}

	// Stamp duty: UP residential = 7%, agricultural = 5%
	// Use max(declared, 80% of oracle)
	effectiveValue := declaredValueINR
	if floor := int64(float64(oracleValueINR) * 0.80); floor > effectiveValue {
		effectiveValue = floor
	}
	stampDutyRate := 0.07 // UP default; caller should pass correct rate
	if transferType == TransferTypeGift {
		stampDutyRate = 0.02 // UP gift deed rate
	}
	stampDuty := int64(float64(effectiveValue) * stampDutyRate)

	// Build preemption record for SHARE_SALE
	var preemption *PreemptionRecord
	if transferType == TransferTypeShare {
		var coOwnerHashes []string
		if coOwnerHashesJSON != "" && coOwnerHashesJSON != "[]" {
			_ = json.Unmarshal([]byte(coOwnerHashesJSON), &coOwnerHashes)
		}
		if len(coOwnerHashes) > 0 {
			preemption = &PreemptionRecord{
				IsApplicable:  true,
				CoOwnerHashes: coOwnerHashes,
				Waivers:       []string{},
				WindowOpensAt: now.Format(time.RFC3339),
				// 30-day preemption window per UP Revenue Code 2006 S.54
				WindowClosesAt: now.Add(30 * 24 * time.Hour).Format(time.RFC3339),
				Resolved:       false,
			}
		}
	}

	transferID := fmt.Sprintf("TXF-%s-%s", dlpiId, txID[:8])
	mutationNo := fmt.Sprintf("MUT/%d/%s", now.Year(), txID[:6])

	proposal := TransferProposal{
		TransferID:       transferID,
		DLPIId:           dlpiId,
		TransferType:     transferType,
		Sellers:          sellers,
		Buyers:           buyers,
		Preemption:       preemption,
		OfficerHash:      officerHash,
		DeclaredValueINR: declaredValueINR,
		OracleValueINR:   oracleValueINR,
		StampDutyINR:     stampDuty,
		FraudScore:       0,
		MutationNo:       mutationNo,
		InitiatedAt:      now.Format(time.RFC3339),
		UpdatedAt:        now.Format(time.RFC3339),
	}

	// Determine initial status
	if preemption != nil && preemption.IsApplicable {
		proposal.Status = StatusPreemptionWindow
	} else {
		proposal.Status = StatusInitiated
	}

	if err := c.saveProposal(ctx, &proposal); err != nil {
		return "", err
	}

	// Place national parcel lock via DLPI cross-chaincode call
	lockArgs := [][]byte{[]byte("SetTransferLock"), []byte(dlpiId), []byte(txID)}
	if resp := ctx.GetStub().InvokeChaincode("dlpi", lockArgs, ""); resp.Status != 200 {
		_ = ctx.GetStub().DelState(transferID)
		return "", fmt.Errorf("LOCK_FAILED: %s", resp.Message)
	}

	event, _ := json.Marshal(map[string]interface{}{
		"transferId": transferID, "dlpiId": dlpiId,
		"transferType": transferType, "sellers": len(sellers), "buyers": len(buyers),
		"stampDutyINR": stampDuty, "status": proposal.Status,
		"preemptionWindow": preemption != nil,
	})
	_ = ctx.GetStub().SetEvent("TransferInitiated", event)

	return transferID, nil
}

// WaivePreemption — co-owner waives their 30-day preemption right for a SHARE_SALE
func (c *PropertyTransferContract) WaivePreemption(
	ctx contractapi.TransactionContextInterface,
	transferID, coOwnerAadhaarHash, eSignTxHash string,
) error {

	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}
	if proposal.Status != StatusPreemptionWindow {
		return fmt.Errorf("transfer %s is not in PREEMPTION_WINDOW state", transferID)
	}
	if proposal.Preemption == nil {
		return fmt.Errorf("no preemption record on transfer %s", transferID)
	}

	// Verify this hash is a registered co-owner for preemption
	isCoOwner := false
	for _, h := range proposal.Preemption.CoOwnerHashes {
		if h == coOwnerAadhaarHash {
			isCoOwner = true
			break
		}
	}
	if !isCoOwner {
		return fmt.Errorf("aadhaar hash not in preemption co-owner list")
	}

	// Already waived?
	for _, w := range proposal.Preemption.Waivers {
		if w == coOwnerAadhaarHash {
			return fmt.Errorf("preemption already waived by this co-owner")
		}
	}

	proposal.Preemption.Waivers = append(proposal.Preemption.Waivers, coOwnerAadhaarHash)

	// If all co-owners have waived, move to consent collection
	if len(proposal.Preemption.Waivers) >= len(proposal.Preemption.CoOwnerHashes) {
		proposal.Preemption.Resolved = true
		proposal.Status = StatusInitiated
		event, _ := json.Marshal(map[string]string{
			"transferId": transferID, "status": "ALL_PREEMPTION_WAIVED",
		})
		_ = ctx.GetStub().SetEvent("PreemptionResolved", event)
	}

	proposal.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveProposal(ctx, proposal)
}

// ExercisePreemption — co-owner exercises preemption (buys the share themselves)
// This converts the transfer into an internal transfer to the co-owner
func (c *PropertyTransferContract) ExercisePreemption(
	ctx contractapi.TransactionContextInterface,
	transferID, coOwnerAadhaarHash, eSignTxHash string,
) error {

	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}
	if proposal.Status != StatusPreemptionWindow {
		return fmt.Errorf("preemption window has closed")
	}

	// Convert buyer to the co-owner exercising preemption
	// Share and price remain the same as the original sale
	isCoOwner := false
	for _, h := range proposal.Preemption.CoOwnerHashes {
		if h == coOwnerAadhaarHash {
			isCoOwner = true
			break
		}
	}
	if !isCoOwner {
		return fmt.Errorf("only a registered co-owner can exercise preemption")
	}

	// Replace buyer with the preempting co-owner
	// Share fraction stays the same as the original seller's share
	sellerShare := proposal.Sellers[0].ShareFraction
	sellerShareDec := proposal.Sellers[0].ShareDecimal
	proposal.Buyers = []TransferParty{{
		AadhaarHash:   coOwnerAadhaarHash,
		Name:          "Co-owner (preemption)",
		ShareFraction: sellerShare,
		ShareDecimal:  sellerShareDec,
		HasConsented:  true,
		ConsentedAt:   time.Now().UTC().Format(time.RFC3339),
		ESignTxHash:   eSignTxHash,
	}}
	proposal.Preemption.PreemptionClaimed = coOwnerAadhaarHash
	proposal.Preemption.Resolved = true
	proposal.Status = StatusPreemptionExercised
	proposal.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	event, _ := json.Marshal(map[string]string{
		"transferId": transferID, "exercisedBy": coOwnerAadhaarHash,
	})
	_ = ctx.GetStub().SetEvent("PreemptionExercised", event)
	return c.saveProposal(ctx, proposal)
}

// RecordFraudScore — Step 2: FraudSense oracle submits score
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

	if fraudScore >= 0.90 {
		proposal.Status = StatusRejectedFraud
		proposal.RejectionReason = fmt.Sprintf(
			"FraudSense score %.2f ≥ 0.90 threshold. Auto-escalated to I-T Dept. "+
				"Permanently recorded on-chain.", fraudScore)
		_ = c.releaseLock(ctx, proposal.DLPIId)
		event, _ := json.Marshal(map[string]interface{}{
			"transferId": transferID, "fraudScore": fraudScore, "escalated": true,
		})
		_ = ctx.GetStub().SetEvent("TransferRejectedFraud", event)
	}

	return c.saveProposal(ctx, proposal)
}

// RecordConsent — Step 3: any seller or buyer records their Aadhaar eSign
func (c *PropertyTransferContract) RecordConsent(
	ctx contractapi.TransactionContextInterface,
	transferID, partyRole, aadhaarHash, eSignTxHash string,
) error {
	// partyRole: "SELLER" | "BUYER" | "OFFICER"

	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}
	if isTerminal(proposal.Status) {
		return fmt.Errorf("transfer %s is in terminal state: %s", transferID, proposal.Status)
	}
	if proposal.Status == StatusPreemptionWindow {
		return fmt.Errorf("cannot collect consent while preemption window is open")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	found := false

	switch partyRole {
	case "SELLER":
		for i, s := range proposal.Sellers {
			if s.AadhaarHash == aadhaarHash {
				proposal.Sellers[i].HasConsented = true
				proposal.Sellers[i].ConsentedAt = now
				proposal.Sellers[i].ESignTxHash = eSignTxHash
				found = true
				break
			}
		}
	case "BUYER":
		for i, b := range proposal.Buyers {
			if b.AadhaarHash == aadhaarHash {
				proposal.Buyers[i].HasConsented = true
				proposal.Buyers[i].ConsentedAt = now
				proposal.Buyers[i].ESignTxHash = eSignTxHash
				found = true
				break
			}
		}
	case "OFFICER":
		// Officer endorsement is stored separately but treated as consent
		proposal.OfficerHash = aadhaarHash
		found = true
	}

	if !found {
		return fmt.Errorf("aadhaarHash %s not found as %s in transfer %s", aadhaarHash, partyRole, transferID)
	}

	if c.allConsentsGiven(proposal) {
		proposal.Status = StatusStampDutyPending
		event, _ := json.Marshal(map[string]string{
			"transferId": transferID, "status": StatusStampDutyPending,
		})
		_ = ctx.GetStub().SetEvent("AllConsentsReceived", event)
	} else {
		proposal.Status = StatusAwaitingConsent
	}

	proposal.UpdatedAt = now
	return c.saveProposal(ctx, proposal)
}

// ConfirmStampDutyPayment — Step 4: stamp duty oracle confirms UPI payment
func (c *PropertyTransferContract) ConfirmStampDutyPayment(
	ctx contractapi.TransactionContextInterface,
	transferID, upiRefNo, saleAgreementCID string,
) error {

	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}
	if proposal.Status != StatusStampDutyPending {
		return fmt.Errorf("transfer %s not in STAMP_DUTY_PENDING (current: %s)", transferID, proposal.Status)
	}

	proposal.StampDutyPaidTx = upiRefNo
	proposal.SaleAgreementCID = saleAgreementCID
	proposal.Status = StatusStampDutyPaid
	proposal.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	event, _ := json.Marshal(map[string]interface{}{
		"transferId": transferID, "stampDutyINR": proposal.StampDutyINR, "upiRef": upiRefNo,
	})
	_ = ctx.GetStub().SetEvent("StampDutyConfirmed", event)

	return c.saveProposal(ctx, proposal)
}

// ExecuteTransfer — Step 5: atomic final execution
// Removes sellers from DLPI.Owners[], adds buyers — all in one Fabric transaction
func (c *PropertyTransferContract) ExecuteTransfer(
	ctx contractapi.TransactionContextInterface,
	transferID, newTitleCID string,
) error {

	proposal, err := c.getProposal(ctx, transferID)
	if err != nil {
		return err
	}

	if proposal.Status != StatusStampDutyPaid {
		return fmt.Errorf("transfer %s not ready for execution (status: %s)", transferID, proposal.Status)
	}
	if proposal.FraudScore >= 0.75 && proposal.FraudScore < 0.90 {
		return fmt.Errorf("FRAUD_REVIEW_PENDING: score %.2f needs manual Revenue HQ approval", proposal.FraudScore)
	}
	if !c.allConsentsGiven(proposal) {
		return fmt.Errorf("CONSENT_INCOMPLETE: not all required parties have consented")
	}

	now := time.Now().UTC()
	txID := ctx.GetStub().GetTxID()

	// Build seller hashes list for DLPI removal
	sellerHashes := make([]string, len(proposal.Sellers))
	for i, s := range proposal.Sellers {
		sellerHashes[i] = s.AadhaarHash
	}

	// Build CoOwner structs for new buyers
	// We pass these as JSON — DLPI chaincode will add OwnerSince + IsVerified
	type CoOwnerInput struct {
		AadhaarHash   string  `json:"aadhaarHash"`
		Name          string  `json:"name"`
		Share         string  `json:"share"`
		ShareDecimal  float64 `json:"shareDecimal"`
		IsTribal      bool    `json:"isTribal"`
	}
	newBuyerInputs := make([]CoOwnerInput, len(proposal.Buyers))
	for i, b := range proposal.Buyers {
		newBuyerInputs[i] = CoOwnerInput{
			AadhaarHash:  b.AadhaarHash,
			Name:         b.Name,
			Share:        b.ShareFraction,
			ShareDecimal: b.ShareDecimal,
		}
	}

	sellerHashesJSON, _ := json.Marshal(sellerHashes)
	newBuyersJSON, _ := json.Marshal(newBuyerInputs)
	description := fmt.Sprintf("%s: %d seller(s) → %d buyer(s)", proposal.TransferType,
		len(proposal.Sellers), len(proposal.Buyers))

	// Cross-chaincode call: UpdateOwners on DLPI chaincode
	updateArgs := [][]byte{
		[]byte("UpdateOwners"),
		[]byte(proposal.DLPIId),
		sellerHashesJSON,
		newBuyersJSON,
		[]byte("Sale"),
		[]byte("Officer"),
		[]byte(proposal.OfficerHash),
		[]byte(proposal.MutationNo),
		[]byte(proposal.SaleAgreementCID),
		[]byte(description),
	}
	if resp := ctx.GetStub().InvokeChaincode("dlpi", updateArgs, ""); resp.Status != 200 {
		return fmt.Errorf("DLPI UpdateOwners failed: %s", resp.Message)
	}

	proposal.Status = StatusCompleted
	proposal.NewTitleCID = newTitleCID
	proposal.CompletedAt = now.Format(time.RFC3339)
	proposal.UpdatedAt = now.Format(time.RFC3339)

	if err := c.saveProposal(ctx, proposal); err != nil {
		return err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"transferId":  transferID,
		"dlpiId":      proposal.DLPIId,
		"sellers":     proposal.Sellers,
		"buyers":      proposal.Buyers,
		"mutationNo":  proposal.MutationNo,
		"newTitleCID": newTitleCID,
		"txHash":      txID,
		"completedAt": proposal.CompletedAt,
	})
	_ = ctx.GetStub().SetEvent("TransferCompleted", event)

	return nil
}

// RejectTransfer — any party can reject; releases the parcel lock
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

	_ = c.releaseLock(ctx, proposal.DLPIId)

	event, _ := json.Marshal(map[string]string{
		"transferId": transferID, "dlpiId": proposal.DLPIId, "reason": reason,
	})
	_ = ctx.GetStub().SetEvent("TransferRejected", event)

	return c.saveProposal(ctx, proposal)
}

// GetTransferProposal — retrieve by ID
func (c *PropertyTransferContract) GetTransferProposal(
	ctx contractapi.TransactionContextInterface, transferID string,
) (*TransferProposal, error) {
	return c.getProposal(ctx, transferID)
}

// QueryTransfersByDLPI — all transfers for a parcel
func (c *PropertyTransferContract) QueryTransfersByDLPI(
	ctx contractapi.TransactionContextInterface, dlpiId string,
) ([]*TransferProposal, error) {
	query := fmt.Sprintf(`{"selector":{"dlpiId":"%s"}}`, dlpiId)
	return c.executeQuery(ctx, query)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

// allConsentsGiven — true when every seller, every buyer, and the officer has consented
func (c *PropertyTransferContract) allConsentsGiven(p *TransferProposal) bool {
	for _, s := range p.Sellers {
		if !s.HasConsented {
			return false
		}
	}
	for _, b := range p.Buyers {
		if !b.HasConsented {
			return false
		}
	}
	// Officer hash must be set
	if p.OfficerHash == "" {
		return false
	}
	return true
}

// validateBuyerShares — buyers must collectively receive the same total share the sellers are giving up
func validateBuyerShares(sellers []TransferParty, buyers []TransferParty, transferType string) error {
	var sellerTotal, buyerTotal float64
	for _, s := range sellers {
		sellerTotal += s.ShareDecimal
	}
	for _, b := range buyers {
		if b.ShareDecimal <= 0 {
			return fmt.Errorf("buyer %s has invalid share decimal: %f", b.AadhaarHash, b.ShareDecimal)
		}
		buyerTotal += b.ShareDecimal
	}
	if transferType == TransferTypeFull {
		// For full sale, sellers must be giving up 100%
		if sellerTotal < 0.999 || sellerTotal > 1.001 {
			return fmt.Errorf("FULL_SALE: sellers' total share must be 1.0, got %f", sellerTotal)
		}
	}
	// Buyer total must equal seller total (they're absorbing exactly what sellers give up)
	if buyerTotal < sellerTotal-0.001 || buyerTotal > sellerTotal+0.001 {
		return fmt.Errorf("buyers' total share (%f) must equal sellers' total share (%f)", buyerTotal, sellerTotal)
	}
	return nil
}

func isTerminal(status string) bool {
	switch status {
	case StatusCompleted, StatusRejectedFraud, StatusRejectedConsent,
		StatusRejectedLocked, StatusPreemptionExercised, StatusExpired:
		return true
	}
	return false
}

func (c *PropertyTransferContract) releaseLock(ctx contractapi.TransactionContextInterface, dlpiId string) error {
	resp := ctx.GetStub().InvokeChaincode("dlpi", [][]byte{[]byte("ReleaseTransferLock"), []byte(dlpiId)}, "")
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

func main() {
	cc, err := contractapi.NewChaincode(&PropertyTransferContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating PropertyTransfer chaincode: %v", err))
	}
	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("Error starting PropertyTransfer chaincode: %v", err))
	}
}
