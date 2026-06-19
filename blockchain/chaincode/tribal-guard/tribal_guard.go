package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Data Structures ──────────────────────────────────────────────────────────

// TribalParcelRegistry — on-chain registry of all tribal-protected parcels
// Populated at network genesis from government Schedule V/VI gazette data
type TribalParcelRegistry struct {
	DLPIId              string   `json:"dlpiId"`
	ScheduleType        string   `json:"scheduleType"`  // V | VI | FRA_PATTA | PVTG
	GazettedOn          string   `json:"gazettedOn"`    // ISO date
	DistrictName        string   `json:"districtName"`
	TehsilName          string   `json:"tehsilName"`
	VillageName         string   `json:"villageName"`
	CommunityName       string   `json:"communityName"` // Bhil | Warli | Gond | Korku | Katkari
	FRAPattaNo          string   `json:"fraPattaNo,omitempty"`
	FRAForestDivision   string   `json:"fraForestDivision,omitempty"`
	PVTGCommunity       bool     `json:"pvtgCommunity"`  // Particularly Vulnerable Tribal Group
	GramSabhaVillageID  string   `json:"gramSabhaVillageId"`
	NalSaRegionID       string   `json:"nalsaRegionId"`
	ProtectionLevel     string   `json:"protectionLevel"` // ABSOLUTE | CONDITIONAL
	RegistrationNotes   string   `json:"registrationNotes,omitempty"`
}

// TribalTransferAttempt — every attempt, approved or rejected, stored permanently
type TribalTransferAttempt struct {
	AttemptID           string   `json:"attemptId"`
	DLPIId              string   `json:"dlpiId"`
	ScheduleType        string   `json:"scheduleType"`
	RequestedByHash     string   `json:"requestedByHash"`   // who initiated
	BuyerName           string   `json:"buyerName"`
	BuyerAadhaarHash    string   `json:"buyerAadhaarHash"`
	IsTribalBuyer       bool     `json:"isTribalBuyer"`
	TribalCertHash      string   `json:"tribalCertHash,omitempty"` // if tribal buyer
	TribalCommunity     string   `json:"tribalCommunity,omitempty"`

	Outcome             string   `json:"outcome"`  // HARD_REJECTED | ALLOWED_PENDING_APPROVALS | APPROVED
	RejectionCode       string   `json:"rejectionCode,omitempty"`
	RejectionReason     string   `json:"rejectionReason,omitempty"`
	LegalCitations      []string `json:"legalCitations,omitempty"`

	// If tribal-to-tribal: approval requirements
	GramSabhaApprovals  []GramSabhaApproval `json:"gramSabhaApprovals,omitempty"`
	VideoConsentCID     string   `json:"videoConsentCID,omitempty"` // GPS-tagged IPFS video
	VideoConsentVerified bool    `json:"videoConsentVerified"`
	CollectorApproval   *CollectorApproval `json:"collectorApproval,omitempty"`
	GovernorApproval    *GovernorApproval  `json:"governorApproval,omitempty"`

	// Notification log
	NalsaNotifiedAt     string   `json:"nalsaNotifiedAt,omitempty"`
	NalsaTicketNo       string   `json:"nalsaTicketNo,omitempty"`
	StateSTCommissionNotifiedAt string `json:"stCommissionNotifiedAt,omitempty"`

	ResponseTimeMs      int64    `json:"responseTimeMs"` // sub-200ms for hard reject
	AttemptedAt         string   `json:"attemptedAt"`
	UpdatedAt           string   `json:"updatedAt"`
}

type GramSabhaApproval struct {
	MemberAadhaarHash   string `json:"memberAadhaarHash"`
	MemberName          string `json:"memberName"`
	VillageID           string `json:"villageId"`
	SignedAt            string `json:"signedAt,omitempty"`
	ESignTxHash         string `json:"eSignTxHash,omitempty"`
	HasApproved         bool   `json:"hasApproved"`
}

type CollectorApproval struct {
	CollectorHash  string `json:"collectorHash"`
	ApprovedAt     string `json:"approvedAt,omitempty"`
	OrderNo        string `json:"orderNo,omitempty"`
	Status         string `json:"status"` // PENDING | APPROVED | REJECTED
}

