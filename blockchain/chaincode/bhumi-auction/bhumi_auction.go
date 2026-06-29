package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ─── Data Structures ─────────────────────────────────────────────────────────

type BhumiAuction struct {
	AuctionId       string      `json:"auctionId"`
	DlpiId          string      `json:"dlpiId"`
	AuctionType     string      `json:"auctionType"`     // COURT_ORDERED | GOVT_DISPOSAL
	Title           string      `json:"title"`
	Description     string      `json:"description"`
	OwnerName       string      `json:"ownerName"`
	KhasraNo        string      `json:"khasraNo"`
	AreaHectares    float64     `json:"areaHectares"`
	LandType        string      `json:"landType"`
	ReservePrice    int64       `json:"reservePrice"`
	CurrentBid      *int64      `json:"currentBid"`
	TotalBids       int         `json:"totalBids"`
	AuctionEnd      string      `json:"auctionEnd"`
	Status          string      `json:"status"`          // UPCOMING | ACTIVE | CLOSED | EXECUTED
	AuthorizedBy    string      `json:"authorizedBy"`
	CaseRef         string      `json:"caseRef"`
	LoanAmountINR   *int64      `json:"loanAmountINR,omitempty"`
	CersaiRegNo     string      `json:"cersaiRegNo,omitempty"`
	Lender          string      `json:"lender,omitempty"`
	EncumbranceType string      `json:"encumbranceType,omitempty"`
	IsAntiCollude   bool        `json:"isAntiCollude"`
	SealedBidReveal string      `json:"sealedBidReveal"`
	Winner          *AuctionWinner `json:"winner,omitempty"`
	InitiatedAt     string      `json:"initiatedAt"`
	UpdatedAt       string      `json:"updatedAt"`
}

// SealedBid — amount is not stored on-chain; only the sha256(amount+bidderHash+nonce) seal.
// This prevents observers from inferring bid values before reveal.
type SealedBid struct {
	BidId             string `json:"bidId"`
	AuctionId         string `json:"auctionId"`
	BidSealHash       string `json:"bidSealHash"`        // sha256(strconv.FormatInt(amount)+bidderAadhaarHash+nonce)
	BidderAadhaarHash string `json:"bidderAadhaarHash"`
	SealedAt          string `json:"sealedAt"`
	RevealedAmount    *int64 `json:"revealedAmount,omitempty"` // nil until RevealBid called
	RevealedAt        string `json:"revealedAt,omitempty"`
	IsWinner          bool   `json:"isWinner"`
	Status            string `json:"status"` // SEALED | REVEALED | INVALID
}

type AuctionWinner struct {
	BidId             string `json:"bidId"`
	BidderAadhaarHash string `json:"bidderAadhaarHash"`
	WinningBid        int64  `json:"winningBid"`
	ExecutedAt        string `json:"executedAt"`
	TxHash            string `json:"txHash"`
}

// ─── Smart Contract ───────────────────────────────────────────────────────────

type BhumiAuctionContract struct {
	contractapi.Contract
}

// ── InitiateAuction ───────────────────────────────────────────────────────────

func (c *BhumiAuctionContract) InitiateAuction(
	ctx contractapi.TransactionContextInterface,
	dlpiId, auctionType, title, description, ownerName, khasraNo string,
	areaHectaresStr, reservePriceStr string,
	landType, auctionEnd, authorizedBy, caseRef string,
) (*BhumiAuction, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	auctionId := fmt.Sprintf("AUC-%s-%s", dlpiId, ctx.GetStub().GetTxID()[:8])

	areaHectares, err := strconv.ParseFloat(areaHectaresStr, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid areaHectares: %w", err)
	}
	reservePrice, err := strconv.ParseInt(reservePriceStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid reservePrice: %w", err)
	}

	auction := &BhumiAuction{
		AuctionId:       auctionId,
		DlpiId:          dlpiId,
		AuctionType:     auctionType,
		Title:           title,
		Description:     description,
		OwnerName:       ownerName,
		KhasraNo:        khasraNo,
		AreaHectares:    areaHectares,
		LandType:        landType,
		ReservePrice:    reservePrice,
		AuctionEnd:      auctionEnd,
		Status:          "UPCOMING",
		AuthorizedBy:    authorizedBy,
		CaseRef:         caseRef,
		IsAntiCollude:   true,
		SealedBidReveal: auctionEnd,
		InitiatedAt:     now,
		UpdatedAt:       now,
	}

	auctionJSON, err := json.Marshal(auction)
	if err != nil {
		return nil, err
	}
	if err := ctx.GetStub().PutState(auctionId, auctionJSON); err != nil {
		return nil, err
	}

	ctx.GetStub().SetEvent("AuctionInitiated", auctionJSON)
	return auction, nil
}

