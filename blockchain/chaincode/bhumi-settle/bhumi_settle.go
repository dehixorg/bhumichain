package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── BhumiSettle — Equitable Partition and Family Settlement Engine ────────
//
// Solves the 64×64 problem WITHOUT requiring everyone to agree on everything.
//
// The key insight: you don't need to physically divide each plot into 64 pieces.
// You value every plot by circle rate, calculate each co-owner's FAIR SHARE VALUE,
// and then RESHUFFLE — give each person sole ownership of specific plots worth
// approximately their fair share. Cash payments ("equalization") cover the gap.
//
//   Example: Rahul has 1/4 share in 4 plots worth ₹10L, ₹15L, ₹20L, ₹5L
//   Total pool = ₹50L. Rahul's fair share = ₹12.5L
//   Assignment: Rahul gets Plot A (₹10L) + Plot D (₹5L) = ₹15L
//   Rahul owes equalization = ₹15L - ₹12.5L = ₹2.5L to pool (distributed to others)
//
//   Result: Rahul is SOLE OWNER of two specific plots. Clean title. No co-owners.
//   Other 3 people: each get their plots. Independent clean titles.
//
// This is exactly what courts do in partition suits (CPC Order 26 Rule 14).
// BhumiSettle brings this onto the blockchain with AI assistance and no court delay.
//
// ─── Three Settlement Modes ───────────────────────────────────────────────
//
// EQUITABLE_PARTITION: All co-owners → each gets specific plots → sole owner of each
// SUBGROUP_SETTLEMENT: SUBSET of co-owners carve out their portion and divide it
//                      (remaining co-owners continue with reduced but undivided ownership)
// DIRECT_BUYOUT:       One person offers to buy out ALL others at circle-rate valuation
//                      (requires all others to accept OR majority + officer approval)
//
// ─── Escalation Chain ─────────────────────────────────────────────────────
//
// If parties cannot settle:
//   Tehsildar mediates (14-day window)
//   → If unresolved: SDM (Sub-Divisional Magistrate) hears it
//   → If unresolved: DM / Collector orders BhumiAuction (proceeds split by share)
//   → If BhumiAuction still contested: Revenue Court
//
// ─── Officer Fraud Detection ──────────────────────────────────────────────
//
// Circle rates stored here are the REFERENCE PRICE for the tehsil.
// When an officer submits a property transaction with declared value << circle rate,
// that's a stamp duty evasion flag. When an officer's mutations consistently list
// fewer heirs than DILRMP records, that's a bribery pattern.
// These patterns are emitted as events → FraudSense AI scores → escalates automatically.

// ─── Circle Rate Storage ──────────────────────────────────────────────────

// CircleRate — official minimum valuation rate set by state government
// In UP: published annually by IGRSUP (Inspector General of Registration)
// Stored per (tehsilCode, villageCode, landType)
type CircleRate struct {
	TehsilCode   string  `json:"tehsilCode"`
	VillageCode  string  `json:"villageCode,omitempty"` // omit for tehsil-wide default
	LandType     string  `json:"landType"`              // Jirayat | Abaadi | Industrial | Commercial
	RatePerSqMtr float64 `json:"ratePerSqMtr"`          // ₹ per sq metre
	RatePerHa    float64 `json:"ratePerHa"`             // ₹ per hectare (for agricultural)
	EffectiveFrom string `json:"effectiveFrom"`
	SetByHash    string  `json:"setByHash"`             // Tehsildar's aadhaarHash
	UpdatedAt    string  `json:"updatedAt"`
}

// ─── Settlement Data Structures ──────────────────────────────────────────

// SettlementParty — one co-owner participating in this settlement
type SettlementParty struct {
	AadhaarHash   string  `json:"aadhaarHash"`
	Name          string  `json:"name"`
	CurrentShare  string  `json:"currentShare"`   // "1/4", "3/16" etc.
	ShareDecimal  float64 `json:"shareDecimal"`
	FairValueINR  float64 `json:"fairValueInr"`    // shareDecimal × total pool value
	AssignedValue float64 `json:"assignedValue"`   // value of properties assigned to them
	EqualizationINR float64 `json:"equalizationInr"` // positive = they OWE, negative = they RECEIVE
	HasConsented  bool    `json:"hasConsented"`
	ConsentedAt   string  `json:"consentedAt,omitempty"`
	ESignHash     string  `json:"eSignHash,omitempty"`
	HasObjected   bool    `json:"hasObjected"`
	ObjectionReason string `json:"objectionReason,omitempty"`
}

// PropertyAssignment — which property goes to which person post-settlement
type PropertyAssignment struct {
	DLPIId       string  `json:"dlpiId"`
	Village      string  `json:"village"`
	AreaHectares float64 `json:"areaHectares"`
	LandType     string  `json:"landType"`
	ValueINR     float64 `json:"valueInr"`         // area × circle rate
	AssignedTo   string  `json:"assignedTo"`        // aadhaarHash (empty = remains in subgroup pool)
	IsFullTransfer bool  `json:"isFullTransfer"`    // true if sole ownership; false if partial
	NewShareFraction string `json:"newShareFraction,omitempty"` // for partial assignments
}