type GovernorApproval struct {
	OrderNo    string `json:"orderNo,omitempty"`
	ApprovedAt string `json:"approvedAt,omitempty"`
	Status     string `json:"status"` // PENDING | APPROVED | REJECTED
	// Schedule VI: transfer requires State Governor sanction
}

// ─── Legal Citations ──────────────────────────────────────────────────────────

var scheduleVCitations = []string{
	"Constitution of India, Fifth Schedule, Para 5(2) — Transfer of immovable property by or among members of a Scheduled Tribe in a Scheduled Area requires Governor's sanction",
	"Samatha v. State of Andhra Pradesh (1997) 8 SCC 191 — Supreme Court held that transfer of tribal land to non-tribals in Fifth Schedule areas is unconstitutional and void ab initio",
	"Maharashtra Land Revenue Code, Section 36A — Tribal land in Scheduled Areas cannot be transferred to non-tribal without written permission of Collector",
	"Forest Rights Act 2006, Section 4(5) — No eviction or displacement of forest dwelling Scheduled Tribes without recognition of forest rights",
}

var fraCitations = []string{
	"Forest Rights Act 2006, Section 3(1)(a) — Right of forest dwelling STs to live in and cultivate the forest land for habitation or self-cultivation",
	"Forest Rights Act 2006, Section 4(4) — No members of a forest dwelling ST shall be evicted or removed from forest land under occupation",
	"Ministry of Tribal Affairs Circular No. 23011/4/2008-SD-V — FRA Patta land is inalienable and cannot be sold, leased or transferred",
}

var scheduleVICitations = []string{
	"Constitution of India, Sixth Schedule, Para 3 — District Council may make laws for transfer of land by persons who are members of the Scheduled Tribes",
	"Sixth Schedule area tribal land transfer requires autonomous district council approval and Governor assent",
}

var pvtgCitations = []string{
	"PM PVTG Development Mission 2023 — Particularly Vulnerable Tribal Groups enjoy heightened protection; any land transfer requires NALSA concurrence",
	"Tribal Sub-Plan Framework — PVTG land must remain within community; transfer to outsiders is prohibited",
}

// ─── Smart Contract ───────────────────────────────────────────────────────────

type TribalGuardContract struct {
	contractapi.Contract
}

// RegisterTribalParcel — governance function to mark a parcel as tribal-protected
// Endorsement: AND(TRIBAL-WELFARE-ORG.member, REVENUE-HQ.member)
// Must be called for all Schedule V/VI/FRA parcels at network genesis
func (c *TribalGuardContract) RegisterTribalParcel(
	ctx contractapi.TransactionContextInterface,
	dlpiId, scheduleType, gazettedOn, districtName, tehsilName,
	villageName, communityName, fraPattaNo, fraForestDivision,
	gramSabhaVillageID, nalsaRegionID, protectionLevel string,
	pvtgCommunity bool,
) error {
	// Prevent overwriting an existing registration (protect against malicious override)
	key := c.parcelKey(dlpiId)
	existing, _ := ctx.GetStub().GetState(key)
	if existing != nil {
		return fmt.Errorf("PARCEL_ALREADY_REGISTERED: %s is already in the tribal registry — use UpdateTribalParcel with dual-org endorsement", dlpiId)
	}

	validTypes := map[string]bool{"V": true, "VI": true, "FRA_PATTA": true, "PVTG": true}
	if !validTypes[scheduleType] {
		return fmt.Errorf("invalid scheduleType %s — must be V | VI | FRA_PATTA | PVTG", scheduleType)
	}

	registry := TribalParcelRegistry{
		DLPIId:             dlpiId,
		ScheduleType:       scheduleType,
		GazettedOn:         gazettedOn,
		DistrictName:       districtName,
		TehsilName:         tehsilName,
		VillageName:        villageName,
		CommunityName:      communityName,
		FRAPattaNo:         fraPattaNo,
		FRAForestDivision:  fraForestDivision,
		PVTGCommunity:      pvtgCommunity,
		GramSabhaVillageID: gramSabhaVillageID,
		NalSaRegionID:      nalsaRegionID,
		ProtectionLevel:    protectionLevel,
	}

	data, _ := json.Marshal(registry)
	if err := ctx.GetStub().PutState(key, data); err != nil {
		return err
	}

	event, _ := json.Marshal(map[string]interface{}{
		"dlpiId":       dlpiId,
		"scheduleType": scheduleType,
		"community":    communityName,
		"village":      villageName,
		"tehsil":       tehsilName,
		"district":     districtName,
		"pvtg":         pvtgCommunity,
	})
	_ = ctx.GetStub().SetEvent("TribalParcelRegistered", event)

	return nil
}

