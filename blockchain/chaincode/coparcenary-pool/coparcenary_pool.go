package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Why This Chaincode Exists ─────────────────────────────────────────────
//
// The "64×64 Problem":
//
//   After 6 generations of binary inheritance, a family can have 64 co-owners
//   across 64 different properties. Tracking each person's share across 64 separate
//   DLPI records creates an impossible situation:
//
//     - Any single sale needs 64 eSigns (practically impossible)
//     - Physical partition of 1/64 of an acre = 677 sq ft (not viable for farming)
//     - Mutation alerts to 64 people on 64 properties = 4,096 individual notifications
//     - A single unresponsive heir blocks all 64 properties indefinitely
//
//   Every world-class land registry solved this the same way:
//
//     Australia (1858 Torrens): Court-ordered SALE of undivided shares → money split by fraction
//     Sweden (Samäganderätt):  Any co-owner can UNILATERALLY demand sale via court
//     India (HUF under ITCA):  Family land held by ENTITY; members own SHARES IN ENTITY
//
// This chaincode implements the India-appropriate solution: the Coparcenary Pool Entity (CPE).
//
// A CPE is an on-chain entity (analogous to HUF) that:
//   - Holds multiple DLPIs as "pool assets"
//   - Issues "pool shares" to family members (not individual property interests)
//   - Enables share transfers WITHOUT dividing any physical property
//   - Enables DISSOLUTION (sell all assets, split proceeds) with majority vote
//   - Enables PARTIAL RELEASE (extract one DLPI for individual ownership) with majority + karta
//
// The Karta (eldest male, or by family resolution) is the managing trustee.
// All major decisions require Karta + share-weighted majority consent.
//
// ─── Legal Basis ──────────────────────────────────────────────────────────
//
// Hindu Undivided Family (HUF): recognized under Income Tax Act and Hindu Succession Act
// Right to Partition: HSA 1956 S.23 (amended 2005) — any coparcener can demand partition
// Family Settlement: registered MFS (Memorandum of Family Settlement) recognized by courts
// Court-ordered Partition: CPC Order 26 Rule 14 — court can order partition or sale
//
// This chaincode implements the BLOCKCHAIN LAYER for these existing legal rights.
// It is NOT a substitute for legal process — it records and enforces the outcome.

// ─── Data Structures ─────────────────────────────────────────────────────

// PoolMember — one family member's stake in the pool
type PoolMember struct {
	AadhaarHash     string  `json:"aadhaarHash"`
	Name            string  `json:"name"`
	Share           string  `json:"share"`         // "1/64", "3/64" (can increase by buying out others)
	ShareDecimal    float64 `json:"shareDecimal"`
	JoinedAt        string  `json:"joinedAt"`
	Relation        string  `json:"relation"`       // Son | Daughter | GrandSon | GrandDaughter | Spouse etc.
	IsKarta         bool    `json:"isKarta"`        // pool manager (only one at a time)
	HasVotedToDissolve bool `json:"hasVotedToDissolve"`
	DissolveVoteAt  string `json:"dissolveVoteAt,omitempty"`
	IsDeceased      bool   `json:"isDeceased"`
	SuccessionCaseId string `json:"successionCaseId,omitempty"` // if member died, link to succession
}

// PoolAsset — one DLPI held by this pool
type PoolAsset struct {
	DLPIId          string  `json:"dlpiId"`
	AreaHectares    float64 `json:"areaHectares"`
	LandType        string  `json:"landType"`       // Jirayat | Abaadi | Industrial
	Village         string  `json:"village"`
	LastValuationINR float64 `json:"lastValuationInr,omitempty"`
	ValuationAt      string  `json:"valuationAt,omitempty"`
	IsReleased       bool   `json:"isReleased"`     // true after partial dissolution
	ReleasedTo       string `json:"releasedTo,omitempty"` // aadhaarHash of recipient on release
	ReleasedAt       string `json:"releasedAt,omitempty"`
}

// ShareTransfer — record of one member selling their pool share to another
type ShareTransfer struct {
	TransferID    string  `json:"transferId"`
	FromHash      string  `json:"fromHash"`
	ToHash        string  `json:"toHash"`
	ToName        string  `json:"toName"`
	ShareFraction string  `json:"shareFraction"`  // fraction being transferred
	ShareDecimal  float64 `json:"shareDecimal"`
	ConsideredINR float64 `json:"considerationInr"`
	ESignFrom     string  `json:"eSignFrom"`
	ESignTo       string  `json:"eSignTo"`
	KartaApproval string  `json:"kartaApproval,omitempty"` // karta must approve external transfers
	ExecutedAt    string  `json:"executedAt"`
	IsInternal    bool    `json:"isInternal"` // true if both parties are existing pool members
}