// EqualizationPayment — cash transfer to balance unequal property values
type EqualizationPayment struct {
	FromHash    string  `json:"fromHash"`
	ToHash      string  `json:"toHash"`
	AmountINR   float64 `json:"amountInr"`
	UpiRefNo    string  `json:"upiRefNo,omitempty"`
	PaidAt      string  `json:"paidAt,omitempty"`
	Status      string  `json:"status"` // PENDING | PAID | WAIVED
}

// AIRecommendation — BhumiSettle AI's suggested partition plan
type AIRecommendation struct {
	RecommendedAt   string               `json:"recommendedAt"`
	Algorithm       string               `json:"algorithm"`     // GREEDY_VALUE_MATCH | LP_OPTIMIZATION
	Confidence      float64              `json:"confidence"`    // 0-1
	Assignments     []PropertyAssignment `json:"assignments"`
	Payments        []EqualizationPayment `json:"payments"`
	MaxDeviation    float64              `json:"maxDeviation"`  // max % by which anyone's share deviates
	ExplanationCID  string               `json:"explanationCid,omitempty"` // IPFS: human-readable explanation
}

// SettlementProposal — one settlement attempt (can have multiple rounds)
type SettlementProposal struct {
	ProposalID      string  `json:"proposalId"`
	PoolID          string  `json:"poolId"`            // CPE pool ID OR "DIRECT" for non-pool
	DLPIIds         []string `json:"dlpiIds"`          // all properties in scope
	SettlementType  string  `json:"settlementType"`    // EQUITABLE_PARTITION | SUBGROUP | DIRECT_BUYOUT

	// Who is in THIS settlement (subset is valid for SUBGROUP type)
	Parties         []SettlementParty    `json:"parties"`
	Assignments     []PropertyAssignment `json:"assignments"`
	Payments        []EqualizationPayment `json:"payments"`

	// Valuation
	TotalPoolValueINR float64 `json:"totalPoolValueInr"`
	CircleRateSnapshot map[string]float64 `json:"circleRateSnapshot"` // landType→rate at time of proposal

	// AI recommendation
	AIRecommendation *AIRecommendation `json:"aiRecommendation,omitempty"`
	UsedAIRecommendation bool          `json:"usedAiRecommendation"`

	// For DIRECT_BUYOUT
	BuyerHash       string  `json:"buyerHash,omitempty"`
	BuyerName       string  `json:"buyerName,omitempty"`
	OfferedPriceINR float64 `json:"offeredPriceInr,omitempty"`

	// Officer involvement
	OfficerHash     string  `json:"officerHash"`
	OfficerRank     string  `json:"officerRank"`   // tehsildar | sdm | dm

	// Escalation
	EscalationLevel string  `json:"escalationLevel"` // SELF | TEHSILDAR | SDM | DM | REVENUE_COURT
	EscalatedAt     string  `json:"escalatedAt,omitempty"`
	EscalationReason string `json:"escalationReason,omitempty"`
	EscalationDeadline string `json:"escalationDeadline,omitempty"`

	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
	ExecutedAt string `json:"executedAt,omitempty"`
}

// Status constants
const (
	SettleStatusDraft          = "DRAFT"
	SettleStatusAIGenerated    = "AI_RECOMMENDED"  // AI produced a plan — awaiting party review
	SettleStatusNegotiating    = "NEGOTIATING"
	SettleStatusAllConsented   = "ALL_CONSENTED"
	SettleStatusPaymentPending = "PAYMENT_PENDING"  // equalization payments due
	SettleStatusExecuted       = "EXECUTED"
	SettleStatusEscalated      = "ESCALATED"
	SettleStatusCourtReferred  = "COURT_REFERRED"
)

// ─── Officer Fraud Pattern Storage ───────────────────────────────────────

// OfficerFraudAlert — generated when FraudSense AI detects officer-side patterns
type OfficerFraudAlert struct {
	AlertID         string   `json:"alertId"`
	OfficerHash     string   `json:"officerHash"`
	OfficerName     string   `json:"officerName"`
	OfficerRank     string   `json:"officerRank"`
	PatternType     string   `json:"patternType"`    // see constants below
	FraudScore      float64  `json:"fraudScore"`     // 0-1 (FraudSense output)
	EvidenceMutIds  []string `json:"evidenceMutIds"` // mutation IDs that triggered this
	EvidenceDLPIIds []string `json:"evidenceDlpiIds"`
	Description     string   `json:"description"`    // human-readable summary
	EscalatedTo     string   `json:"escalatedTo"`    // which officer level notified
	EscalatedToHash string   `json:"escalatedToHash"` // specific officer's aadhaarHash
	Status          string   `json:"status"`          // PENDING | UNDER_REVIEW | DISMISSED | ACTION_TAKEN
	CreatedAt       string   `json:"createdAt"`
	ResolvedAt      string   `json:"resolvedAt,omitempty"`
	ResolutionNote  string   `json:"resolutionNote,omitempty"`
}