// CheckTransfer — THE CORE FUNCTION
// Called by PropertyTransfer chaincode BEFORE initiating any transfer.
// If parcel is tribal, evaluates buyer eligibility and either hard-rejects
// or creates a conditional approval chain. Returns allow/deny + reason.
// Target: <200ms response for hard reject (no DB reads beyond state, no AI).
func (c *TribalGuardContract) CheckTransfer(
	ctx contractapi.TransactionContextInterface,
	dlpiId, buyerName, buyerAadhaarHash string,
	isTribalBuyer bool,
	tribalCertHash, tribalCommunity string,
) (*TransferCheckResult, error) {
	startMs := time.Now().UnixMilli()

	// Lookup tribal registry for this parcel
	registry, err := c.getRegistry(ctx, dlpiId)
	if err != nil || registry == nil {
		// Not a tribal parcel — no restriction
		elapsed := time.Now().UnixMilli() - startMs
		return &TransferCheckResult{
			DLPIId:         dlpiId,
			IsTribalParcel: false,
			Decision:       "ALLOWED_NOT_TRIBAL",
			ResponseTimeMs: elapsed,
		}, nil
	}

	txID := ctx.GetStub().GetTxID()
	now := time.Now().UTC().Format(time.RFC3339)
	attemptID := fmt.Sprintf("TGA-%s-%s", dlpiId, txID[:8])

	attempt := TribalTransferAttempt{
		AttemptID:        attemptID,
		DLPIId:           dlpiId,
		ScheduleType:     registry.ScheduleType,
		BuyerName:        buyerName,
		BuyerAadhaarHash: buyerAadhaarHash,
		IsTribalBuyer:    isTribalBuyer,
		TribalCertHash:   tribalCertHash,
		TribalCommunity:  tribalCommunity,
		AttemptedAt:      now,
		UpdatedAt:        now,
	}

	// ── ABSOLUTE PROTECTION: FRA Patta ───────────────────────────────────────
	// FRA Patta land CANNOT be transferred to ANYONE — tribal or non-tribal
	if registry.ScheduleType == "FRA_PATTA" {
		attempt.Outcome = "HARD_REJECTED"
		attempt.RejectionCode = "FRA_INALIENABLE"
		attempt.RejectionReason = fmt.Sprintf(
			"HARD REJECT — FRA Patta No. %s is inalienable under Forest Rights Act 2006. "+
				"FRA patta land cannot be transferred, sold, leased, or mortgaged to any person or entity, "+
				"including other tribal members. The patta belongs to the forest-dwelling community in perpetuity.",
			registry.FRAPattaNo,
		)
		attempt.LegalCitations = append(fraCitations, "MoTA Advisory 2013: FRA patta land is community land, not individual transferable property")
		attempt.ResponseTimeMs = time.Now().UnixMilli() - startMs
		_ = c.saveAttempt(ctx, &attempt)
		_ = c.emitRejectionEvent(ctx, &attempt, registry)
		return buildRejectedResult(dlpiId, &attempt), nil
	}

	// ── PVTG — Heightened Protection ────────────────────────────────────────
	// Particularly Vulnerable Tribal Group: transfer requires NALSA concurrence + Governor
	if registry.PVTGCommunity {
		attempt.Outcome = "HARD_REJECTED"
		attempt.RejectionCode = "PVTG_ABSOLUTE_BLOCK"
		attempt.RejectionReason = fmt.Sprintf(
			"HARD REJECT — %s community of village %s, %s is designated a Particularly Vulnerable Tribal Group (PVTG). "+
				"PVTG land is afforded the highest level of constitutional protection. Transfer to any outsider "+
				"(tribal or non-tribal) requires prior approval of NALSA, State Tribal Welfare Commissioner, "+
				"and Governor of Maharashtra. This transaction is blocked pending those clearances.",
			registry.CommunityName, registry.VillageName, registry.TehsilName,
		)
		attempt.LegalCitations = pvtgCitations
		attempt.ResponseTimeMs = time.Now().UnixMilli() - startMs
		_ = c.saveAttempt(ctx, &attempt)
		_ = c.emitRejectionEvent(ctx, &attempt, registry)
		return buildRejectedResult(dlpiId, &attempt), nil
	}

	// ── Schedule V — Non-Tribal Buyer: Hard Block ────────────────────────────
	if registry.ScheduleType == "V" && !isTribalBuyer {
		attempt.Outcome = "HARD_REJECTED"
		attempt.RejectionCode = "SCHEDULE_V_NON_TRIBAL"
		attempt.RejectionReason = fmt.Sprintf(
			"HARD REJECT — Parcel %s is located in a Fifth Schedule (Scheduled Area) in %s tehsil, "+
				"Nashik district, Maharashtra. Buyer '%s' is not a registered Scheduled Tribe member. "+
				"Transfer of tribal land to non-tribal persons in Scheduled Areas is VOID AB INITIO "+
				"per Supreme Court ruling in Samatha v. State of AP (1997). "+
				"No revenue officer, SRO, or digital signature can authorise this transaction. "+
				"The Fabric endorsement policy REQUIRES Tribal-Welfare-Org signature — which is ABSENT.",
			dlpiId, registry.TehsilName, buyerName,
		)
		attempt.LegalCitations = scheduleVCitations
		attempt.ResponseTimeMs = time.Now().UnixMilli() - startMs
		_ = c.saveAttempt(ctx, &attempt)
		_ = c.emitRejectionEvent(ctx, &attempt, registry)
		return buildRejectedResult(dlpiId, &attempt), nil
	}

	// ── Schedule VI — Non-tribal buyer: Hard Block ───────────────────────────
	if registry.ScheduleType == "VI" && !isTribalBuyer {
		attempt.Outcome = "HARD_REJECTED"
		attempt.RejectionCode = "SCHEDULE_VI_NON_TRIBAL"
		attempt.RejectionReason = fmt.Sprintf(
			"HARD REJECT — Parcel %s is in a Sixth Schedule Autonomous District. "+
				"Transfer to non-tribal buyer '%s' requires Autonomous District Council approval, "+
				"which has NOT been recorded on-chain. Transaction blocked.",
			dlpiId, buyerName,
		)
		attempt.LegalCitations = scheduleVICitations
		attempt.ResponseTimeMs = time.Now().UnixMilli() - startMs
		_ = c.saveAttempt(ctx, &attempt)
		_ = c.emitRejectionEvent(ctx, &attempt, registry)
		return buildRejectedResult(dlpiId, &attempt), nil
	}

	// ── Tribal-to-Tribal Transfer: Conditional Approval Required ─────────────
	if isTribalBuyer {
		// Validate buyer is same community (Mitakshara-equivalent tribal custom)
		if tribalCommunity != registry.CommunityName {
			attempt.Outcome = "HARD_REJECTED"
			attempt.RejectionCode = "CROSS_COMMUNITY_BLOCK"
			attempt.RejectionReason = fmt.Sprintf(
				"HARD REJECT — Parcel %s belongs to %s community. Buyer '%s' is from %s community. "+
					"Inter-community tribal land transfer is not permitted without Gram Sabha approval "+
					"of BOTH the seller's and buyer's village Gram Sabhas, plus Collector consent.",
				dlpiId, registry.CommunityName, buyerName, tribalCommunity,
			)
			attempt.LegalCitations = scheduleVCitations
			attempt.ResponseTimeMs = time.Now().UnixMilli() - startMs
			_ = c.saveAttempt(ctx, &attempt)
			_ = c.emitRejectionEvent(ctx, &attempt, registry)
			return buildRejectedResult(dlpiId, &attempt), nil
		}

		// Same-community tribal transfer: allowed PENDING Gram Sabha + Collector
		attempt.Outcome = "ALLOWED_PENDING_APPROVALS"
		attempt.GramSabhaApprovals = []GramSabhaApproval{} // will be populated by RecordGramSabhaApproval
		attempt.CollectorApproval = &CollectorApproval{Status: "PENDING"}
		attempt.ResponseTimeMs = time.Now().UnixMilli() - startMs
		_ = c.saveAttempt(ctx, &attempt)

		conditionalEvent, _ := json.Marshal(map[string]interface{}{
			"attemptId":      attemptID,
			"dlpiId":         dlpiId,
			"buyerName":      buyerName,
			"community":      tribalCommunity,
			"gramSabhaId":    registry.GramSabhaVillageID,
			"nalsaRegionId":  registry.NalSaRegionID,
			"actions": []string{
				"NOTIFY_GRAM_SABHA_FOR_APPROVAL",
				"NOTIFY_COLLECTOR",
				"NOTIFY_NALSA",
			},
		})
		_ = ctx.GetStub().SetEvent("TribalTransferConditionalApproval", conditionalEvent)

		return &TransferCheckResult{
			DLPIId:         dlpiId,
			AttemptID:      attemptID,
			IsTribalParcel: true,
			ScheduleType:   registry.ScheduleType,
			Community:      registry.CommunityName,
			Decision:       "ALLOWED_PENDING_APPROVALS",
			RequiredApprovals: []string{
				"Gram Sabha multi-sig (quorum: 5 members)",
				"GPS-tagged video consent from seller (IPFS upload)",
				"District Collector written order",
			},
			ResponseTimeMs: attempt.ResponseTimeMs,
		}, nil
	}

	// Should never reach here, but defensive return
	return buildRejectedResult(dlpiId, &attempt), nil
}

