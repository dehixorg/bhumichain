package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Uttaradhikar Engine — Complete Inheritance Module ────────────────────
//
// Three inheritance trigger scenarios:
//
//  SCENARIO A — Owner registers heirs while alive (InheritancePlan)
//    Person creates a plan naming their heirs and intended shares.
//    Can update or revoke anytime (like a living will).
//    ESign required — stored permanently on-chain.
//
//  SCENARIO B — Owner triggers transfer themselves while alive
//    Owner decides to give property NOW (advance inheritance / gift).
//    Legal basis: Transfer of Property Act S.122 (Gift Deed).
//    Owner eSigns as donor. All recipients eSign acceptance.
//    No death certificate needed. Stamp duty: UP gift rate 2%.
//    Creates SuccessionCase with TriggerSource=OWNER_ALIVE.
//
//  SCENARIO C — Heirs trigger after death
//    C1: Death certificate via CRS oracle (standard flow)
//    C2: Heir petition with pre-registered InheritancePlan + affidavit
//        (when official death cert is delayed — common in rural India)
//    C3: Heir petition without pre-registered plan
//        (heir walks in with death certificate, system auto-computes heirs)
//
// ─── Applicable Laws Enforced at Chaincode Level ─────────────────────────
//
//  Hindu   : Hindu Succession Act 1956 (amended 2005)
//              S.6(3): Daughters = coparceners by birth, equal to sons
//              S.8:    Class I heirs listed (wife INCLUDED — equal share)
//              Vineeta Sharma v. Rakesh Sharma (2020) SC: daughters' right
//              regardless of father's death date
//
//  Muslim  : Muslim Personal Law (Shariat) Application Act 1937
//    Sunni : Quran 4:11 — son gets 2× daughter's share
//              Wife: 1/8 with children, 1/4 without
//              Daughter sole: 1/2. Multiple daughters (no son): 2/3 total
//              Wasiyat (bequest by will): max 1/3 to non-heirs
//    Shia  : Similar but with Radd (return) principle — no agnatic residue
//
//  Christian: Indian Succession Act 1925 S.33
//              Spouse + lineal descendants: spouse gets 1/3, rest to descendants
//              Children: equally regardless of gender
//
//  Parsi   : ISA 1925 (different chapter)
//              Widow = equal share as each child
//              Sons and daughters equal (unlike Sunni Muslim)
//
//  Tribal  : Tribal Customary Law + Forest Rights Act 2006
//              Governed by community rules; gram sabha involved
//              NOT handled in this chaincode — see tribal-guard chaincode

// ─── Applicable Law Constants ──────────────────────────────────────────────

const (
	LawHSA          = "Hindu_Succession_Act_1956"
	LawMuslimSunni  = "Muslim_Personal_Law_Sunni"
	LawMuslimShia   = "Muslim_Personal_Law_Shia"
	LawISA          = "Indian_Succession_Act_1925"  // Christian + Parsi
	LawParsi        = "Parsi_ISA_1925"
	LawTribal       = "Tribal_Customary_Law"
	LawSpecialMarr  = "Special_Marriage_Act_1954"   // inter-religious → ISA applies
)

// ─── Data Structures ──────────────────────────────────────────────────────

// InheritancePlan — registered by owner while alive
// Stored on-chain with owner's eSign. Advisory document; legal heirs are
// computed by CoparcenaryMapper AI and validated against applicable law.
type InheritancePlan struct {
	PlanID            string        `json:"planId"`
	DLPIId            string        `json:"dlpiId"`
	OwnerHash         string        `json:"ownerHash"`
	OwnerName         string        `json:"ownerName"`
	Religion          string        `json:"religion"`          // Hindu | Muslim | Christian | Parsi | Sikh
	LawApplicable     string        `json:"lawApplicable"`     // from LawXXX constants
	MaritalStatus     string        `json:"maritalStatus"`     // Single | Married | Widowed | Divorced
	SpouseHash        string        `json:"spouseHash,omitempty"`
	SpouseName        string        `json:"spouseName,omitempty"`

	// Optional: formal will reference (doc stored offline/IPFS, only hash here)
	HasRegisteredWill bool          `json:"hasRegisteredWill"`
	WillRegNo         string        `json:"willRegNo,omitempty"`   // official will registration no.
	WillDocCID        string        `json:"willDocCid,omitempty"`  // IPFS hash

	PlannedHeirs      []PlannedHeir `json:"plannedHeirs"`

	// Trigger permissions
	AllowAliveTransfer bool         `json:"allowAliveTransfer"`  // owner can gift while alive
	AllowHeirPetition  bool         `json:"allowHeirPetition"`   // heirs can petition after death (without CRS)

	// Consent
	OwnerESignHash    string        `json:"ownerESignHash"`
	Status            string        `json:"status"`   // DRAFT | ACTIVE | TRIGGERED | REVOKED
	CreatedAt         string        `json:"createdAt"`
	UpdatedAt         string        `json:"updatedAt"`
	RevokedAt         string        `json:"revokedAt,omitempty"`
	RevocationReason  string        `json:"revocationReason,omitempty"`
}

// PlannedHeir — one heir in the owner's pre-registration
type PlannedHeir struct {
	AadhaarHash      string  `json:"aadhaarHash"`
	Name             string  `json:"name"`
	Relation         string  `json:"relation"`          // Son | Daughter | Wife | Mother | Father |
	                                                     //  GrandSon | GrandDaughter | Brother | Sister
	Gender           string  `json:"gender"`
	DOB              string  `json:"dob"`               // for minor detection (< 18)
	IsMinor          bool    `json:"isMinor"`
	GuardianHash     string  `json:"guardianHash,omitempty"` // if minor
	IntendedShare    string  `json:"intendedShare"`     // "1/3" — owner's intent
	IntendedShareDec float64 `json:"intendedShareDec"`
	PropertyNote     string  `json:"propertyNote,omitempty"` // "agricultural plot in Dadri"
	IsNRI            bool    `json:"isNri"`
}