// Officer fraud pattern types
const (
	PatternSingleHeirRepeat   = "SINGLE_HEIR_REPEAT"     // repeatedly lists 1 heir when DILRMP shows more
	PatternDelayedMutation    = "DELAYED_MUTATION"         // mutation filed years after death cert date
	PatternUndervaluation     = "UNDERVALUATION"           // declared value < 60% of circle rate
	PatternSelfDealing        = "SELF_DEALING"             // officer's own family member's property
	PatternConcentration      = "BUYER_CONCENTRATION"      // same buyer in >5 mutations in 30 days
	PatternNightEntry         = "OFF_HOURS_ENTRY"          // mutations filed 11pm–5am (evasion window)
	PatternSequentialSameDLPI = "SEQUENTIAL_SAME_DLPI"    // same plot processed multiple times fast
)

// FraudEscalationChain — auto-escalation based on officer rank and pattern severity
var fraudEscalationChain = map[string]string{
	"patwari":          "circle_inspector",
	"circle_inspector": "tehsildar",
	"tehsildar":        "sdm",
	"sdm":              "dm",
	"dm":               "state_revenue_board",
}

// ─── Smart Contract ───────────────────────────────────────────────────────

type BhumiSettleContract struct {
	contractapi.Contract
}

// ─── Circle Rate Functions ────────────────────────────────────────────────

// SetCircleRate — Tehsildar enters the official circle rate for their tehsil
// Source: annual IGRSUP notification; used for settlement valuation + stamp duty floor
func (c *BhumiSettleContract) SetCircleRate(
	ctx contractapi.TransactionContextInterface,
	tehsilCode, villageCode, landType string,
	ratePerSqMtr, ratePerHa float64,
	effectiveFrom, tehsildarHash string,
) error {
	crKey := fmt.Sprintf("CR-%s-%s-%s", tehsilCode, villageCode, landType)
	now := time.Now().UTC().Format(time.RFC3339)

	cr := CircleRate{
		TehsilCode:    tehsilCode,
		VillageCode:   villageCode,
		LandType:      landType,
		RatePerSqMtr:  ratePerSqMtr,
		RatePerHa:     ratePerHa,
		EffectiveFrom: effectiveFrom,
		SetByHash:     tehsildarHash,
		UpdatedAt:     now,
	}
	data, _ := json.Marshal(cr)
	if err := ctx.GetStub().PutState(crKey, data); err != nil {
		return err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"tehsilCode":   tehsilCode,
		"villageCode":  villageCode,
		"landType":     landType,
		"ratePerHa":    ratePerHa,
		"effectiveFrom": effectiveFrom,
		"setBy":        tehsildarHash,
	})
	_ = ctx.GetStub().SetEvent("CircleRateUpdated", event)
	return nil
}

// GetCircleRate — retrieve the current rate for a specific village + land type
func (c *BhumiSettleContract) GetCircleRate(
	ctx contractapi.TransactionContextInterface,
	tehsilCode, villageCode, landType string,
) (*CircleRate, error) {
	// Try village-specific first, fall back to tehsil-wide default
	crKey := fmt.Sprintf("CR-%s-%s-%s", tehsilCode, villageCode, landType)
	data, err := ctx.GetStub().GetState(crKey)
	if err != nil {
		return nil, err
	}
	if data == nil {
		// Try tehsil-wide default (empty villageCode)
		crKey = fmt.Sprintf("CR-%s--%s", tehsilCode, landType)
		data, err = ctx.GetStub().GetState(crKey)
		if err != nil {
			return nil, err
		}
	}
	if data == nil {
		return nil, fmt.Errorf("no circle rate found for tehsil=%s village=%s landType=%s", tehsilCode, villageCode, landType)
	}
	var cr CircleRate
	if err := json.Unmarshal(data, &cr); err != nil {
		return nil, err
	}
	return &cr, nil
}

// ─── Settlement Functions ─────────────────────────────────────────────────