// RecordGramSabhaApproval — individual Gram Sabha member signs approval
func (c *TribalGuardContract) RecordGramSabhaApproval(
	ctx contractapi.TransactionContextInterface,
	attemptID, memberAadhaarHash, memberName, villageID, eSignTxHash string,
) error {
	attempt, err := c.getAttempt(ctx, attemptID)
	if err != nil {
		return err
	}

	if attempt.Outcome == "HARD_REJECTED" {
		return fmt.Errorf("attempt %s was hard-rejected — no approvals applicable", attemptID)
	}

	now := time.Now().UTC().Format(time.RFC3339)

	// Check if already approved by this member
	for _, a := range attempt.GramSabhaApprovals {
		if a.MemberAadhaarHash == memberAadhaarHash {
			return fmt.Errorf("member %s has already recorded approval", memberName)
		}
	}

	attempt.GramSabhaApprovals = append(attempt.GramSabhaApprovals, GramSabhaApproval{
		MemberAadhaarHash: memberAadhaarHash,
		MemberName:        memberName,
		VillageID:         villageID,
		SignedAt:          now,
		ESignTxHash:       eSignTxHash,
		HasApproved:       true,
	})

	attempt.UpdatedAt = now

	// Check quorum (5 members) and if met, emit event
	if len(attempt.GramSabhaApprovals) >= 5 {
		quorumEvent, _ := json.Marshal(map[string]interface{}{
			"attemptId": attemptID,
			"dlpiId":    attempt.DLPIId,
			"members":   len(attempt.GramSabhaApprovals),
			"action":    "GRAM_SABHA_QUORUM_MET_NOTIFY_COLLECTOR",
		})
		_ = ctx.GetStub().SetEvent("GramSabhaQuorumMet", quorumEvent)
	}

	return c.saveAttempt(ctx, attempt)
}