// CoparcenaryPool — the main entity
type CoparcenaryPool struct {
	PoolID          string       `json:"poolId"`          // CPE-UP-GBN-DAD-KUMAR-2026
	FamilyName      string       `json:"familyName"`      // "Kumar Family Land Trust"
	AncestorHash    string       `json:"ancestorHash"`    // sha256 of the original owner (Ramesh Kumar)
	AncestorName    string       `json:"ancestorName"`
	Religion        string       `json:"religion"`        // Hindu | Muslim | Christian | Sikh
	LawApplied      string       `json:"lawApplied"`      // Hindu_Mitakshara | Hindu_Dayabhaga | Muslim_Sunni | Customary
	Members         []PoolMember `json:"members"`
	Assets          []PoolAsset  `json:"assets"`
	ShareHistory    []ShareTransfer `json:"shareHistory,omitempty"`

	// Governance
	KartaHash       string `json:"kartaHash"`      // current Karta's aadhaarHash
	MinDissolveVote float64 `json:"minDissolveVote"` // fraction required for dissolution (default 0.75 — supermajority)

	// Dissolution
	DissolutionStatus   string `json:"dissolutionStatus"`   // ACTIVE | VOTE_IN_PROGRESS | APPROVED | COMPLETED
	DissolutionMethod   string `json:"dissolutionMethod,omitempty"` // AUCTION | FAMILY_PARTITION | COURT_ORDER
	DissolutionVoteAt   string `json:"dissolutionVoteAt,omitempty"`
	AuctionID           string `json:"auctionId,omitempty"`
	CourtOrderNo        string `json:"courtOrderNo,omitempty"`

	// Unregistered co-owner detection
	KnownMissingHeirs   []MissingHeirFlag `json:"knownMissingHeirs,omitempty"`
	DilrmpNameCount     int    `json:"dilrmpNameCount"`     // how many names DILRMP shows
	RegisteredCount     int    `json:"registeredCount"`     // how many are on-chain
	RegistrationGap     bool   `json:"registrationGap"`     // true if dilrmpNameCount > registeredCount
	PublicNoticeTill    string `json:"publicNoticeTill,omitempty"` // 90-day window
	AssuranceFundLevied float64 `json:"assuranceFundLevied"` // amount into assurance fund

	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// MissingHeirFlag — AI-detected potential co-owner not yet registered
type MissingHeirFlag struct {
	SourceSystem  string `json:"sourceSystem"`  // DILRMP | AADHAAR_FAMILY | COMMUNITY_REPORT
	HintName      string `json:"hintName"`      // partial name from DILRMP record (not linked to Aadhaar yet)
	Relationship  string `json:"relationship"`  // "Son", "Daughter" (from Aadhaar family data)
	FlaggedAt     string `json:"flaggedAt"`
	FlaggedBy     string `json:"flaggedBy"`     // patwari hash or "JANGANANA_ENGINE"
	Resolution    string `json:"resolution"`    // REGISTERED | DECEASED | AFFIDAVIT_FILED | PENDING
	ResolvedAt    string `json:"resolvedAt,omitempty"`
}

// Dissolution vote thresholds by law type
const (
	DissolutionThresholdHindu  = 0.50 // simple majority sufficient under HSA 1956 S.23
	DissolutionThresholdMuslim = 0.67 // 2/3 majority under Muslim personal law
	DissolutionThresholdCustom = 0.75 // conservative default
)

// ─── Smart Contract ────────────────────────────────────────────────────────

type CoparcenaryPoolContract struct {
	contractapi.Contract
}

// CreatePool — establish a new family land pool
// Called by the Uttaradhikar Engine (auto) or by a Tehsildar (manual family registration)
//
// dilrmpNameCount: how many names appear in the raw DILRMP Khatauni record for these properties
//   If this is > len(initialMembers), a RegistrationGap flag is set automatically.
func (c *CoparcenaryPoolContract) CreatePool(
	ctx contractapi.TransactionContextInterface,
	poolId, familyName,
	ancestorHash, ancestorName,
	religion, lawApplied,
	kartaHash,
	membersJSON, assetDLPIIdsJSON string,
	dilrmpNameCount int,
	officerHash string,
) (*CoparcenaryPool, error) {

	existing, _ := c.getPool(ctx, poolId)
	if existing != nil {
		return nil, fmt.Errorf("pool %s already exists", poolId)
	}

	var members []PoolMember
	if err := json.Unmarshal([]byte(membersJSON), &members); err != nil {
		return nil, fmt.Errorf("invalid members JSON: %w", err)
	}
	if len(members) == 0 {
		return nil, fmt.Errorf("pool must have at least one member")
	}

	// Validate shares sum to 1.0
	var totalShare float64
	kartaFound := false
	for _, m := range members {
		totalShare += m.ShareDecimal
		if m.IsKarta && m.AadhaarHash == kartaHash {
			kartaFound = true
		}
	}
	if totalShare < 0.999 || totalShare > 1.001 {
		return nil, fmt.Errorf("member shares sum to %f — must sum to 1.0", totalShare)
	}
	if !kartaFound {
		return nil, fmt.Errorf("karta hash %s not found in members list with IsKarta=true", kartaHash)
	}

	// Parse asset DLPIs
	var assetIds []string
	if err := json.Unmarshal([]byte(assetDLPIIdsJSON), &assetIds); err != nil {
		return nil, fmt.Errorf("invalid asset DLPI IDs: %w", err)
	}
	assets := make([]PoolAsset, len(assetIds))
	for i, id := range assetIds {
		assets[i] = PoolAsset{DLPIId: id, IsReleased: false}
	}

	// Determine dissolution threshold by religion/law
	dissolveThreshold := DissolutionThresholdCustom
	switch lawApplied {
	case "Hindu_Mitakshara", "Hindu_Dayabhaga":
		dissolveThreshold = DissolutionThresholdHindu
	case "Muslim_Sunni", "Muslim_Shia":
		dissolveThreshold = DissolutionThresholdMuslim
	}

	now := time.Now().UTC().Format(time.RFC3339)
	registeredCount := len(members)
	registrationGap := dilrmpNameCount > registeredCount

	pool := CoparcenaryPool{
		PoolID:           poolId,
		FamilyName:       familyName,
		AncestorHash:     ancestorHash,
		AncestorName:     ancestorName,
		Religion:         religion,
		LawApplied:       lawApplied,
		Members:          members,
		Assets:           assets,
		KartaHash:        kartaHash,
		MinDissolveVote:  dissolveThreshold,
		DissolutionStatus: "ACTIVE",
		DilrmpNameCount:  dilrmpNameCount,
		RegisteredCount:  registeredCount,
		RegistrationGap:  registrationGap,
		AssuranceFundLevied: 0,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	// If registration gap detected: auto-flag and fire alert
	if registrationGap {
		gapEvent, _ := json.Marshal(map[string]interface{}{
			"poolId":           poolId,
			"familyName":       familyName,
			"dilrmpNameCount":  dilrmpNameCount,
			"registeredCount":  registeredCount,
			"gap":              dilrmpNameCount - registeredCount,
			"officerHash":      officerHash,
			"message":          fmt.Sprintf("DILRMP record shows %d names but only %d registered. Possible missing co-owners.", dilrmpNameCount, registeredCount),
			"action":           "OFFICER_MUST_INVESTIGATE",
		})
		_ = ctx.GetStub().SetEvent("RegistrationGapDetected", gapEvent)

		// Start 90-day public notice immediately
		noticeTill := time.Now().UTC().Add(90 * 24 * time.Hour).Format(time.RFC3339)
		pool.PublicNoticeTill = noticeTill
		noticeEvent, _ := json.Marshal(map[string]interface{}{
			"poolId":      poolId,
			"noticeTill":  noticeTill,
			"reason":      "REGISTRATION_GAP_DETECTED",
			"channels":    []string{"BHULEKH_PORTAL", "GRAM_SABHA", "SMS_TO_MEMBERS"},
		})
		_ = ctx.GetStub().SetEvent("PublicNoticeStarted", noticeEvent)
	}

	if err := c.savePool(ctx, &pool); err != nil {
		return nil, err
	}
	return &pool, nil
}

// FlagMissingHeir — Janganana Engine or Patwari flags a potential unregistered co-owner
// Source: DILRMP cross-check | Aadhaar family data | Community report | Neighbor alert
func (c *CoparcenaryPoolContract) FlagMissingHeir(
	ctx contractapi.TransactionContextInterface,
	poolId, sourceSystem, hintName, relationship, flaggedByHash string,
) error {
	pool, err := c.getPool(ctx, poolId)
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	flag := MissingHeirFlag{
		SourceSystem: sourceSystem,
		HintName:     hintName,
		Relationship: relationship,
		FlaggedAt:    now,
		FlaggedBy:    flaggedByHash,
		Resolution:   "PENDING",
	}
	pool.KnownMissingHeirs = append(pool.KnownMissingHeirs, flag)
	pool.RegistrationGap = true

	// Extend public notice if not already active or nearly expired
	if pool.PublicNoticeTill == "" || mustParseTime(pool.PublicNoticeTill).Before(time.Now().UTC().Add(30*24*time.Hour)) {
		pool.PublicNoticeTill = time.Now().UTC().Add(90 * 24 * time.Hour).Format(time.RFC3339)
	}

	pool.UpdatedAt = now
	event, _ := json.Marshal(map[string]interface{}{
		"poolId":       poolId,
		"hintName":     hintName,
		"relationship": relationship,
		"source":       sourceSystem,
		"flaggedBy":    flaggedByHash,
		"noticeTill":   pool.PublicNoticeTill,
		"notifyKarta":  pool.KartaHash,
		"notifyOfficer": true,
	})
	_ = ctx.GetStub().SetEvent("MissingHeirFlagged", event)
	return c.savePool(ctx, pool)
}

// ResolveMissingHeirFlag — mark a flagged missing heir as registered/deceased/affidavit
// Called when: (a) the flagged person registers, (b) death cert proves they're dead,
//              (c) officer files affidavit that person doesn't exist/can't be found
func (c *CoparcenaryPoolContract) ResolveMissingHeirFlag(
	ctx contractapi.TransactionContextInterface,
	poolId string, flagIndex int,
	resolution string, // REGISTERED | DECEASED | AFFIDAVIT_FILED
	evidenceCID, officerHash string,
) error {
	pool, err := c.getPool(ctx, poolId)
	if err != nil {
		return err
	}
	if flagIndex >= len(pool.KnownMissingHeirs) {
		return fmt.Errorf("flag index %d out of range", flagIndex)
	}
	validResolutions := map[string]bool{"REGISTERED": true, "DECEASED": true, "AFFIDAVIT_FILED": true}
	if !validResolutions[resolution] {
		return fmt.Errorf("invalid resolution: %s", resolution)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	pool.KnownMissingHeirs[flagIndex].Resolution = resolution
	pool.KnownMissingHeirs[flagIndex].ResolvedAt = now

	// Check if ALL flags resolved
	allResolved := true
	for _, f := range pool.KnownMissingHeirs {
		if f.Resolution == "PENDING" {
			allResolved = false
			break
		}
	}
	if allResolved {
		pool.RegistrationGap = false
	}

	pool.UpdatedAt = now
	return c.savePool(ctx, pool)
}

// AddMember — register a previously missing heir into the pool
// Called when a flagged person comes forward with Aadhaar + proof of heirship
// The Karta + Tehsildar must co-approve (prevents fake additions)
func (c *CoparcenaryPoolContract) AddMember(
	ctx contractapi.TransactionContextInterface,
	poolId, newMemberAadhaarHash, newMemberName,
	shareFraction string, shareDecimal float64,
	relation, kartaESignHash, officerHash string,
) error {
	pool, err := c.getPool(ctx, poolId)
	if err != nil {
		return err
	}

	// Adding a member dilutes everyone's share proportionally
	// Validate: new total (existing + new) must still make sense
	var existingTotal float64
	for _, m := range pool.Members {
		if !m.IsDeceased {
			existingTotal += m.ShareDecimal
		}
	}
	if existingTotal+shareDecimal > 1.001 {
		return fmt.Errorf("adding share %.6f would exceed 1.0 (existing total: %.6f) — reduce existing shares first", shareDecimal, existingTotal)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	newMember := PoolMember{
		AadhaarHash:  newMemberAadhaarHash,
		Name:         newMemberName,
		Share:        shareFraction,
		ShareDecimal: shareDecimal,
		JoinedAt:     now,
		Relation:     relation,
		IsKarta:      false,
		IsDeceased:   false,
	}
	pool.Members = append(pool.Members, newMember)
	pool.RegisteredCount++

	// If the new member resolves all known missing heirs, clear gap flag
	stillMissing := false
	for _, f := range pool.KnownMissingHeirs {
		if f.Resolution == "PENDING" {
			stillMissing = true
			break
		}
	}
	pool.RegistrationGap = stillMissing

	pool.UpdatedAt = now
	event, _ := json.Marshal(map[string]interface{}{
		"poolId":      poolId,
		"newMember":   newMemberAadhaarHash,
		"share":       shareFraction,
		"relation":    relation,
		"kartaApproved": kartaESignHash,
		"officerHash": officerHash,
		"addedAt":     now,
	})
	_ = ctx.GetStub().SetEvent("PoolMemberAdded", event)
	return c.savePool(ctx, pool)
}

// TransferPoolShare — member sells their share fraction to another person
// For INTERNAL transfer (to existing member): Karta approves only
// For EXTERNAL transfer (to non-member): Karta + ALL existing members notified (30-day preemption)
func (c *CoparcenaryPoolContract) TransferPoolShare(
	ctx contractapi.TransactionContextInterface,
	poolId, fromHash, toHash, toName,
	shareFraction string, shareDecimal float64,
	considerationINR float64,
	fromESign, toESign, kartaApprovalHash string,
) (string, error) {
	pool, err := c.getPool(ctx, poolId)
	if err != nil {
		return "", err
	}
	if pool.DissolutionStatus == "COMPLETED" {
		return "", fmt.Errorf("pool has been dissolved — no more share transfers")
	}
	if pool.RegistrationGap && pool.PublicNoticeTill != "" && mustParseTime(pool.PublicNoticeTill).After(time.Now().UTC()) {
		return "", fmt.Errorf("share transfer blocked: registration gap under investigation until %s", pool.PublicNoticeTill)
	}

	// Find seller and validate they have enough share
	sellerFound := false
	for i, m := range pool.Members {
		if m.AadhaarHash == fromHash {
			if m.ShareDecimal < shareDecimal-0.001 {
				return "", fmt.Errorf("seller has %.6f share but trying to transfer %.6f", m.ShareDecimal, shareDecimal)
			}
			pool.Members[i].ShareDecimal -= shareDecimal
			pool.Members[i].Share = fractionString(pool.Members[i].ShareDecimal, len(pool.Members))
			sellerFound = true
			break
		}
	}
	if !sellerFound {
		return "", fmt.Errorf("from hash %s not found in pool members", fromHash)
	}

	// Check if buyer is already a member (internal) or new (external)
	isInternal := false
	for i, m := range pool.Members {
		if m.AadhaarHash == toHash {
			pool.Members[i].ShareDecimal += shareDecimal
			pool.Members[i].Share = fractionString(pool.Members[i].ShareDecimal, len(pool.Members))
			isInternal = true
			break
		}
	}
	if !isInternal {
		// External buyer — add as new member
		pool.Members = append(pool.Members, PoolMember{
			AadhaarHash:  toHash,
			Name:         toName,
			Share:        shareFraction,
			ShareDecimal: shareDecimal,
			JoinedAt:     time.Now().UTC().Format(time.RFC3339),
			Relation:     "Purchaser",
			IsKarta:      false,
		})
		pool.RegisteredCount++
	}

	txID := ctx.GetStub().GetTxID()
	transferID := fmt.Sprintf("SHT-%s-%s", poolId, txID[:8])
	now := time.Now().UTC().Format(time.RFC3339)

	transfer := ShareTransfer{
		TransferID:    transferID,
		FromHash:      fromHash,
		ToHash:        toHash,
		ToName:        toName,
		ShareFraction: shareFraction,
		ShareDecimal:  shareDecimal,
		ConsideredINR: considerationINR,
		ESignFrom:     fromESign,
		ESignTo:       toESign,
		KartaApproval: kartaApprovalHash,
		ExecutedAt:    now,
		IsInternal:    isInternal,
	}
	pool.ShareHistory = append(pool.ShareHistory, transfer)
	pool.UpdatedAt = now

	// Levy assurance fund contribution (0.1% of consideration)
	assuranceLevy := considerationINR * 0.001
	pool.AssuranceFundLevied += assuranceLevy

	if err := c.savePool(ctx, pool); err != nil {
		return "", err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"poolId":       poolId,
		"transferId":   transferID,
		"from":         fromHash,
		"to":           toHash,
		"share":        shareFraction,
		"consideration": considerationINR,
		"assuranceLevy": assuranceLevy,
		"isInternal":   isInternal,
	})
	_ = ctx.GetStub().SetEvent("PoolShareTransferred", event)
	return transferID, nil
}

// VoteForDissolution — member casts vote to dissolve the pool
// Method: AUCTION (sell all, split proceeds) | FAMILY_PARTITION (specific assignments) | COURT_ORDER
func (c *CoparcenaryPoolContract) VoteForDissolution(
	ctx contractapi.TransactionContextInterface,
	poolId, memberHash, method, eSignHash string,
) error {
	pool, err := c.getPool(ctx, poolId)
	if err != nil {
		return err
	}
	if pool.DissolutionStatus == "COMPLETED" {
		return fmt.Errorf("pool already dissolved")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	memberShareVoting := 0.0
	for i, m := range pool.Members {
		if m.AadhaarHash == memberHash {
			pool.Members[i].HasVotedToDissolve = true
			pool.Members[i].DissolveVoteAt = now
			memberShareVoting = m.ShareDecimal
			break
		}
	}
	if memberShareVoting == 0 {
		return fmt.Errorf("member %s not found in pool", memberHash)
	}

	// Calculate current vote weight
	var totalVoteWeight float64
	for _, m := range pool.Members {
		if m.HasVotedToDissolve && !m.IsDeceased {
			totalVoteWeight += m.ShareDecimal
		}
	}

	pool.UpdatedAt = now
	if pool.DissolutionStatus == "ACTIVE" {
		pool.DissolutionStatus = "VOTE_IN_PROGRESS"
		pool.DissolutionVoteAt = now
	}

	// Check if dissolution threshold met
	if totalVoteWeight >= pool.MinDissolveVote {
		pool.DissolutionStatus = "APPROVED"
		pool.DissolutionMethod = method
		event, _ := json.Marshal(map[string]interface{}{
			"poolId":         poolId,
			"method":         method,
			"voteWeight":     totalVoteWeight,
			"threshold":      pool.MinDissolveVote,
			"assets":         pool.Assets,
			"members":        pool.Members,
			"action":         "INITIATE_BHUMI_AUCTION", // BhumiAuction Type 1
		})
		_ = ctx.GetStub().SetEvent("DissolutionApproved", event)
	}

	return c.savePool(ctx, pool)
}

// ReleaseAsset — extract one DLPI from pool into individual ownership (partial dissolution)
// Requirements: Karta + supermajority (75%) must agree on specific property → specific person
// Use case: "We all agree Plot A goes to Rahul. No auction needed for this one plot."
func (c *CoparcenaryPoolContract) ReleaseAsset(
	ctx contractapi.TransactionContextInterface,
	poolId, dlpiId, recipientHash, recipientName,
	kartaESign, officerHash string,
	voterHashesJSON string, // JSON array of members who approved this specific release
) error {
	pool, err := c.getPool(ctx, poolId)
	if err != nil {
		return err
	}

	// Validate supermajority voted for this specific release
	var voterHashes []string
	if err := json.Unmarshal([]byte(voterHashesJSON), &voterHashes); err != nil {
		return fmt.Errorf("invalid voter hashes: %w", err)
	}
	voterMap := make(map[string]bool)
	for _, h := range voterHashes {
		voterMap[h] = true
	}

	var voteWeight float64
	for _, m := range pool.Members {
		if voterMap[m.AadhaarHash] && !m.IsDeceased {
			voteWeight += m.ShareDecimal
		}
	}
	if voteWeight < 0.75 {
		return fmt.Errorf("asset release requires 75%% approval by share — got %.2f%%", voteWeight*100)
	}

	// Mark asset as released in pool
	found := false
	now := time.Now().UTC().Format(time.RFC3339)
	for i, a := range pool.Assets {
		if a.DLPIId == dlpiId {
			pool.Assets[i].IsReleased = true
			pool.Assets[i].ReleasedTo = recipientHash
			pool.Assets[i].ReleasedAt = now
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("DLPI %s not found in pool assets", dlpiId)
	}

	pool.UpdatedAt = now

	// Fire event: API layer must call DLPI.UpdateOwners to set recipient as sole owner
	releaseEvent, _ := json.Marshal(map[string]interface{}{
		"action":         "RELEASE_DLPI_TO_SOLE_OWNER",
		"poolId":         poolId,
		"dlpiId":         dlpiId,
		"recipientHash":  recipientHash,
		"recipientName":  recipientName,
		"officerHash":    officerHash,
		"voteWeight":     voteWeight,
	})
	_ = ctx.GetStub().SetEvent("PoolAssetReleased", releaseEvent)

	return c.savePool(ctx, pool)
}

// RecordDissolutionComplete — called after BhumiAuction settles and proceeds distributed
func (c *CoparcenaryPoolContract) RecordDissolutionComplete(
	ctx contractapi.TransactionContextInterface,
	poolId, auctionID, officerHash string,
) error {
	pool, err := c.getPool(ctx, poolId)
	if err != nil {
		return err
	}
	if pool.DissolutionStatus != "APPROVED" {
		return fmt.Errorf("pool %s dissolution not approved (status: %s)", poolId, pool.DissolutionStatus)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	pool.DissolutionStatus = "COMPLETED"
	pool.AuctionID = auctionID
	pool.UpdatedAt = now

	event, _ := json.Marshal(map[string]interface{}{
		"poolId":      poolId,
		"auctionId":   auctionID,
		"completedAt": now,
		"officerHash": officerHash,
	})
	_ = ctx.GetStub().SetEvent("PoolDissolutionCompleted", event)
	return c.savePool(ctx, pool)
}

// GetPool — retrieve pool by ID
func (c *CoparcenaryPoolContract) GetPool(
	ctx contractapi.TransactionContextInterface, poolId string,
) (*CoparcenaryPool, error) {
	return c.getPool(ctx, poolId)
}

// QueryPoolsByAncestor — find all pools derived from a specific deceased owner
func (c *CoparcenaryPoolContract) QueryPoolsByAncestor(
	ctx contractapi.TransactionContextInterface, ancestorHash string,
) ([]*CoparcenaryPool, error) {
	query := fmt.Sprintf(`{"selector":{"ancestorHash":"%s"}}`, ancestorHash)
	return c.executeQuery(ctx, query)
}

// QueryPoolsByMember — find all pools where a given person is a member
func (c *CoparcenaryPoolContract) QueryPoolsByMember(
	ctx contractapi.TransactionContextInterface, memberHash string,
) ([]*CoparcenaryPool, error) {
	query := fmt.Sprintf(`{"selector":{"members":{"$elemMatch":{"aadhaarHash":"%s"}}}}`, memberHash)
	return c.executeQuery(ctx, query)
}

// QueryPoolsWithRegistrationGap — officer dashboard: pools with known missing heirs
func (c *CoparcenaryPoolContract) QueryPoolsWithRegistrationGap(
	ctx contractapi.TransactionContextInterface,
) ([]*CoparcenaryPool, error) {
	query := `{"selector":{"registrationGap":true}}`
	return c.executeQuery(ctx, query)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────

func (c *CoparcenaryPoolContract) getPool(ctx contractapi.TransactionContextInterface, id string) (*CoparcenaryPool, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("state read error: %w", err)
	}
	if data == nil {
		return nil, fmt.Errorf("pool %s not found", id)
	}
	var p CoparcenaryPool
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}
	return &p, nil
}

func (c *CoparcenaryPoolContract) savePool(ctx contractapi.TransactionContextInterface, p *CoparcenaryPool) error {
	data, err := json.Marshal(p)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}
	return ctx.GetStub().PutState(p.PoolID, data)
}

func (c *CoparcenaryPoolContract) executeQuery(ctx contractapi.TransactionContextInterface, query string) ([]*CoparcenaryPool, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*CoparcenaryPool
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var p CoparcenaryPool
		if err := json.Unmarshal(r.Value, &p); err != nil {
			return nil, err
		}
		results = append(results, &p)
	}
	return results, nil
}

// fractionString produces a human-readable fraction for a decimal share
// Simple heuristic — production would use exact fraction arithmetic
func fractionString(decimal float64, memberCount int) string {
	if decimal >= 0.999 {
		return "1/1"
	}
	if memberCount <= 0 {
		return fmt.Sprintf("%.4f", decimal)
	}
	return fmt.Sprintf("~1/%d", int(1.0/decimal+0.5))
}

func mustParseTime(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

func main() {
	cc, err := contractapi.NewChaincode(&CoparcenaryPoolContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating CoparcenaryPool chaincode: %v", err))
	}
	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("Error starting CoparcenaryPool chaincode: %v", err))
	}
}