// InitiateSettlement — start a new settlement process
// This can be called by any co-owner (citizen) or by an officer on their behalf.
// The AI recommendation is requested as a separate call (RequestAIRecommendation).
//
// partiesJSON: array of { aadhaarHash, name, currentShare, shareDecimal }
// dlpiDetailsJSON: array of { dlpiId, village, areaHectares, landType } for valuation
// settlementType: EQUITABLE_PARTITION | SUBGROUP | DIRECT_BUYOUT
func (c *BhumiSettleContract) InitiateSettlement(
	ctx contractapi.TransactionContextInterface,
	poolId, settlementType,
	partiesJSON, dlpiDetailsJSON,
	officerHash, officerRank,
	tehsilCode string,
) (string, error) {

	var rawParties []struct {
		AadhaarHash  string  `json:"aadhaarHash"`
		Name         string  `json:"name"`
		CurrentShare string  `json:"currentShare"`
		ShareDecimal float64 `json:"shareDecimal"`
	}
	if err := json.Unmarshal([]byte(partiesJSON), &rawParties); err != nil {
		return "", fmt.Errorf("invalid parties JSON: %w", err)
	}

	var dlpiDetails []struct {
		DLPIId       string  `json:"dlpiId"`
		Village      string  `json:"village"`
		AreaHectares float64 `json:"areaHectares"`
		LandType     string  `json:"landType"`
	}
	if err := json.Unmarshal([]byte(dlpiDetailsJSON), &dlpiDetails); err != nil {
		return "", fmt.Errorf("invalid dlpiDetails JSON: %w", err)
	}

	// Calculate property values using circle rates
	circleRateSnapshot := make(map[string]float64)
	dlpiIDs := make([]string, len(dlpiDetails))
	assignments := make([]PropertyAssignment, len(dlpiDetails))
	var totalPoolValue float64

	for i, d := range dlpiDetails {
		cr, err := c.GetCircleRate(ctx, tehsilCode, "", d.LandType)
		if err != nil {
			// No circle rate found — use 0 value and flag for officer review
			cr = &CircleRate{RatePerHa: 0}
		}
		circleRateSnapshot[d.LandType] = cr.RatePerHa
		propValue := d.AreaHectares * cr.RatePerHa

		dlpiIDs[i] = d.DLPIId
		assignments[i] = PropertyAssignment{
			DLPIId:       d.DLPIId,
			Village:      d.Village,
			AreaHectares: d.AreaHectares,
			LandType:     d.LandType,
			ValueINR:     propValue,
			AssignedTo:   "",  // empty until AI/manual assignment
			IsFullTransfer: true,
		}
		totalPoolValue += propValue
	}

	// Build settlement parties with fair share values
	parties := make([]SettlementParty, len(rawParties))
	for i, rp := range rawParties {
		parties[i] = SettlementParty{
			AadhaarHash:  rp.AadhaarHash,
			Name:         rp.Name,
			CurrentShare: rp.CurrentShare,
			ShareDecimal: rp.ShareDecimal,
			FairValueINR: rp.ShareDecimal * totalPoolValue,
			HasConsented: false,
			HasObjected:  false,
		}
	}

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()
	proposalID := fmt.Sprintf("STL-%s-%s", poolId, txID[:8])

	proposal := SettlementProposal{
		ProposalID:         proposalID,
		PoolID:             poolId,
		DLPIIds:            dlpiIDs,
		SettlementType:     settlementType,
		Parties:            parties,
		Assignments:        assignments,
		Payments:           []EqualizationPayment{},
		TotalPoolValueINR:  totalPoolValue,
		CircleRateSnapshot: circleRateSnapshot,
		OfficerHash:        officerHash,
		OfficerRank:        officerRank,
		EscalationLevel:    "SELF",
		Status:             SettleStatusDraft,
		CreatedAt:          now.Format(time.RFC3339),
		UpdatedAt:          now.Format(time.RFC3339),
	}

	if err := c.saveProposal(ctx, &proposal); err != nil {
		return "", err
	}

	// Fire event so the BhumiSettle AI service can auto-generate a recommendation
	aiRequestEvent, _ := json.Marshal(map[string]interface{}{
		"proposalId":    proposalID,
		"poolId":        poolId,
		"parties":       parties,
		"assignments":   assignments,
		"totalValue":    totalPoolValue,
		"action":        "REQUEST_AI_SETTLEMENT_RECOMMENDATION",
	})
	_ = ctx.GetStub().SetEvent("AISettlementRequested", aiRequestEvent)

	return proposalID, nil
}