// RecordVideoConsent — GPS-tagged IPFS video of seller giving consent
func (c *TribalGuardContract) RecordVideoConsent(
	ctx contractapi.TransactionContextInterface,
	attemptID, videoIPFSCID, gpsCoordinates, recordedAt string,
) error {
	attempt, err := c.getAttempt(ctx, attemptID)
	if err != nil {
		return err
	}

	attempt.VideoConsentCID = videoIPFSCID
	attempt.VideoConsentVerified = true
	attempt.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	event, _ := json.Marshal(map[string]interface{}{
		"attemptId":  attemptID,
		"dlpiId":     attempt.DLPIId,
		"videoCID":   videoIPFSCID,
		"gps":        gpsCoordinates,
		"recordedAt": recordedAt,
	})
	_ = ctx.GetStub().SetEvent("TribalVideoConsentRecorded", event)

	return c.saveAttempt(ctx, attempt)
}

// RecordCollectorApproval — District Collector approves tribal-to-tribal transfer
func (c *TribalGuardContract) RecordCollectorApproval(
	ctx contractapi.TransactionContextInterface,
	attemptID, collectorHash, orderNo string,
	approved bool,
	rejectionReason string,
) error {
	attempt, err := c.getAttempt(ctx, attemptID)
	if err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)

	if attempt.CollectorApproval == nil {
		attempt.CollectorApproval = &CollectorApproval{}
	}
	attempt.CollectorApproval.CollectorHash = collectorHash
	attempt.CollectorApproval.OrderNo = orderNo
	attempt.CollectorApproval.ApprovedAt = now

	if approved {
		attempt.CollectorApproval.Status = "APPROVED"
		// Check if all conditions met to finalize approval
		if c.allApprovalsComplete(attempt) {
			attempt.Outcome = "APPROVED"
			approvedEvent, _ := json.Marshal(map[string]interface{}{
				"attemptId":  attemptID,
				"dlpiId":     attempt.DLPIId,
				"buyerName":  attempt.BuyerName,
				"community":  attempt.TribalCommunity,
				"action":     "PROCEED_PROPERTY_TRANSFER",
			})
			_ = ctx.GetStub().SetEvent("TribalTransferApproved", approvedEvent)
		}
	} else {
		attempt.CollectorApproval.Status = "REJECTED"
		attempt.Outcome = "HARD_REJECTED"
		attempt.RejectionCode = "COLLECTOR_REJECTED"
		attempt.RejectionReason = fmt.Sprintf("Collector rejected tribal transfer: %s", rejectionReason)
		attempt.LegalCitations = scheduleVCitations
	}

	attempt.UpdatedAt = now
	return c.saveAttempt(ctx, attempt)
}