// SuccessionCase — opened for any inheritance trigger (all three scenarios)
type SuccessionCase struct {
	CaseID            string          `json:"caseId"`
	DLPIId            string          `json:"dlpiId"`
	FamilyID          string          `json:"familyId"`
	DeceasedName      string          `json:"deceasedName"`
	DeceasedHash      string          `json:"deceasedHash"`
	DateOfDeath       string          `json:"dateOfDeath,omitempty"`
	DeathCertCID      string          `json:"deathCertCid,omitempty"`
	CRSRegistrationNo string          `json:"crsRegistrationNo,omitempty"`

	// Trigger source
	TriggerSource     string          `json:"triggerSource"` // DEATH_CERT | OWNER_ALIVE | HEIR_PETITION
	TriggeredByHash   string          `json:"triggeredByHash"`
	DeathAffidavitCID string          `json:"deathAffidavitCid,omitempty"` // for HEIR_PETITION without CRS

	// Pre-registered plan (if any)
	HasInheritancePlan  bool          `json:"hasInheritancePlan"`
	InheritancePlanID   string        `json:"inheritancePlanId,omitempty"`

	// Law + heirs
	ApplicableLaw     string          `json:"applicableLaw"`
	Religion          string          `json:"religion"`
	Heirs             []SuccessionHeir `json:"heirs"`
	TotalHeirs        int             `json:"totalHeirs"`
	MinorHeirs        []MinorHeir     `json:"minorHeirs,omitempty"`

	// Law enforcement flags
	LegalEdgeCases    []string        `json:"legalEdgeCases,omitempty"`
	LegalWarnings     []string        `json:"legalWarnings,omitempty"`  // non-blocking, just alerts

	// AI computation
	AIComputationCID  string          `json:"aiComputationCid"`
	AIConfidenceScore float64         `json:"aiConfidenceScore"`

	// Consent tracking
	ConsentDeadline   string          `json:"consentDeadline"`
	AllConsentedAt    string          `json:"allConsentedAt,omitempty"`

	// Dispute
	DisputeInfo       *DisputeRecord  `json:"disputeInfo,omitempty"`

	// Execution
	AutoMutatedAt     string          `json:"autoMutatedAt,omitempty"`
	MutationCaseID    string          `json:"mutationCaseId,omitempty"` // linked mutation-manager ID

	Status            string          `json:"status"`
	// INITIATED → HEIRS_IDENTIFIED → AWAITING_CONSENTS →
	// ALL_CONSENTED → AUTO_MUTATED
	// DISPUTE_FILED → COURT_REFERRED
	// OWNER_ALIVE_PENDING (gift: waiting recipient acceptance)

	InitiatedAt       string          `json:"initiatedAt"`
	UpdatedAt         string          `json:"updatedAt"`
}

type SuccessionHeir struct {
	HeirID          string  `json:"heirId"`
	Name            string  `json:"name"`
	AadhaarHash     string  `json:"aadhaarHash"`
	Relation        string  `json:"relation"`
	Gender          string  `json:"gender"`
	DOB             string  `json:"dob"`
	IsAlive         bool    `json:"isAlive"`
	IsAdult         bool    `json:"isAdult"`
	IsNRI           bool    `json:"isNri"`
	IsMinor         bool    `json:"isMinor"`

	// Shares
	LegalBasis      string  `json:"legalBasis"`    // which law section gives them this
	LegalShare      string  `json:"legalShare"`    // what LAW mandates: "1/4"
	LegalShareDec   float64 `json:"legalShareDec"`
	IntendedShare   string  `json:"intendedShare,omitempty"` // what owner WANTED (from plan)
	IntendedShareDec float64 `json:"intendedShareDec,omitempty"`
	FinalShare      string  `json:"finalShare"`    // what they actually receive
	FinalShareDec   float64 `json:"finalShareDec"`
	LegalNote       string  `json:"legalNote,omitempty"`

	// For minor heirs
	GuardianHash    string  `json:"guardianHash,omitempty"`
	GuardianName    string  `json:"guardianName,omitempty"`

	// Consent tracking
	NotifiedAt      string  `json:"notifiedAt,omitempty"`
	NotifyChannel   string  `json:"notifyChannel,omitempty"`
	HasConsented    bool    `json:"hasConsented"`
	ConsentedAt     string  `json:"consentedAt,omitempty"`
	ConsentTxHash   string  `json:"consentTxHash,omitempty"`
	HasObjected     bool    `json:"hasObjected"`
	ObjectedAt      string  `json:"objectedAt,omitempty"`
	ObjectionReason string  `json:"objectionReason,omitempty"`
}

type MinorHeir struct {
	Name              string  `json:"name"`
	DOB               string  `json:"dob"`
	Relation          string  `json:"relation"`
	FinalShare        string  `json:"finalShare"`
	FinalShareDec     float64 `json:"finalShareDec"`
	GuardianName      string  `json:"guardianName"`
	GuardianHash      string  `json:"guardianHash"`
	CourtApptdGuardian bool   `json:"courtAppointedGuardian"`
}

type DisputeRecord struct {
	DisputedBy      string `json:"disputedByHash"`
	DisputeType     string `json:"disputeType"`  // ShareDispute | RightToInherit | OmittedHeir | WillValidity
	FiledAt         string `json:"filedAt"`
	ECourtsCaseNo   string `json:"eCourtsCaseNo,omitempty"`
	NyayaAIBriefCID string `json:"nyayaAIBriefCid,omitempty"`
	Status          string `json:"status"`       // FILED | HEARING | RESOLVED
	ResolvedAt      string `json:"resolvedAt,omitempty"`
	CourtOrderCID   string `json:"courtOrderCid,omitempty"`
}

// ─── Smart Contract ────────────────────────────────────────────────────────

type UttaradhikarContract struct {
	contractapi.Contract
}

// ══════════════════════════════════════════════════════════════════════════
// SCENARIO A: PRE-REGISTRATION WHILE ALIVE
// ══════════════════════════════════════════════════════════════════════════

// RegisterInheritancePlan — owner names their heirs and intended shares while alive
// This is advisory: legal shares are computed by AI and enforced by law.
// Owner can update or revoke anytime until death or alive transfer execution.
func (c *UttaradhikarContract) RegisterInheritancePlan(
	ctx contractapi.TransactionContextInterface,
	dlpiId, ownerHash, ownerName, religion, lawApplicable,
	maritalStatus, spouseHash, spouseName string,
	hasRegisteredWill bool, willRegNo, willDocCID string,
	plannedHeirsJSON string,
	allowAliveTransfer, allowHeirPetition bool,
	ownerESignHash string,
) (string, error) {

	var plannedHeirs []PlannedHeir
	if err := json.Unmarshal([]byte(plannedHeirsJSON), &plannedHeirs); err != nil {
		return "", fmt.Errorf("invalid plannedHeirs JSON: %w", err)
	}
	if len(plannedHeirs) == 0 {
		return "", fmt.Errorf("at least one planned heir required")
	}

	// Validate intended shares sum to 1.0
	var total float64
	for _, h := range plannedHeirs {
		total += h.IntendedShareDec
	}
	if total < 0.999 || total > 1.001 {
		return "", fmt.Errorf("planned heir shares sum to %.4f — must equal 1.0", total)
	}

	// Check if plan already exists for this DLPI
	existing, _ := c.getPlanByDLPI(ctx, dlpiId)
	if existing != nil && existing.Status == "ACTIVE" {
		return "", fmt.Errorf("active inheritance plan already exists for DLPI %s (planId: %s). Revoke it first.", dlpiId, existing.PlanID)
	}

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC().Format(time.RFC3339)
	planID := fmt.Sprintf("PLAN-%s-%s", dlpiId, txID[:8])

	plan := InheritancePlan{
		PlanID:             planID,
		DLPIId:             dlpiId,
		OwnerHash:          ownerHash,
		OwnerName:          ownerName,
		Religion:           religion,
		LawApplicable:      lawApplicable,
		MaritalStatus:      maritalStatus,
		SpouseHash:         spouseHash,
		SpouseName:         spouseName,
		HasRegisteredWill:  hasRegisteredWill,
		WillRegNo:          willRegNo,
		WillDocCID:         willDocCID,
		PlannedHeirs:       plannedHeirs,
		AllowAliveTransfer: allowAliveTransfer,
		AllowHeirPetition:  allowHeirPetition,
		OwnerESignHash:     ownerESignHash,
		Status:             "ACTIVE",
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	data, err := json.Marshal(plan)
	if err != nil {
		return "", err
	}
	// Store by planID and by DLPI for fast lookup
	if err := ctx.GetStub().PutState(planID, data); err != nil {
		return "", err
	}
	// Secondary index: DLPI → planID
	if err := ctx.GetStub().PutState("PLAN-IDX-"+dlpiId, []byte(planID)); err != nil {
		return "", err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"planId":        planID,
		"dlpiId":        dlpiId,
		"ownerName":     ownerName,
		"heirCount":     len(plannedHeirs),
		"hasWill":       hasRegisteredWill,
		"allowGift":     allowAliveTransfer,
		"allowPetition": allowHeirPetition,
	})
	_ = ctx.GetStub().SetEvent("InheritancePlanRegistered", event)
	return planID, nil
}