// RecordAIRecommendation — BhumiSettle AI service writes its recommended plan back to chain
// The AI runs externally (Python service) and calls this via oracle
// Algorithm: greedy value-matching — sorts properties by value descending,
//            assigns to the party whose assigned total is furthest below their fair share
func (c *BhumiSettleContract) RecordAIRecommendation(
	ctx contractapi.TransactionContextInterface,
	proposalID, algorithm string,
	confidence float64,
	assignmentsJSON, paymentsJSON string,
	maxDeviation float64,
	explanationCID string,
) error {
	proposal, err := c.getProposal(ctx, proposalID)
	if err != nil {
		return err
	}

	var assignments []PropertyAssignment
	if err := json.Unmarshal([]byte(assignmentsJSON), &assignments); err != nil {
		return fmt.Errorf("invalid assignments JSON: %w", err)
	}
	var payments []EqualizationPayment
	if err := json.Unmarshal([]byte(paymentsJSON), &payments); err != nil {
		return fmt.Errorf("invalid payments JSON: %w", err)
	}

	// Update each party's assigned value and equalization amount
	assignedByParty := make(map[string]float64)
	for _, a := range assignments {
		assignedByParty[a.AssignedTo] += a.ValueINR
	}
	for i, p := range proposal.Parties {
		assigned := assignedByParty[p.AadhaarHash]
		proposal.Parties[i].AssignedValue = assigned
		proposal.Parties[i].EqualizationINR = assigned - p.FairValueINR
	}

	now := time.Now().UTC().Format(time.RFC3339)
	proposal.AIRecommendation = &AIRecommendation{
		RecommendedAt:  now,
		Algorithm:      algorithm,
		Confidence:     confidence,
		Assignments:    assignments,
		Payments:       payments,
		MaxDeviation:   maxDeviation,
		ExplanationCID: explanationCID,
	}
	proposal.Assignments = assignments
	proposal.Payments = payments
	proposal.Status = SettleStatusAIGenerated
	proposal.UpdatedAt = now

	if err := c.saveProposal(ctx, proposal); err != nil {
		return err
	}

	// Notify all parties to review the AI recommendation
	partyHashes := make([]string, len(proposal.Parties))
	for i, p := range proposal.Parties {
		partyHashes[i] = p.AadhaarHash
	}
	notifyEvent, _ := json.Marshal(map[string]interface{}{
		"proposalId":    proposalID,
		"allParties":    partyHashes,
		"confidence":    confidence,
		"maxDeviation":  maxDeviation,
		"message":       "AI ne settlement plan tayaar kiya hai. Please review karein.",
		"reviewDeadline": time.Now().UTC().Add(14 * 24 * time.Hour).Format(time.RFC3339),
	})
	_ = ctx.GetStub().SetEvent("AIRecommendationReady", notifyEvent)
	return nil
}