// GetTribalAttempt — retrieve a specific transfer attempt (audit trail)
func (c *TribalGuardContract) GetTribalAttempt(
	ctx contractapi.TransactionContextInterface,
	attemptID string,
) (*TribalTransferAttempt, error) {
	return c.getAttempt(ctx, attemptID)
}

// GetAllAttemptsForParcel — full history of every attempt on a tribal parcel
func (c *TribalGuardContract) GetAllAttemptsForParcel(
	ctx contractapi.TransactionContextInterface,
	dlpiId string,
) ([]*TribalTransferAttempt, error) {
	query := fmt.Sprintf(`{"selector":{"dlpiId":"%s"}}`, dlpiId)
	return c.queryAttempts(ctx, query)
}

// GetRejectionStats — count of rejections by type (dashboard metric)
func (c *TribalGuardContract) GetRejectionStats(
	ctx contractapi.TransactionContextInterface,
) (map[string]int, error) {
	query := `{"selector":{"outcome":"HARD_REJECTED"}}`
	attempts, err := c.queryAttempts(ctx, query)
	if err != nil {
		return nil, err
	}

	stats := map[string]int{}
	for _, a := range attempts {
		stats[a.RejectionCode]++
	}
	return stats, nil
}

// IsTribalParcel — lightweight check for UI display (parcel boundary coloring)
func (c *TribalGuardContract) IsTribalParcel(
	ctx contractapi.TransactionContextInterface,
	dlpiId string,
) (*TribalParcelRegistry, error) {
	return c.getRegistry(ctx, dlpiId)
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

func (c *TribalGuardContract) allApprovalsComplete(attempt *TribalTransferAttempt) bool {
	if len(attempt.GramSabhaApprovals) < 5 {
		return false
	}
	if !attempt.VideoConsentVerified {
		return false
	}
	if attempt.CollectorApproval == nil || attempt.CollectorApproval.Status != "APPROVED" {
		return false
	}
	return true
}

func (c *TribalGuardContract) emitRejectionEvent(
	ctx contractapi.TransactionContextInterface,
	attempt *TribalTransferAttempt,
	registry *TribalParcelRegistry,
) error {
	event, _ := json.Marshal(map[string]interface{}{
		"attemptId":      attempt.AttemptID,
		"dlpiId":         attempt.DLPIId,
		"scheduleType":   registry.ScheduleType,
		"community":      registry.CommunityName,
		"village":        registry.VillageName,
		"tehsil":         registry.TehsilName,
		"buyerName":      attempt.BuyerName,
		"isTribalBuyer":  attempt.IsTribalBuyer,
		"rejectionCode":  attempt.RejectionCode,
		"legalCitations": attempt.LegalCitations,
		"responseTimeMs": attempt.ResponseTimeMs,
		"actions": []string{
			"NOTIFY_NALSA",
			"NOTIFY_STATE_TRIBAL_WELFARE_COMMISSIONER",
			"NOTIFY_DISTRICT_COLLECTOR",
			"ALERT_FRAUD_MONITORING",
		},
	})
	return ctx.GetStub().SetEvent("TribalTransferHardRejected", event)
}

func buildRejectedResult(dlpiId string, attempt *TribalTransferAttempt) *TransferCheckResult {
	return &TransferCheckResult{
		DLPIId:          dlpiId,
		AttemptID:       attempt.AttemptID,
		IsTribalParcel:  true,
		ScheduleType:    attempt.ScheduleType,
		Decision:        "HARD_REJECTED",
		RejectionCode:   attempt.RejectionCode,
		RejectionReason: attempt.RejectionReason,
		LegalCitations:  attempt.LegalCitations,
		ResponseTimeMs:  attempt.ResponseTimeMs,
	}
}

func (c *TribalGuardContract) parcelKey(dlpiId string) string {
	return "TRIBAL-PARCEL-" + dlpiId
}

func (c *TribalGuardContract) attemptKey(attemptID string) string {
	return "TRIBAL-ATTEMPT-" + attemptID
}

func (c *TribalGuardContract) getRegistry(ctx contractapi.TransactionContextInterface, dlpiId string) (*TribalParcelRegistry, error) {
	data, err := ctx.GetStub().GetState(c.parcelKey(dlpiId))
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, nil // not a tribal parcel — caller handles nil
	}
	var reg TribalParcelRegistry
	if err := json.Unmarshal(data, &reg); err != nil {
		return nil, err
	}
	return &reg, nil
}