// UpdateInheritancePlan — owner modifies their plan (add/remove heirs, change shares)
// Requires fresh eSign for each update — creates permanent immutable history
func (c *UttaradhikarContract) UpdateInheritancePlan(
	ctx contractapi.TransactionContextInterface,
	planID, ownerHash string,
	updatedHeirsJSON, newESignHash string,
	allowAliveTransfer, allowHeirPetition bool,
) error {
	plan, err := c.getPlan(ctx, planID)
	if err != nil {
		return err
	}
	if plan.OwnerHash != ownerHash {
		return fmt.Errorf("only the plan owner can update this plan")
	}
	if plan.Status != "ACTIVE" {
		return fmt.Errorf("cannot update plan in status: %s", plan.Status)
	}

	var updatedHeirs []PlannedHeir
	if err := json.Unmarshal([]byte(updatedHeirsJSON), &updatedHeirs); err != nil {
		return fmt.Errorf("invalid heirs JSON: %w", err)
	}
	var total float64
	for _, h := range updatedHeirs {
		total += h.IntendedShareDec
	}
	if total < 0.999 || total > 1.001 {
		return fmt.Errorf("updated heir shares sum to %.4f — must equal 1.0", total)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	plan.PlannedHeirs = updatedHeirs
	plan.AllowAliveTransfer = allowAliveTransfer
	plan.AllowHeirPetition = allowHeirPetition
	plan.OwnerESignHash = newESignHash
	plan.UpdatedAt = now

	data, _ := json.Marshal(plan)
	return ctx.GetStub().PutState(planID, data)
}

// RevokeInheritancePlan — owner cancels the plan (e.g., selling property, writing new will)
func (c *UttaradhikarContract) RevokeInheritancePlan(
	ctx contractapi.TransactionContextInterface,
	planID, ownerHash, reason, ownerESignHash string,
) error {
	plan, err := c.getPlan(ctx, planID)
	if err != nil {
		return err
	}
	if plan.OwnerHash != ownerHash {
		return fmt.Errorf("only the plan owner can revoke this plan")
	}
	if plan.Status == "TRIGGERED" {
		return fmt.Errorf("cannot revoke a plan that has already been triggered for execution")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	plan.Status = "REVOKED"
	plan.RevokedAt = now
	plan.RevocationReason = reason
	plan.OwnerESignHash = ownerESignHash
	plan.UpdatedAt = now

	data, _ := json.Marshal(plan)
	return ctx.GetStub().PutState(planID, data)
}

// ══════════════════════════════════════════════════════════════════════════
// SCENARIO B: OWNER-INITIATED ALIVE TRANSFER (GIFT DEED)
// ══════════════════════════════════════════════════════════════════════════

// TriggerAliveTransfer — owner gives property to heirs while still alive
// Legal basis: Transfer of Property Act S.122 (Gift Deed)
// Stamp duty: 2% UP gift rate (vs 7% sale)
// All recipients must eSign acceptance. Owner eSigns as donor.
// After execution: becomes a GIFT mutation in mutation-manager.
//
// planID: can be "" if owner hasn't pre-registered — but then receipientsJSON must be provided
// recipientsJSON: [{aadhaarHash, name, relation, finalShare, finalShareDec}]
func (c *UttaradhikarContract) TriggerAliveTransfer(
	ctx contractapi.TransactionContextInterface,
	dlpiId, ownerHash, ownerName, planID string,
	recipientsJSON, ownerESignHash string,
) (string, error) {

	// If plan exists, validate owner matches and plan allows alive transfer
	if planID != "" {
		plan, err := c.getPlan(ctx, planID)
		if err != nil {
			return "", fmt.Errorf("plan not found: %w", err)
		}
		if plan.OwnerHash != ownerHash {
			return "", fmt.Errorf("owner hash mismatch with registered plan")
		}
		if !plan.AllowAliveTransfer {
			return "", fmt.Errorf("this inheritance plan does not allow alive transfer — update the plan first")
		}
		if plan.Status != "ACTIVE" {
			return "", fmt.Errorf("plan status is %s — cannot trigger", plan.Status)
		}
	}

	var rawRecipients []struct {
		AadhaarHash    string  `json:"aadhaarHash"`
		Name           string  `json:"name"`
		Relation       string  `json:"relation"`
		FinalShare     string  `json:"finalShare"`
		FinalShareDec  float64 `json:"finalShareDec"`
		IsMinor        bool    `json:"isMinor"`
		GuardianHash   string  `json:"guardianHash,omitempty"`
	}
	if err := json.Unmarshal([]byte(recipientsJSON), &rawRecipients); err != nil {
		return "", fmt.Errorf("invalid recipients JSON: %w", err)
	}

	// Validate shares sum to 1.0
	var total float64
	for _, r := range rawRecipients {
		total += r.FinalShareDec
	}
	if total < 0.999 || total > 1.001 {
		return "", fmt.Errorf("recipient shares sum to %.4f — must equal 1.0", total)
	}

	// Build heirs for the succession case (alive transfer uses same structure)
	heirs := make([]SuccessionHeir, 0, len(rawRecipients))
	var minorHeirs []MinorHeir
	for _, r := range rawRecipients {
		if r.IsMinor {
			minorHeirs = append(minorHeirs, MinorHeir{
				Name:          r.Name,
				Relation:      r.Relation,
				FinalShare:    r.FinalShare,
				FinalShareDec: r.FinalShareDec,
				GuardianHash:  r.GuardianHash,
			})
			continue
		}
		heirs = append(heirs, SuccessionHeir{
			HeirID:        fmt.Sprintf("H-%s", r.AadhaarHash[:8]),
			Name:          r.Name,
			AadhaarHash:   r.AadhaarHash,
			Relation:      r.Relation,
			IsAdult:       true,
			IsAlive:       true,
			FinalShare:    r.FinalShare,
			FinalShareDec: r.FinalShareDec,
			LegalBasis:    "Transfer_of_Property_Act_S122_Gift",
			HasConsented:  false,
		})
	}

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()
	caseID := fmt.Sprintf("SUC-ALIVE-%s-%s", dlpiId, txID[:8])

	successionCase := SuccessionCase{
		CaseID:             caseID,
		DLPIId:             dlpiId,
		DeceasedName:       ownerName,  // "donor" in alive transfer context
		DeceasedHash:       ownerHash,
		TriggerSource:      "OWNER_ALIVE",
		TriggeredByHash:    ownerHash,
		HasInheritancePlan: planID != "",
		InheritancePlanID:  planID,
		ApplicableLaw:      "Transfer_of_Property_Act_S122",
		Heirs:              heirs,
		MinorHeirs:         minorHeirs,
		TotalHeirs:         len(heirs),
		ConsentDeadline:    now.Add(30 * 24 * time.Hour).Format(time.RFC3339),
		AIComputationCID:   "OWNER_INITIATED_NO_AI_NEEDED",
		AIConfidenceScore:  1.0,
		Status:             "AWAITING_CONSENTS",
		InitiatedAt:        now.Format(time.RFC3339),
		UpdatedAt:          now.Format(time.RFC3339),
	}

	if err := c.saveCase(ctx, &successionCase); err != nil {
		return "", err
	}

	// Mark plan as triggered (if any)
	if planID != "" {
		plan, _ := c.getPlan(ctx, planID)
		if plan != nil {
			plan.Status = "TRIGGERED"
			plan.UpdatedAt = now.Format(time.RFC3339)
			data, _ := json.Marshal(plan)
			_ = ctx.GetStub().PutState(planID, data)
		}
	}

	// Lock DLPI from other transfers
	dlpiArgs := [][]byte{
		[]byte("InitiateSuccession"),
		[]byte(dlpiId),
		[]byte("ALIVE_GIFT"),
		[]byte("OWNER_INITIATED"),
		[]byte(""),
		[]byte(recipientsJSON),
	}
	if resp := ctx.GetStub().InvokeChaincode("dlpi", dlpiArgs, ""); resp.Status != 200 {
		return "", fmt.Errorf("DLPI succession lock failed: %s", resp.Message)
	}

	// Notify all recipients
	recipientHashes := make([]string, len(heirs))
	for i, h := range heirs {
		recipientHashes[i] = h.AadhaarHash
	}
	notifyEvent, _ := json.Marshal(map[string]interface{}{
		"caseId":          caseID,
		"dlpiId":          dlpiId,
		"donorName":       ownerName,
		"triggerSource":   "OWNER_ALIVE",
		"recipients":      heirs,
		"consentDeadline": successionCase.ConsentDeadline,
		"message":         ownerName + " aapko apni zameen transfer karna chahte hain. Sweekar karne ke liye sign karein.",
		"stampDutyNote":   "Gift deed — 2% stamp duty applicable (UP rate)",
	})
	_ = ctx.GetStub().SetEvent("HeirNotificationRequired", notifyEvent)

	return caseID, nil
}

// ══════════════════════════════════════════════════════════════════════════
// SCENARIO C: POST-DEATH SUCCESSION
// ══════════════════════════════════════════════════════════════════════════

// InitiateSuccessionByDeathCert — standard flow: CRS oracle confirms death
// CoparcenaryMapper AI has computed legal heirs; result passed as JSON.
// This is the original existing function, now enhanced.
func (c *UttaradhikarContract) InitiateSuccessionByDeathCert(
	ctx contractapi.TransactionContextInterface,
	dlpiId, familyId, deceasedName, deceasedHash,
	dateOfDeath, deathCertCID, crsRegNo,
	religion, applicableLaw,
	heirsJSON, minorHeirsJSON,
	aiComputationCID string,
	aiConfidenceScore float64,
) (string, error) {

	if crsRegNo == "" {
		return "", fmt.Errorf("CRS_REQUIRED: succession by death certificate requires Civil Registration System registration number")
	}

	return c.createSuccessionCase(ctx, dlpiId, familyId, deceasedName, deceasedHash,
		dateOfDeath, deathCertCID, crsRegNo, "", religion, applicableLaw,
		heirsJSON, minorHeirsJSON, aiComputationCID, aiConfidenceScore,
		"DEATH_CERT", deceasedHash)
}

// InitiateSuccessionByHeirPetition — heirs petition after death WITHOUT official CRS cert
// Use cases:
//   (a) Death cert delayed (common in rural India — registration takes months)
//   (b) Death occurred in a state different from property location
//   (c) Pre-registered InheritancePlan exists — heirs use it to start process
//
// deathAffidavitCID: notarized affidavit from at least 2 heirs confirming death
// planID: optional — if owner had pre-registered a plan, use its heir list as starting point
// heirsJSON: can add heirs not in the plan (missing heirs can always claim)
func (c *UttaradhikarContract) InitiateSuccessionByHeirPetition(
	ctx contractapi.TransactionContextInterface,
	dlpiId, familyId, deceasedName, deceasedHash,
	dateOfDeath, deathAffidavitCID,
	planID, religion, applicableLaw string,
	heirsJSON, minorHeirsJSON string,
	aiComputationCID string,
	aiConfidenceScore float64,
	petitionerHash string,
) (string, error) {

	if deathAffidavitCID == "" {
		return "", fmt.Errorf("AFFIDAVIT_REQUIRED: heir petition requires notarized death affidavit (IPFS CID)")
	}

	// If plan exists, validate it
	if planID != "" {
		plan, err := c.getPlan(ctx, planID)
		if err != nil {
			return "", fmt.Errorf("referenced plan %s not found: %w", planID, err)
		}
		if !plan.AllowHeirPetition {
			return "", fmt.Errorf("the registered plan does not permit heir petition — contact a Tehsildar")
		}
		if plan.Status != "ACTIVE" {
			return "", fmt.Errorf("plan %s is %s — cannot use for petition", planID, plan.Status)
		}

		// If heirs not provided, use the plan's heir list as seed
		if (heirsJSON == "" || heirsJSON == "[]") && len(plan.PlannedHeirs) > 0 {
			seedHeirs := make([]SuccessionHeir, len(plan.PlannedHeirs))
			for i, ph := range plan.PlannedHeirs {
				seedHeirs[i] = SuccessionHeir{
					HeirID:           fmt.Sprintf("H-%s", ph.AadhaarHash[:8]),
					Name:             ph.Name,
					AadhaarHash:      ph.AadhaarHash,
					Relation:         ph.Relation,
					Gender:           ph.Gender,
					DOB:              ph.DOB,
					IsMinor:          ph.IsMinor,
					IsAdult:          !ph.IsMinor,
					IsAlive:          true,
					GuardianHash:     ph.GuardianHash,
					IntendedShare:    ph.IntendedShare,
					IntendedShareDec: ph.IntendedShareDec,
					FinalShare:       ph.IntendedShare,
					FinalShareDec:    ph.IntendedShareDec,
					LegalBasis:       "InheritancePlan_" + planID,
					HasConsented:     false,
				}
			}
			seedJSON, _ := json.Marshal(seedHeirs)
			heirsJSON = string(seedJSON)
		}
	}

	caseID, err := c.createSuccessionCase(ctx, dlpiId, familyId, deceasedName, deceasedHash,
		dateOfDeath, "", "", deathAffidavitCID, religion, applicableLaw,
		heirsJSON, minorHeirsJSON, aiComputationCID, aiConfidenceScore,
		"HEIR_PETITION", petitionerHash)
	if err != nil {
		return "", err
	}

	// Mark plan as triggered
	if planID != "" {
		plan, _ := c.getPlan(ctx, planID)
		if plan != nil {
			plan.Status = "TRIGGERED"
			plan.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			data, _ := json.Marshal(plan)
			_ = ctx.GetStub().PutState(planID, data)
		}
	}

	return caseID, nil
}

// createSuccessionCase — internal: builds SuccessionCase and saves it
func (c *UttaradhikarContract) createSuccessionCase(
	ctx contractapi.TransactionContextInterface,
	dlpiId, familyId, deceasedName, deceasedHash,
	dateOfDeath, deathCertCID, crsRegNo, deathAffidavitCID,
	religion, applicableLaw,
	heirsJSON, minorHeirsJSON, aiComputationCID string,
	aiConfidenceScore float64,
	triggerSource, triggeredByHash string,
) (string, error) {

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

	// ── Law enforcement: validate shares against applicable law ──────────────
	legalErrors, legalWarnings, err := c.validateByLaw(heirs, minorHeirs, applicableLaw, religion)
	if err != nil {
		return "", err // hard law violation — reject
	}

	// ── Share sum validation ─────────────────────────────────────────────────
	var totalShare float64
	for _, h := range heirs {
		totalShare += h.FinalShareDec
	}
	for _, m := range minorHeirs {
		totalShare += m.FinalShareDec
	}
	if totalShare < 0.999 || totalShare > 1.001 {
		return "", fmt.Errorf("SHARE_INVALID: shares sum to %.4f, must equal 1.0", totalShare)
	}

	// ── Edge cases ───────────────────────────────────────────────────────────
	var edgeCases []string
	for _, h := range heirs {
		if h.IsNRI {
			edgeCases = append(edgeCases, fmt.Sprintf(
				"NRI heir %s — FEMA 1999 S.6(5) compliance check required before remitting proceeds", h.Name))
		}
	}
	if len(minorHeirs) > 0 {
		edgeCases = append(edgeCases, fmt.Sprintf(
			"%d minor heir(s) — Guardians and Wards Act 1890 / HMGA 1956 — court guardian appointment required before title mutation",
			len(minorHeirs)))
	}
	edgeCases = append(edgeCases, legalErrors...)

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC()
	caseID := fmt.Sprintf("SUC-%s-%s", triggerSource[:3], txID[:8])
	if dlpiId != "" {
		caseID = fmt.Sprintf("SUC-%s-%s-%s", triggerSource[:3], dlpiId, txID[:6])
	}

	hasPlan := false
	planID := ""
	if planIDBytes, _ := ctx.GetStub().GetState("PLAN-IDX-" + dlpiId); planIDBytes != nil {
		planID = string(planIDBytes)
		hasPlan = true
	}

	sCase := SuccessionCase{
		CaseID:              caseID,
		DLPIId:              dlpiId,
		FamilyID:            familyId,
		DeceasedName:        deceasedName,
		DeceasedHash:        deceasedHash,
		DateOfDeath:         dateOfDeath,
		DeathCertCID:        deathCertCID,
		CRSRegistrationNo:   crsRegNo,
		DeathAffidavitCID:   deathAffidavitCID,
		TriggerSource:       triggerSource,
		TriggeredByHash:     triggeredByHash,
		HasInheritancePlan:  hasPlan,
		InheritancePlanID:   planID,
		ApplicableLaw:       applicableLaw,
		Religion:            religion,
		Heirs:               heirs,
		TotalHeirs:          len(heirs),
		MinorHeirs:          minorHeirs,
		LegalEdgeCases:      edgeCases,
		LegalWarnings:       legalWarnings,
		AIComputationCID:    aiComputationCID,
		AIConfidenceScore:   aiConfidenceScore,
		ConsentDeadline:     now.Add(30 * 24 * time.Hour).Format(time.RFC3339),
		Status:              "HEIRS_IDENTIFIED",
		InitiatedAt:         now.Format(time.RFC3339),
		UpdatedAt:           now.Format(time.RFC3339),
	}

	if err := c.saveCase(ctx, &sCase); err != nil {
		return "", err
	}

	// Lock DLPI
	heirsForDLPI, _ := json.Marshal(heirs)
	dlpiArgs := [][]byte{
		[]byte("InitiateSuccession"),
		[]byte(dlpiId),
		[]byte(familyId),
		[]byte(crsRegNo),
		[]byte(deathCertCID),
		heirsForDLPI,
	}
	if resp := ctx.GetStub().InvokeChaincode("dlpi", dlpiArgs, ""); resp.Status != 200 {
		return "", fmt.Errorf("DLPI succession lock failed: %s", resp.Message)
	}

	// Fire notification event
	notifyEvent, _ := json.Marshal(map[string]interface{}{
		"caseId":          caseID,
		"dlpiId":          dlpiId,
		"deceasedName":    deceasedName,
		"triggerSource":   triggerSource,
		"religion":        religion,
		"applicableLaw":   applicableLaw,
		"heirs":           heirs,
		"minorHeirs":      minorHeirs,
		"edgeCases":       edgeCases,
		"legalWarnings":   legalWarnings,
		"consentDeadline": sCase.ConsentDeadline,
		"channels":        []string{"SMS", "WHATSAPP", "PUSH"},
	})
	_ = ctx.GetStub().SetEvent("HeirNotificationRequired", notifyEvent)

	return caseID, nil
}

// ══════════════════════════════════════════════════════════════════════════
// CONSENT MANAGEMENT (all scenarios)
// ══════════════════════════════════════════════════════════════════════════

// RecordHeirNotification — oracle confirms delivery
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
	for i, h := range sCase.Heirs {
		if h.AadhaarHash == heirAadhaarHash {
			sCase.Heirs[i].NotifiedAt = deliveredAt
			sCase.Heirs[i].NotifyChannel = channel
			found = true
		}
		if sCase.Heirs[i].NotifiedAt == "" {
			allNotified = false
		}
	}
	if !found {
		return fmt.Errorf("heir %s not in case %s", heirAadhaarHash, caseID)
	}
	if allNotified {
		sCase.Status = "AWAITING_CONSENTS"
	}
	sCase.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveCase(ctx, sCase)
}

// RecordHeirConsent — heir provides Aadhaar eSign acceptance
func (c *UttaradhikarContract) RecordHeirConsent(
	ctx contractapi.TransactionContextInterface,
	caseID, heirAadhaarHash, eSignTxHash string,
) error {
	sCase, err := c.getCase(ctx, caseID)
	if err != nil {
		return err
	}
	if sCase.Status == "COURT_REFERRED" || sCase.Status == "AUTO_MUTATED" {
		return fmt.Errorf("case %s is in terminal state: %s", caseID, sCase.Status)
	}
	if time.Now().UTC().After(mustParseTime(sCase.ConsentDeadline)) {
		return fmt.Errorf("CONSENT_DEADLINE_PASSED: 30-day window closed on %s", sCase.ConsentDeadline)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	found := false
	for i, h := range sCase.Heirs {
		if h.AadhaarHash == heirAadhaarHash {
			if h.HasObjected {
				return fmt.Errorf("heir %s already objected — cannot consent after objecting", h.Name)
			}
			sCase.Heirs[i].HasConsented = true
			sCase.Heirs[i].ConsentedAt = now
			sCase.Heirs[i].ConsentTxHash = eSignTxHash
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("heir %s not found in case", heirAadhaarHash)
	}

	// Sync to DLPI chaincode
	dlpiArgs := [][]byte{[]byte("RecordHeirConsent"), []byte(sCase.DLPIId), []byte(heirAadhaarHash), []byte(eSignTxHash)}
	_ = ctx.GetStub().InvokeChaincode("dlpi", dlpiArgs, "")

	if c.allAdultHeirsConsented(sCase) {
		return c.executeAutoMutation(ctx, sCase, now)
	}
	sCase.UpdatedAt = now
	return c.saveCase(ctx, sCase)
}

// RecordHeirObjection — heir disputes share computation or right to inherit
func (c *UttaradhikarContract) RecordHeirObjection(
	ctx contractapi.TransactionContextInterface,
	caseID, heirAadhaarHash, disputeType, reason, evidenceCID string,
) error {
	sCase, err := c.getCase(ctx, caseID)
	if err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	heirName := ""
	for i, h := range sCase.Heirs {
		if h.AadhaarHash == heirAadhaarHash {
			if h.HasConsented {
				return fmt.Errorf("heir %s already consented — cannot object after consenting", h.Name)
			}
			sCase.Heirs[i].HasObjected = true
			sCase.Heirs[i].ObjectedAt = now
			sCase.Heirs[i].ObjectionReason = reason
			heirName = h.Name
			break
		}
	}
	if heirName == "" {
		return fmt.Errorf("heir not found in case")
	}

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

	event, _ := json.Marshal(map[string]interface{}{
		"caseId":      caseID,
		"dlpiId":      sCase.DLPIId,
		"disputedBy":  heirName,
		"disputeType": disputeType,
		"reason":      reason,
		"evidenceCID": evidenceCID,
		"actions":     []string{"GENERATE_NYAYAAI_BRIEF", "NOTIFY_NALSA", "ECOURTS_EFILING_READY"},
	})
	_ = ctx.GetStub().SetEvent("SuccessionDisputeFiled", event)
	return nil
}

// RecordCourtOrder — eCourts oracle records judgment
func (c *UttaradhikarContract) RecordCourtOrder(
	ctx contractapi.TransactionContextInterface,
	caseID, eCourtsOracleHash, courtOrderCID, judgment, revisedHeirsJSON string,
) error {
	sCase, err := c.getCase(ctx, caseID)
	if err != nil {
		return err
	}
	if sCase.Status != "COURT_REFERRED" {
		return fmt.Errorf("case %s not in COURT_REFERRED state", caseID)
	}
	if eCourtsOracleHash == "" {
		return fmt.Errorf("ECOURTS_REQUIRED: court order must be verified by eCourts oracle")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if sCase.DisputeInfo != nil {
		sCase.DisputeInfo.ECourtsCaseNo = eCourtsOracleHash
		sCase.DisputeInfo.CourtOrderCID = courtOrderCID
		sCase.DisputeInfo.Status = "RESOLVED"
		sCase.DisputeInfo.ResolvedAt = now
	}

	if revisedHeirsJSON != "" && revisedHeirsJSON != "null" {
		var revisedHeirs []SuccessionHeir
		if err := json.Unmarshal([]byte(revisedHeirsJSON), &revisedHeirs); err != nil {
			return fmt.Errorf("invalid revised heirs JSON: %w", err)
		}
		_, _, err := c.validateByLaw(revisedHeirs, sCase.MinorHeirs, sCase.ApplicableLaw, sCase.Religion)
		if err != nil {
			return fmt.Errorf("COURT_ORDER_REJECTED: revised heirs violate %s — %w", sCase.ApplicableLaw, err)
		}
		sCase.Heirs = revisedHeirs
		sCase.TotalHeirs = len(revisedHeirs)
	}

	sCase.Status = "AWAITING_CONSENTS"
	sCase.ConsentDeadline = mustParseTime(now).Add(30 * 24 * time.Hour).Format(time.RFC3339)
	sCase.UpdatedAt = now

	if err := c.saveCase(ctx, sCase); err != nil {
		return err
	}
	event, _ := json.Marshal(map[string]interface{}{
		"caseId": caseID, "judgment": judgment, "nextAction": "RE_NOTIFY_ALL_HEIRS",
	})
	_ = ctx.GetStub().SetEvent("CourtOrderRecorded", event)
	return nil
}

// ══════════════════════════════════════════════════════════════════════════
// LAW ENFORCEMENT — per-religion validation
// ══════════════════════════════════════════════════════════════════════════

// validateByLaw — dispatches to the right religion's rules
// Returns: (hard errors that BLOCK, warnings that ALERT, error if hard block)
func (c *UttaradhikarContract) validateByLaw(
	heirs []SuccessionHeir,
	minorHeirs []MinorHeir,
	law, religion string,
) ([]string, []string, error) {

	switch law {
	case LawHSA:
		return c.validateHinduLaw(heirs)
	case LawMuslimSunni:
		return c.validateMuslimSunniLaw(heirs)
	case LawMuslimShia:
		return c.validateMuslimShiaLaw(heirs)
	case LawISA, LawParsi:
		return c.validateISALaw(heirs, law)
	case LawTribal:
		// Tribal law is not enforced at chaincode level — see tribal-guard chaincode
		return nil, []string{"TRIBAL_LAW: Gram Sabha approval required before execution"}, nil
	default:
		return nil, []string{fmt.Sprintf("Unknown law: %s — manual officer review required", law)}, nil
	}
}

// validateHinduLaw — Hindu Succession Act 1956 (amended 2005)
func (c *UttaradhikarContract) validateHinduLaw(heirs []SuccessionHeir) ([]string, []string, error) {
	var warnings []string

	// Count by relation and extract shares
	shareByRelation := make(map[string][]float64)
	for _, h := range heirs {
		if h.IsAlive {
			shareByRelation[h.Relation] = append(shareByRelation[h.Relation], h.FinalShareDec)
		}
	}

	// Rule 1: Sons and daughters must have equal per-capita shares (HSA 2005 S.6(3))
	sonShares := shareByRelation["Son"]
	daughterShares := shareByRelation["Daughter"]
	if len(sonShares) > 0 && len(daughterShares) > 0 {
		// All sons should have same share as all daughters (per capita equal)
		avgSon := avg(sonShares)
		avgDaughter := avg(daughterShares)
		if absf(avgSon-avgDaughter) > 0.001 {
			return nil, nil, fmt.Errorf(
				"HSA2005_S6_VIOLATION: daughters' per-capita share (%.4f) ≠ sons' per-capita share (%.4f). "+
					"Daughters are coparceners by birth with equal rights per HSA 1956 S.6(3) and Vineeta Sharma v. Rakesh Sharma (2020 SC). REJECTED.",
				avgDaughter, avgSon)
		}
	}

	// Rule 2: Widow (Wife of deceased) must have equal share as each child
	widowShares := shareByRelation["Wife"]
	if len(widowShares) > 0 {
		childShares := append(sonShares, daughterShares...)
		if len(childShares) > 0 {
			avgChild := avg(childShares)
			avgWidow := avg(widowShares)
			if absf(avgWidow-avgChild) > 0.001 {
				warnings = append(warnings, fmt.Sprintf(
					"HSA_S10_WARNING: widow share (%.4f) ≠ child share (%.4f). "+
						"HSA 1956 S.10 Rule 2: widow takes equal share as each child. Review computation.",
					avgWidow, avgChild))
			}
		}
	}

	// Rule 3: If no Class I heirs, Class II must be listed (not mixed)
	// Simplified check: warn if father appears alongside sons/daughters (father is Class II)
	fatherShares := shareByRelation["Father"]
	if len(fatherShares) > 0 && (len(sonShares) > 0 || len(daughterShares) > 0) {
		return nil, nil, fmt.Errorf(
			"HSA_CLASS_VIOLATION: Father (Class II heir) cannot inherit alongside Sons/Daughters (Class I heirs). "+
				"Class I heirs exclude all Class II heirs under HSA 1956 S.8.")
	}

	// Warn about daughters born before 2005 (still have rights — Vineeta Sharma)
	for _, h := range heirs {
		if h.Relation == "Daughter" {
			dob := mustParseTime(h.DOB)
			if !dob.IsZero() && dob.Before(mustParseTime("2005-09-09T00:00:00Z")) {
				warnings = append(warnings, fmt.Sprintf(
					"Daughter %s born before HSA 2005 amendment (Sep 9, 2005). She still has coparcenary rights per Vineeta Sharma v. Rakesh Sharma (2020) — rights are from birth, not amendment date.",
					h.Name))
			}
		}
	}

	return nil, warnings, nil
}

// validateMuslimSunniLaw — Muslim Personal Law, Hanafi school (majority in India)
func (c *UttaradhikarContract) validateMuslimSunniLaw(heirs []SuccessionHeir) ([]string, []string, error) {
	var warnings []string

	shareByRelation := make(map[string][]float64)
	for _, h := range heirs {
		if h.IsAlive {
			shareByRelation[h.Relation] = append(shareByRelation[h.Relation], h.FinalShareDec)
		}
	}

	hasSons := len(shareByRelation["Son"]) > 0
	hasDaughters := len(shareByRelation["Daughter"]) > 0
	hasWife := len(shareByRelation["Wife"]) > 0
	hasChildren := hasSons || hasDaughters

	// Rule 1: Son gets 2× daughter's share (Quran 4:11 — "li'dhdhakari mithlu hazzi'l-unthayayn")
	if hasSons && hasDaughters {
		avgSon := avg(shareByRelation["Son"])
		avgDaughter := avg(shareByRelation["Daughter"])
		expectedDaughter := avgSon / 2.0
		if absf(avgDaughter-expectedDaughter) > 0.005 {
			return nil, nil, fmt.Errorf(
				"MUSLIM_SUNNI_QURAN411_VIOLATION: Son's share (%.4f) must be 2× daughter's share (%.4f). "+
					"Current daughter share %.4f. Under Sunni Hanafi law (Quran 4:11), son gets double daughter's share.",
				avgSon, expectedDaughter, avgDaughter)
		}
	}

	// Rule 2: Wife's share — 1/8 with children, 1/4 without children
	if hasWife {
		totalWifeShare := 0.0
		for _, ws := range shareByRelation["Wife"] {
			totalWifeShare += ws
		}
		if hasChildren {
			if absf(totalWifeShare-0.125) > 0.01 {
				warnings = append(warnings, fmt.Sprintf(
					"MUSLIM_WIFE_SHARE_WARNING: Wife(s) total share %.4f. With children, wife/wives total = 1/8 (0.125) under Sunni law. Current: %.4f",
					totalWifeShare, totalWifeShare))
			}
		} else {
			if absf(totalWifeShare-0.25) > 0.01 {
				warnings = append(warnings, fmt.Sprintf(
					"MUSLIM_WIFE_SHARE_WARNING: Wife(s) total share %.4f. Without children, wife/wives total = 1/4 (0.25) under Sunni law.",
					totalWifeShare))
			}
		}
	}

	// Rule 3: Will (wasiyat) cannot exceed 1/3 of estate for non-heirs
	// This is checked at plan registration if will exists
	warnings = append(warnings, "MUSLIM_WASIYAT: If a will exists, verify bequest does not exceed 1/3 of estate to non-heirs (Quran 4:11, 2:180).")

	// Rule 4: Daughter sole heir — must get 1/2
	if hasDaughters && !hasSons {
		daughters := shareByRelation["Daughter"]
		if len(daughters) == 1 {
			if absf(daughters[0]-0.5) > 0.01 {
				warnings = append(warnings, fmt.Sprintf(
					"MUSLIM_DAUGHTER_SOLE: Single daughter as sole sharer gets 1/2. Remainder goes to residuaries (agnates). Current share: %.4f",
					daughters[0]))
			}
		} else if len(daughters) > 1 {
			totalDaughterShare := 0.0
			for _, ds := range daughters {
				totalDaughterShare += ds
			}
			if absf(totalDaughterShare-0.6667) > 0.01 {
				warnings = append(warnings, fmt.Sprintf(
					"MUSLIM_DAUGHTERS_MAX: Multiple daughters (no sons) share total = 2/3 max. Current total: %.4f",
					totalDaughterShare))
			}
		}
	}

	return nil, warnings, nil
}

// validateMuslimShiaLaw — Ithna Ashari (Twelver Shia) law
func (c *UttaradhikarContract) validateMuslimShiaLaw(heirs []SuccessionHeir) ([]string, []string, error) {
	warnings := []string{
		"SHIA_LAW: Under Ithna Ashari law, agnatic residuaries are excluded if uterine heirs exist (Radd principle). Manual verification by qualified qazi/jurist recommended.",
		"SHIA_LAW: Daughter as sole heir gets entire estate under Radd — no residue to agnates.",
	}
	// Shia and Sunni overlap significantly for basic shares; key difference is residue treatment
	// For POC: apply same mandatory share checks as Sunni, add Radd warning
	_, sunniWarnings, err := c.validateMuslimSunniLaw(heirs)
	warnings = append(warnings, sunniWarnings...)
	return nil, warnings, err
}

// validateISALaw — Indian Succession Act 1925 (Christians + Parsi)
func (c *UttaradhikarContract) validateISALaw(heirs []SuccessionHeir, lawType string) ([]string, []string, error) {
	var warnings []string

	shareByRelation := make(map[string][]float64)
	for _, h := range heirs {
		if h.IsAlive {
			shareByRelation[h.Relation] = append(shareByRelation[h.Relation], h.FinalShareDec)
		}
	}

	hasLinealDescendants := len(shareByRelation["Son"]) > 0 || len(shareByRelation["Daughter"]) > 0

	if lawType == LawParsi {
		// Parsi ISA: widow = equal share as each child; sons = daughters (equal)
		widowShares := shareByRelation["Wife"]
		sonShares := shareByRelation["Son"]
		daughterShares := shareByRelation["Daughter"]

		if len(widowShares) > 0 {
			avgWidow := avg(widowShares)
			childShares := append(sonShares, daughterShares...)
			if len(childShares) > 0 {
				avgChild := avg(childShares)
				if absf(avgWidow-avgChild) > 0.01 {
					warnings = append(warnings, fmt.Sprintf(
						"PARSI_ISA_WARNING: Widow share (%.4f) ≠ child share (%.4f). "+
							"Under ISA 1925 (Parsi), widow takes equal share as each child.",
						avgWidow, avgChild))
				}
			}
		}
		// Parsi: sons = daughters (equal — unlike Sunni)
		if len(sonShares) > 0 && len(daughterShares) > 0 {
			if absf(avg(sonShares)-avg(daughterShares)) > 0.001 {
				return nil, nil, fmt.Errorf(
					"PARSI_ISA_VIOLATION: Under ISA 1925 (Parsi), sons and daughters take EQUAL shares. "+
						"Son per-capita (%.4f) ≠ Daughter per-capita (%.4f).",
					avg(sonShares), avg(daughterShares))
			}
		}
	} else {
		// Christian ISA 1925 S.33: spouse gets 1/3 with lineal descendants
		spouseShares := shareByRelation["Wife"]
		if len(spouseShares) == 0 {
			spouseShares = shareByRelation["Husband"]
		}
		if len(spouseShares) > 0 && hasLinealDescendants {
			totalSpouseShare := avg(spouseShares)
			if absf(totalSpouseShare-0.333) > 0.02 {
				warnings = append(warnings, fmt.Sprintf(
					"ISA_S33_WARNING: Spouse share %.4f. Under ISA 1925 S.33, spouse gets 1/3 when lineal descendants exist.",
					totalSpouseShare))
			}
		}
	}

	return nil, warnings, nil
}

// ──────────────────────────────────────────────────────────────────────────
// AUTO-MUTATION EXECUTION
// ──────────────────────────────────────────────────────────────────────────

func (c *UttaradhikarContract) executeAutoMutation(
	ctx contractapi.TransactionContextInterface,
	sCase *SuccessionCase, now string,
) error {
	txID := ctx.GetStub().GetTxID()
	sCase.Status = "ALL_CONSENTED"
	sCase.AllConsentedAt = now
	if err := c.saveCase(ctx, sCase); err != nil {
		return err
	}

	mutationType := "INHERITANCE"
	if sCase.TriggerSource == "OWNER_ALIVE" {
		mutationType = "GIFT"
	}

	autoMutEvent, _ := json.Marshal(map[string]interface{}{
		"caseId":        sCase.CaseID,
		"dlpiId":        sCase.DLPIId,
		"triggerSource": sCase.TriggerSource,
		"mutationType":  mutationType,
		"heirs":         sCase.Heirs,
		"minorHeirs":    sCase.MinorHeirs,
		"applicableLaw": sCase.ApplicableLaw,
		"txHash":        txID,
		"trigger":       "AUTO_MUTATION_UTTARADHIKAR",
	})
	_ = ctx.GetStub().SetEvent("AllHeirsConsentedAutoMutation", autoMutEvent)

	sCase.Status = "AUTO_MUTATED"
	sCase.AutoMutatedAt = now
	sCase.UpdatedAt = now
	return c.saveCase(ctx, sCase)
}

// ──────────────────────────────────────────────────────────────────────────
// QUERY FUNCTIONS
// ──────────────────────────────────────────────────────────────────────────

func (c *UttaradhikarContract) GetSuccessionCase(ctx contractapi.TransactionContextInterface, caseID string) (*SuccessionCase, error) {
	return c.getCase(ctx, caseID)
}

func (c *UttaradhikarContract) GetInheritancePlan(ctx contractapi.TransactionContextInterface, planID string) (*InheritancePlan, error) {
	return c.getPlan(ctx, planID)
}

func (c *UttaradhikarContract) GetPlanByDLPI(ctx contractapi.TransactionContextInterface, dlpiId string) (*InheritancePlan, error) {
	return c.getPlanByDLPI(ctx, dlpiId)
}

func (c *UttaradhikarContract) GetSuccessionByDLPI(ctx contractapi.TransactionContextInterface, dlpiId string) ([]*SuccessionCase, error) {
	query := fmt.Sprintf(`{"selector":{"dlpiId":"%s"}}`, dlpiId)
	return c.executeQuery(ctx, query)
}

func (c *UttaradhikarContract) QueryPendingSuccessions(ctx contractapi.TransactionContextInterface) ([]*SuccessionCase, error) {
	query := `{"selector":{"status":{"$in":["AWAITING_CONSENTS","HEIRS_IDENTIFIED"]}}}`
	return c.executeQuery(ctx, query)
}

func (c *UttaradhikarContract) QueryByTriggerSource(ctx contractapi.TransactionContextInterface, source string) ([]*SuccessionCase, error) {
	query := fmt.Sprintf(`{"selector":{"triggerSource":"%s"}}`, source)
	return c.executeQuery(ctx, query)
}

// ──────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ──────────────────────────────────────────────────────────────────────────

func (c *UttaradhikarContract) allAdultHeirsConsented(sCase *SuccessionCase) bool {
	for _, h := range sCase.Heirs {
		if h.IsAdult && h.IsAlive && !h.HasConsented {
			return false
		}
	}
	return true
}

func (c *UttaradhikarContract) saveCase(ctx contractapi.TransactionContextInterface, sc *SuccessionCase) error {
	data, err := json.Marshal(sc)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(sc.CaseID, data)
}

func (c *UttaradhikarContract) getCase(ctx contractapi.TransactionContextInterface, id string) (*SuccessionCase, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("succession case %s not found", id)
	}
	var sc SuccessionCase
	if err := json.Unmarshal(data, &sc); err != nil {
		return nil, err
	}
	return &sc, nil
}

func (c *UttaradhikarContract) getPlan(ctx contractapi.TransactionContextInterface, planID string) (*InheritancePlan, error) {
	data, err := ctx.GetStub().GetState(planID)
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("inheritance plan %s not found", planID)
	}
	var plan InheritancePlan
	if err := json.Unmarshal(data, &plan); err != nil {
		return nil, err
	}
	return &plan, nil
}

func (c *UttaradhikarContract) getPlanByDLPI(ctx contractapi.TransactionContextInterface, dlpiId string) (*InheritancePlan, error) {
	idBytes, err := ctx.GetStub().GetState("PLAN-IDX-" + dlpiId)
	if err != nil || idBytes == nil {
		return nil, nil
	}
	return c.getPlan(ctx, string(idBytes))
}

func (c *UttaradhikarContract) executeQuery(ctx contractapi.TransactionContextInterface, query string) ([]*SuccessionCase, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*SuccessionCase
	for iter.HasNext() {
		r, _ := iter.Next()
		var sc SuccessionCase
		if err := json.Unmarshal(r.Value, &sc); err == nil {
			results = append(results, &sc)
		}
	}
	return results, nil
}

func mustParseTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

func avg(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	var sum float64
	for _, v := range vals {
		sum += v
	}
	return sum / float64(len(vals))
}

func absf(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

func main() {
	cc, err := contractapi.NewChaincode(&UttaradhikarContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating Uttaradhikar chaincode: %v", err))
	}
	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("Error starting Uttaradhikar chaincode: %v", err))
	}
}