// ConsentToSettlement — party accepts the proposed plan (AI-recommended or manual)
func (c *BhumiSettleContract) ConsentToSettlement(
	ctx contractapi.TransactionContextInterface,
	proposalID, partyHash, eSignHash string,
	acceptAIRecommendation bool,
) error {
	proposal, err := c.getProposal(ctx, proposalID)
	if err != nil {
		return err
	}
	if proposal.Status != SettleStatusAIGenerated && proposal.Status != SettleStatusNegotiating {
		return fmt.Errorf("proposal %s not in reviewable state (status: %s)", proposalID, proposal.Status)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	found := false
	for i, p := range proposal.Parties {
		if p.AadhaarHash == partyHash {
			proposal.Parties[i].HasConsented = true
			proposal.Parties[i].ConsentedAt = now
			proposal.Parties[i].ESignHash = eSignHash
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("party %s not in this settlement", partyHash)
	}
	if acceptAIRecommendation && proposal.AIRecommendation != nil {
		proposal.UsedAIRecommendation = true
	}

	proposal.Status = SettleStatusNegotiating

	// Check if ALL parties consented
	allConsented := true
	for _, p := range proposal.Parties {
		if !p.HasConsented && !p.HasObjected {
			allConsented = false
			break
		}
	}
	if allConsented && !c.anyObjection(proposal) {
		// Check if equalization payments exist
		pendingPayments := false
		for _, pay := range proposal.Payments {
			if pay.Status == "PENDING" && pay.AmountINR > 0 {
				pendingPayments = true
				break
			}
		}
		if pendingPayments {
			proposal.Status = SettleStatusPaymentPending
		} else {
			proposal.Status = SettleStatusAllConsented
		}
	}

	proposal.UpdatedAt = now
	return c.saveProposal(ctx, proposal)
}

// ObjectToSettlement — party rejects the proposed plan, optionally with counter-proposal
func (c *BhumiSettleContract) ObjectToSettlement(
	ctx contractapi.TransactionContextInterface,
	proposalID, partyHash, reason string,
) error {
	proposal, err := c.getProposal(ctx, proposalID)
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	for i, p := range proposal.Parties {
		if p.AadhaarHash == partyHash {
			proposal.Parties[i].HasObjected = true
			proposal.Parties[i].ObjectionReason = reason
			break
		}
	}

	// After 2 rounds of objection → auto-escalate to Tehsildar
	objectionCount := 0
	for _, p := range proposal.Parties {
		if p.HasObjected {
			objectionCount++
		}
	}

	if objectionCount > 0 {
		proposal.Status = SettleStatusNegotiating
		// If already at NEGOTIATING and new objection: escalate
		if proposal.EscalationLevel == "SELF" {
			proposal.EscalationLevel = "TEHSILDAR"
			proposal.EscalatedAt = now
			proposal.EscalationReason = fmt.Sprintf("%d party(ies) objected to settlement plan", objectionCount)
			proposal.EscalationDeadline = time.Now().UTC().Add(14 * 24 * time.Hour).Format(time.RFC3339)
			proposal.Status = SettleStatusEscalated

			escalateEvent, _ := json.Marshal(map[string]interface{}{
				"proposalId":     proposalID,
				"escalatedTo":    "tehsildar",
				"reason":         proposal.EscalationReason,
				"deadline":       proposal.EscalationDeadline,
				"notifyOfficer":  "TEHSILDAR",
			})
			_ = ctx.GetStub().SetEvent("SettlementEscalated", escalateEvent)
		}
	}

	proposal.UpdatedAt = now
	return c.saveProposal(ctx, proposal)
}

// RecordEqualizationPayment — oracle confirms cash payment made (UPI reference)
func (c *BhumiSettleContract) RecordEqualizationPayment(
	ctx contractapi.TransactionContextInterface,
	proposalID, fromHash, toHash, upiRefNo string, amount float64,
) error {
	proposal, err := c.getProposal(ctx, proposalID)
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	for i, pay := range proposal.Payments {
		if pay.FromHash == fromHash && pay.ToHash == toHash && pay.Status == "PENDING" {
			proposal.Payments[i].UpiRefNo = upiRefNo
			proposal.Payments[i].PaidAt = now
			proposal.Payments[i].Status = "PAID"
			break
		}
	}

	// Check if all payments done
	allPaid := true
	for _, pay := range proposal.Payments {
		if pay.Status == "PENDING" {
			allPaid = false
			break
		}
	}
	if allPaid {
		proposal.Status = SettleStatusAllConsented
	}

	proposal.UpdatedAt = now
	return c.saveProposal(ctx, proposal)
}

// ExecuteSettlement — Tehsildar approves and executes the settlement
// Fires events that trigger DLPI.UpdateOwners for each assignment
func (c *BhumiSettleContract) ExecuteSettlement(
	ctx contractapi.TransactionContextInterface,
	proposalID, officerHash, officerESign string,
) error {
	proposal, err := c.getProposal(ctx, proposalID)
	if err != nil {
		return err
	}
	if proposal.Status != SettleStatusAllConsented {
		return fmt.Errorf("cannot execute settlement in state: %s", proposal.Status)
	}

	now := time.Now().UTC()
	txID := ctx.GetStub().GetTxID()

	// Fire one event per assignment — API layer executes DLPI.UpdateOwners for each
	for _, a := range proposal.Assignments {
		if a.AssignedTo == "" {
			continue // unassigned — stays in pool
		}
		assignEvent, _ := json.Marshal(map[string]interface{}{
			"action":        "EXECUTE_DLPI_TRANSFER",
			"proposalId":    proposalID,
			"dlpiId":        a.DLPIId,
			"newOwnerHash":  a.AssignedTo,
			"newShare":      "1/1",
			"shareDecimal":  1.0,
			"mutationType":  "PARTITION",
			"officerHash":   officerHash,
			"settledByAI":   proposal.UsedAIRecommendation,
			"txId":          txID,
		})
		_ = ctx.GetStub().SetEvent("SettlementDLPITransfer", assignEvent)
	}

	proposal.Status = SettleStatusExecuted
	proposal.ExecutedAt = now.Format(time.RFC3339)
	proposal.UpdatedAt = now.Format(time.RFC3339)
	proposal.OfficerHash = officerHash

	if err := c.saveProposal(ctx, proposal); err != nil {
		return err
	}

	completedEvent, _ := json.Marshal(map[string]interface{}{
		"proposalId":      proposalID,
		"poolId":          proposal.PoolID,
		"totalValue":      proposal.TotalPoolValueINR,
		"partiesSettled":  len(proposal.Parties),
		"usedAI":          proposal.UsedAIRecommendation,
		"officerHash":     officerHash,
		"executedAt":      proposal.ExecutedAt,
	})
	_ = ctx.GetStub().SetEvent("SettlementExecuted", completedEvent)
	return nil
}

// EscalateSettlement — officer escalates to next level after mediation fails
func (c *BhumiSettleContract) EscalateSettlement(
	ctx contractapi.TransactionContextInterface,
	proposalID, currentOfficerHash, reason string,
) error {
	proposal, err := c.getProposal(ctx, proposalID)
	if err != nil {
		return err
	}

	nextLevel := map[string]string{
		"SELF":          "TEHSILDAR",
		"TEHSILDAR":     "SDM",
		"SDM":           "DM",
		"DM":            "REVENUE_COURT",
		"REVENUE_COURT": "REVENUE_COURT", // terminal
	}
	next, ok := nextLevel[proposal.EscalationLevel]
	if !ok || proposal.EscalationLevel == "REVENUE_COURT" {
		return fmt.Errorf("already at highest escalation level")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	proposal.EscalationLevel = next
	proposal.EscalatedAt = now
	proposal.EscalationReason = reason
	// 14 days per escalation level to resolve
	proposal.EscalationDeadline = time.Now().UTC().Add(14 * 24 * time.Hour).Format(time.RFC3339)
	proposal.Status = SettleStatusEscalated
	if next == "REVENUE_COURT" {
		proposal.Status = SettleStatusCourtReferred
	}
	proposal.UpdatedAt = now

	event, _ := json.Marshal(map[string]interface{}{
		"proposalId":     proposalID,
		"escalatedTo":    next,
		"reason":         reason,
		"deadline":       proposal.EscalationDeadline,
		"currentOfficer": currentOfficerHash,
		"parties":        proposal.Parties,
		"totalValue":     proposal.TotalPoolValueINR,
	})
	_ = ctx.GetStub().SetEvent("SettlementEscalated", event)
	return c.saveProposal(ctx, proposal)
}

// ─── Officer Fraud Detection ──────────────────────────────────────────────

// RecordOfficerFraudAlert — FraudSense AI writes a detected officer fraud pattern
// This is called by the oracle after AI analysis of mutation patterns
//
// The pattern types that trigger this:
//   SINGLE_HEIR_REPEAT  — same officer, multiple inheritance mutations with 1 heir
//                         when DILRMP records show multiple names
//   UNDERVALUATION      — declared value < 60% of circle rate (stamp duty evasion)
//   DELAYED_MUTATION    — mutation filed >2 years after death cert date
//   SELF_DEALING        — officer's own aadhaarHash family member's property
//   BUYER_CONCENTRATION — same buyer in >5 mutations by same officer in 30 days
//   OFF_HOURS_ENTRY     — mutations filed between 11pm and 5am repeatedly
func (c *BhumiSettleContract) RecordOfficerFraudAlert(
	ctx contractapi.TransactionContextInterface,
	officerHash, officerName, officerRank,
	patternType string, fraudScore float64,
	evidenceMutIdsJSON, evidenceDLPIIdsJSON,
	description string,
) (string, error) {

	if fraudScore < 0.60 {
		// Below threshold — log but don't escalate
		return "", fmt.Errorf("fraud score %.2f below escalation threshold 0.60", fraudScore)
	}

	// Determine who to escalate to based on officer rank
	escalateTo, ok := fraudEscalationChain[officerRank]
	if !ok {
		escalateTo = "state_revenue_board"
	}

	var mutIDs, dlpiIDs []string
	json.Unmarshal([]byte(evidenceMutIdsJSON), &mutIDs)
	json.Unmarshal([]byte(evidenceDLPIIdsJSON), &dlpiIDs)

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC().Format(time.RFC3339)
	alertID := fmt.Sprintf("OFA-%s-%s", officerHash[:8], txID[:6])

	alert := OfficerFraudAlert{
		AlertID:         alertID,
		OfficerHash:     officerHash,
		OfficerName:     officerName,
		OfficerRank:     officerRank,
		PatternType:     patternType,
		FraudScore:      fraudScore,
		EvidenceMutIds:  mutIDs,
		EvidenceDLPIIds: dlpiIDs,
		Description:     description,
		EscalatedTo:     escalateTo,
		Status:          "PENDING",
		CreatedAt:       now,
	}

	data, _ := json.Marshal(alert)
	if err := ctx.GetStub().PutState(alertID, data); err != nil {
		return "", err
	}

	// Fire event — escalation layer notifies the higher-level officer
	// The higher officer's Aadhaar hash is looked up from their jurisdiction record
	escalationEvent, _ := json.Marshal(map[string]interface{}{
		"alertId":         alertID,
		"officerHash":     officerHash,
		"officerName":     officerName,
		"officerRank":     officerRank,
		"patternType":     patternType,
		"fraudScore":      fraudScore,
		"escalateTo":      escalateTo,           // rank of who gets notified
		"evidenceMutIds":  mutIDs,
		"evidenceDlpiIds": dlpiIDs,
		"description":     description,
		// Message: "OFFICER FRAUD ALERT: [officerName] ([rank]) — pattern detected: [type]. Score: [score]"
	})
	_ = ctx.GetStub().SetEvent("OfficerFraudAlertFired", escalationEvent)

	return alertID, nil
}

// ResolveOfficerFraudAlert — higher officer marks alert as reviewed with outcome
func (c *BhumiSettleContract) ResolveOfficerFraudAlert(
	ctx contractapi.TransactionContextInterface,
	alertID, reviewerHash, status, resolutionNote string,
) error {
	data, err := ctx.GetStub().GetState(alertID)
	if err != nil {
		return err
	}
	if data == nil {
		return fmt.Errorf("alert %s not found", alertID)
	}
	var alert OfficerFraudAlert
	if err := json.Unmarshal(data, &alert); err != nil {
		return err
	}

	validStatuses := map[string]bool{"DISMISSED": true, "ACTION_TAKEN": true, "UNDER_REVIEW": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s", status)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	alert.Status = status
	alert.EscalatedToHash = reviewerHash
	alert.ResolvedAt = now
	alert.ResolutionNote = resolutionNote

	updated, _ := json.Marshal(alert)
	if err := ctx.GetStub().PutState(alertID, updated); err != nil {
		return err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"alertId":        alertID,
		"officerHash":    alert.OfficerHash,
		"status":         status,
		"resolvedBy":     reviewerHash,
		"resolutionNote": resolutionNote,
	})
	_ = ctx.GetStub().SetEvent("OfficerAlertResolved", event)
	return nil
}

// QueryOfficerAlerts — supervisor gets all pending alerts for their jurisdiction
func (c *BhumiSettleContract) QueryOfficerAlerts(
	ctx contractapi.TransactionContextInterface,
	targetRank string, // the rank being escalated TO (e.g., "circle_inspector" sees patwari alerts)
) ([]*OfficerFraudAlert, error) {
	query := fmt.Sprintf(`{"selector":{"escalatedTo":"%s","status":"PENDING"}}`, targetRank)
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*OfficerFraudAlert
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var a OfficerFraudAlert
		if err := json.Unmarshal(r.Value, &a); err != nil {
			return nil, err
		}
		results = append(results, &a)
	}
	return results, nil
}

// QueryOfficerAlertsByOfficer — audit trail for a specific officer
func (c *BhumiSettleContract) QueryOfficerAlertsByOfficer(
	ctx contractapi.TransactionContextInterface, officerHash string,
) ([]*OfficerFraudAlert, error) {
	query := fmt.Sprintf(`{"selector":{"officerHash":"%s"}}`, officerHash)
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*OfficerFraudAlert
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var a OfficerFraudAlert
		if err := json.Unmarshal(r.Value, &a); err != nil {
			return nil, err
		}
		results = append(results, &a)
	}
	return results, nil
}

// ─── Getters ──────────────────────────────────────────────────────────────

func (c *BhumiSettleContract) GetSettlementProposal(
	ctx contractapi.TransactionContextInterface, proposalID string,
) (*SettlementProposal, error) {
	return c.getProposal(ctx, proposalID)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────

func (c *BhumiSettleContract) getProposal(ctx contractapi.TransactionContextInterface, id string) (*SettlementProposal, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("state read error: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("proposal %s not found", id)
	}
	var p SettlementProposal
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &p, nil
}

func (c *BhumiSettleContract) saveProposal(ctx contractapi.TransactionContextInterface, p *SettlementProposal) error {
	data, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return ctx.GetStub().PutState(p.ProposalID, data)
}

func (c *BhumiSettleContract) anyObjection(p *SettlementProposal) bool {
	for _, party := range p.Parties {
		if party.HasObjected {
			return true
		}
	}
	return false
}

// greedyAssign — the algorithm BhumiSettle AI uses (exposed here for on-chain reference)
// Sorts properties descending by value, assigns each to the party whose running total
// is furthest below their fair share.
// Returns assignments and equalization payments.
func greedyAssign(parties []SettlementParty, properties []PropertyAssignment) ([]PropertyAssignment, []EqualizationPayment) {
	// Sort properties: highest value first
	sort.Slice(properties, func(i, j int) bool {
		return properties[i].ValueINR > properties[j].ValueINR
	})

	assigned := make(map[string]float64) // hash → running total assigned
	for i, prop := range properties {
		// Find party furthest below their fair share
		bestIdx := 0
		bestShortfall := -1e18
		for j, p := range parties {
			shortfall := p.FairValueINR - assigned[p.AadhaarHash]
			if shortfall > bestShortfall {
				bestShortfall = shortfall
				bestIdx = j
			}
		}
		properties[i].AssignedTo = parties[bestIdx].AadhaarHash
		assigned[parties[bestIdx].AadhaarHash] += prop.ValueINR
	}

	// Calculate equalization payments
	var payments []EqualizationPayment
	totalPool := 0.0
	for _, p := range parties {
		totalPool += p.FairValueINR
	}
	avgValue := totalPool / float64(len(parties))
	_ = avgValue

	for _, p := range parties {
		diff := assigned[p.AadhaarHash] - p.FairValueINR
		if diff > 100 { // received more than fair share by > ₹100
			// This person owes money to those who received less
			for _, q := range parties {
				qdiff := assigned[q.AadhaarHash] - q.FairValueINR
				if qdiff < -100 { // q received less than fair share
					// Simplified: p pays q proportionally
					payAmt := diff * ((-qdiff) / (totalPool))
					payments = append(payments, EqualizationPayment{
						FromHash:  p.AadhaarHash,
						ToHash:    q.AadhaarHash,
						AmountINR: payAmt,
						Status:    "PENDING",
					})
				}
			}
		}
	}

	return properties, payments
}

func main() {
	cc, err := contractapi.NewChaincode(&BhumiSettleContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating BhumiSettle chaincode: %v", err))
	}
	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("Error starting BhumiSettle chaincode: %v", err))
	}
}