func (c *TribalGuardContract) getAttempt(ctx contractapi.TransactionContextInterface, id string) (*TribalTransferAttempt, error) {
	data, err := ctx.GetStub().GetState(c.attemptKey(id))
	if err != nil {
		return nil, err
	}
	if data == nil {
		return nil, fmt.Errorf("tribal transfer attempt %s not found", id)
	}
	var attempt TribalTransferAttempt
	if err := json.Unmarshal(data, &attempt); err != nil {
		return nil, err
	}
	return &attempt, nil
}

func (c *TribalGuardContract) saveAttempt(ctx contractapi.TransactionContextInterface, attempt *TribalTransferAttempt) error {
	data, err := json.Marshal(attempt)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(c.attemptKey(attempt.AttemptID), data)
}

func (c *TribalGuardContract) queryAttempts(ctx contractapi.TransactionContextInterface, query string) ([]*TribalTransferAttempt, error) {
	iter, err := ctx.GetStub().GetQueryResult(query)
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	var results []*TribalTransferAttempt
	for iter.HasNext() {
		r, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var a TribalTransferAttempt
		if err := json.Unmarshal(r.Value, &a); err != nil {
			return nil, err
		}
		results = append(results, &a)
	}
	return results, nil
}

// ─── Return Type (used by callers via InvokeChaincode response) ───────────────

type TransferCheckResult struct {
	DLPIId            string   `json:"dlpiId"`
	AttemptID         string   `json:"attemptId,omitempty"`
	IsTribalParcel    bool     `json:"isTribalParcel"`
	ScheduleType      string   `json:"scheduleType,omitempty"`
	Community         string   `json:"community,omitempty"`
	Decision          string   `json:"decision"` // ALLOWED_NOT_TRIBAL | ALLOWED_PENDING_APPROVALS | HARD_REJECTED | APPROVED
	RejectionCode     string   `json:"rejectionCode,omitempty"`
	RejectionReason   string   `json:"rejectionReason,omitempty"`
	LegalCitations    []string `json:"legalCitations,omitempty"`
	RequiredApprovals []string `json:"requiredApprovals,omitempty"`
	ResponseTimeMs    int64    `json:"responseTimeMs"`
}

func main() {
	chaincode, err := contractapi.NewChaincode(&TribalGuardContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating TribalGuard chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("Error starting TribalGuard chaincode: %v", err))
	}
}