// ── ActivateAuction ───────────────────────────────────────────────────────────

func (c *BhumiAuctionContract) ActivateAuction(
	ctx contractapi.TransactionContextInterface,
	auctionId string,
) (*BhumiAuction, error) {
	auction, err := c.getAuction(ctx, auctionId)
	if err != nil {
		return nil, err
	}
	if auction.Status != "UPCOMING" {
		return nil, fmt.Errorf("auction %s is not UPCOMING (status: %s)", auctionId, auction.Status)
	}
	auction.Status = "ACTIVE"
	auction.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	return c.saveAuction(ctx, auction)
}

// ── PlaceSealedBid ────────────────────────────────────────────────────────────
// Bidder submits sha256(amount+bidderAadhaarHash+nonce). Actual amount stays off-chain until reveal.

func (c *BhumiAuctionContract) PlaceSealedBid(
	ctx contractapi.TransactionContextInterface,
	auctionId, bidSealHash, bidderAadhaarHash string,
) (*SealedBid, error) {
	auction, err := c.getAuction(ctx, auctionId)
	if err != nil {
		return nil, err
	}
	if auction.Status != "ACTIVE" {
		return nil, fmt.Errorf("auction %s is not ACTIVE (status: %s)", auctionId, auction.Status)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	bidId := fmt.Sprintf("BID-%s-%s", auctionId, ctx.GetStub().GetTxID()[:8])

	bid := &SealedBid{
		BidId:             bidId,
		AuctionId:         auctionId,
		BidSealHash:       bidSealHash,
		BidderAadhaarHash: bidderAadhaarHash,
		SealedAt:          now,
		Status:            "SEALED",
	}

	bidJSON, err := json.Marshal(bid)
	if err != nil {
		return nil, err
	}
	if err := ctx.GetStub().PutState(bidId, bidJSON); err != nil {
		return nil, err
	}

	auction.TotalBids++
	auction.UpdatedAt = now
	if _, err := c.saveAuction(ctx, auction); err != nil {
		return nil, err
	}

	ctx.GetStub().SetEvent("BidSealed", bidJSON)
	return bid, nil
}

// ── RevealBid ────────────────────────────────────────────────────────────────
// After auction closes, bidder reveals: amount + nonce. Contract verifies sha256 matches seal.

func (c *BhumiAuctionContract) RevealBid(
	ctx contractapi.TransactionContextInterface,
	bidId, amountStr, nonce string,
) (*SealedBid, error) {
	bidJSON, err := ctx.GetStub().GetState(bidId)
	if err != nil || bidJSON == nil {
		return nil, fmt.Errorf("bid %s not found", bidId)
	}
	var bid SealedBid
	if err := json.Unmarshal(bidJSON, &bid); err != nil {
		return nil, err
	}

	// Verify seal
	expectedHash := fmt.Sprintf("%x", sha256.Sum256([]byte(amountStr+bid.BidderAadhaarHash+nonce)))
	if expectedHash != bid.BidSealHash {
		bid.Status = "INVALID"
		c.saveBid(ctx, &bid)
		return nil, fmt.Errorf("bid seal mismatch — bid %s marked INVALID", bidId)
	}

	amount, err := strconv.ParseInt(amountStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid amount: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	bid.RevealedAmount = &amount
	bid.RevealedAt = now
	bid.Status = "REVEALED"

	// Update auction current bid if this is highest
	auction, err := c.getAuction(ctx, bid.AuctionId)
	if err == nil && (auction.CurrentBid == nil || amount > *auction.CurrentBid) {
		auction.CurrentBid = &amount
		auction.UpdatedAt = now
		c.saveAuction(ctx, auction)
	}

	return c.saveBid(ctx, &bid)
}

// ── CloseAuction ─────────────────────────────────────────────────────────────

func (c *BhumiAuctionContract) CloseAuction(
	ctx contractapi.TransactionContextInterface,
	auctionId string,
) (*BhumiAuction, error) {
	auction, err := c.getAuction(ctx, auctionId)
	if err != nil {
		return nil, err
	}
	if auction.Status != "ACTIVE" {
		return nil, fmt.Errorf("auction must be ACTIVE to close (status: %s)", auction.Status)
	}
	auction.Status = "CLOSED"
	auction.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	saved, err := c.saveAuction(ctx, auction)
	if err != nil {
		return nil, err
	}
	savedJSON, _ := json.Marshal(saved)
	ctx.GetStub().SetEvent("AuctionClosed", savedJSON)
	return saved, nil
}

// ── ExecuteWinner ────────────────────────────────────────────────────────────
// Revenue officer calls after all bids revealed. Awards to highest bid ≥ reserve.

func (c *BhumiAuctionContract) ExecuteWinner(
	ctx contractapi.TransactionContextInterface,
	auctionId, winningBidId string,
) (*BhumiAuction, error) {
	auction, err := c.getAuction(ctx, auctionId)
	if err != nil {
		return nil, err
	}
	if auction.Status != "CLOSED" {
		return nil, fmt.Errorf("auction must be CLOSED before executing winner (status: %s)", auction.Status)
	}

	bidJSON, err := ctx.GetStub().GetState(winningBidId)
	if err != nil || bidJSON == nil {
		return nil, fmt.Errorf("winning bid %s not found", winningBidId)
	}
	var bid SealedBid
	if err := json.Unmarshal(bidJSON, &bid); err != nil {
		return nil, err
	}
	if bid.Status != "REVEALED" {
		return nil, fmt.Errorf("winning bid must be REVEALED (status: %s)", bid.Status)
	}
	if bid.RevealedAmount == nil || *bid.RevealedAmount < auction.ReservePrice {
		return nil, fmt.Errorf("winning bid ₹%d is below reserve price ₹%d", safeInt64(bid.RevealedAmount), auction.ReservePrice)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	bid.IsWinner = true
	c.saveBid(ctx, &bid)

	auction.Status = "EXECUTED"
	auction.UpdatedAt = now
	auction.Winner = &AuctionWinner{
		BidId:             winningBidId,
		BidderAadhaarHash: bid.BidderAadhaarHash,
		WinningBid:        *bid.RevealedAmount,
		ExecutedAt:        now,
		TxHash:            ctx.GetStub().GetTxID(),
	}

	saved, err := c.saveAuction(ctx, auction)
	if err != nil {
		return nil, err
	}
	savedJSON, _ := json.Marshal(saved)
	ctx.GetStub().SetEvent("AuctionExecuted", savedJSON)
	return saved, nil
}

// ── Queries ───────────────────────────────────────────────────────────────────

func (c *BhumiAuctionContract) GetAuction(
	ctx contractapi.TransactionContextInterface,
	auctionId string,
) (*BhumiAuction, error) {
	return c.getAuction(ctx, auctionId)
}

func (c *BhumiAuctionContract) GetAllAuctions(
	ctx contractapi.TransactionContextInterface,
) ([]*BhumiAuction, error) {
	iter, err := ctx.GetStub().GetStateByRange("AUC-", "AUC-~")
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var auctions []*BhumiAuction
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var a BhumiAuction
		if err := json.Unmarshal(kv.Value, &a); err != nil {
			continue
		}
		auctions = append(auctions, &a)
	}
	return auctions, nil
}

func (c *BhumiAuctionContract) GetAuctionBids(
	ctx contractapi.TransactionContextInterface,
	auctionId string,
) ([]*SealedBid, error) {
	iter, err := ctx.GetStub().GetStateByRange(
		fmt.Sprintf("BID-%s-", auctionId),
		fmt.Sprintf("BID-%s-~", auctionId),
	)
	if err != nil {
		return nil, err
	}
	defer iter.Close()

	var bids []*SealedBid
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, err
		}
		var b SealedBid
		if err := json.Unmarshal(kv.Value, &b); err != nil {
			continue
		}
		bids = append(bids, &b)
	}
	return bids, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (c *BhumiAuctionContract) getAuction(
	ctx contractapi.TransactionContextInterface,
	auctionId string,
) (*BhumiAuction, error) {
	data, err := ctx.GetStub().GetState(auctionId)
	if err != nil {
		return nil, fmt.Errorf("failed to read auction %s: %w", auctionId, err)
	}
	if data == nil {
		return nil, fmt.Errorf("auction %s not found", auctionId)
	}
	var a BhumiAuction
	if err := json.Unmarshal(data, &a); err != nil {
		return nil, err
	}
	return &a, nil
}

func (c *BhumiAuctionContract) saveAuction(
	ctx contractapi.TransactionContextInterface,
	a *BhumiAuction,
) (*BhumiAuction, error) {
	data, err := json.Marshal(a)
	if err != nil {
		return nil, err
	}
	return a, ctx.GetStub().PutState(a.AuctionId, data)
}

func (c *BhumiAuctionContract) saveBid(
	ctx contractapi.TransactionContextInterface,
	b *SealedBid,
) (*SealedBid, error) {
	data, err := json.Marshal(b)
	if err != nil {
		return nil, err
	}
	return b, ctx.GetStub().PutState(b.BidId, data)
}

func safeInt64(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	cc, err := contractapi.NewChaincode(&BhumiAuctionContract{})
	if err != nil {
		panic(fmt.Sprintf("Error creating bhumi-auction chaincode: %s", err))
	}
	if err := cc.Start(); err != nil {
		panic(fmt.Sprintf("Error starting bhumi-auction chaincode: %s", err))
	}
}
