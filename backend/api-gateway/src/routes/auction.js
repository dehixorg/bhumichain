'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { submit, evaluate } = require('../services/fabric');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // For triggering internal API

const router = Router();
const DB_PATH = path.join(__dirname, '..', 'mock', 'bhumichain_voluntary_auctions.json');

// Ensure DB file exists
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([]), 'utf-8');
}

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

const getLocalAuctions = () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch(e) {}
  return [];
};

const saveLocalAuctions = (auctions) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(auctions, null, 2));
};

// GET /api/auction — list all auctions
router.get('/', authenticate, async (req, res) => {
  try {
    const list = await evaluate('bhumi-auction', 'GetAllAuctions', []).catch(() => []);
    const localAuctions = getLocalAuctions();
    res.json([...(list || []), ...localAuctions]);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/auction/:auctionId
router.get('/:auctionId', authenticate, async (req, res) => {
  try {
    const localAuctions = getLocalAuctions();
    const localAuction = localAuctions.find(a => a.auctionId === req.params.auctionId);
    if (localAuction) return res.json(localAuction);

    const auction = await evaluate('bhumi-auction', 'GetAuction', [req.params.auctionId]);
    if (!auction) return res.status(404).json({ error: 'AUCTION_NOT_FOUND' });
    res.json(auction);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// POST /api/auction/list — Create a Voluntary Open Market Auction
router.post('/list', authenticate, requireRole(ROLES.CITIZEN), async (req, res) => {
  try {
    const { dlpiId, reservePrice, durationDays } = req.body;
    
    const dlpi = await evaluate('dlpi', 'GetDLPI', [dlpiId]).catch(() => null);
    
    const auctionId = 'AUC-VOL-' + dlpiId + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const end = new Date(Date.now() + (durationDays || 7) * 24 * 60 * 60 * 1000);
    
    const newAuction = {
      auctionId,
      dlpiId,
      auctionType: 'VOLUNTARY',
      title: `Voluntary Open Market - ${dlpiId}`,
      description: `Citizen listed property for sale on the open market.`,
      ownerName: req.user.name || 'Citizen Owner',
      ownerAadhaar: req.user.aadhaarNumber,
      khesraNo: dlpi ? dlpi.khesraNo : 'N/A',
      areaHectares: dlpi ? dlpi.areaHectares : 1.0,
      landType: dlpi ? dlpi.landType : 'Raiyati',
      reservePrice: reservePrice,
      currentBid: null,
      totalBids: 0,
      auctionEnd: end.toISOString(),
      status: 'ACTIVE',
      authorizedBy: req.user.name,
      caseRef: 'Voluntary Listing',
      encumbranceSince: null,
      encumbranceType: null,
      lender: null,
      loanAmountINR: null,
      cersaiRegNo: null,
      isAntiCollude: true,
      sealedBidReveal: end.toISOString(),
      bids: [] 
    };

    const localAuctions = getLocalAuctions();
    localAuctions.push(newAuction);
    saveLocalAuctions(localAuctions);
    
    res.status(201).json({ success: true, auction: newAuction });
  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.message });
  }
});

// POST /api/auction/:auctionId/bid — sealed bid placement
router.post(
  '/:auctionId/bid',
  authenticate,
  body('bidAmountINR').isInt({ min: 1 }),
  body('bidderAadhaarNumber').isString().notEmpty(),
  validate,
  async (req, res) => {
    try {
      const { bidAmountINR, bidderAadhaarNumber, bidderName } = req.body;
      const { auctionId } = req.params;

      const localAuctions = getLocalAuctions();
      const localIdx = localAuctions.findIndex(a => a.auctionId === auctionId);
      
      if (localIdx >= 0) {
        if (localAuctions[localIdx].ownerAadhaar === bidderAadhaarNumber) {
           return res.status(400).json({ error: 'INVALID_BID', message: 'Owner cannot bid on their own property.' });
        }
        const newBid = {
          bidderHash: bidderAadhaarNumber,
          bidderName: bidderName || 'Anonymous Bidder',
          amount: parseInt(bidAmountINR),
          sealedAt: new Date().toISOString(),
          status: 'SEALED'
        };
        localAuctions[localIdx].bids = localAuctions[localIdx].bids || [];
        localAuctions[localIdx].bids.push(newBid);
        localAuctions[localIdx].totalBids = localAuctions[localIdx].bids.length;
        if (!localAuctions[localIdx].currentBid || parseInt(bidAmountINR) > localAuctions[localIdx].currentBid) {
           localAuctions[localIdx].currentBid = parseInt(bidAmountINR);
        }
        saveLocalAuctions(localAuctions);
        return res.status(201).json({ success: true, bidSealHash: `bid-seal-${Date.now()}` });
      }

      const result = await submit('bhumi-auction', 'PlaceSealedBid', [
        auctionId,
        String(bidAmountINR),
        bidderAadhaarNumber,
      ]);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/auction/:auctionId/bids
router.get(
  '/:auctionId/bids',
  authenticate,
  async (req, res) => {
    try {
      const { auctionId } = req.params;
      const localAuctions = getLocalAuctions();
      const localAuction = localAuctions.find(a => a.auctionId === auctionId);
      if (localAuction) {
         return res.json(localAuction.bids || []);
      }
      const bids = await evaluate('bhumi-auction', 'GetAuctionBids', [auctionId]);
      res.json(bids || []);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// POST /api/auction/:auctionId/close — close auction and initiate transfer
router.post('/:auctionId/close', authenticate, requireRole(ROLES.CITIZEN), async (req, res) => {
  try {
    const { auctionId } = req.params;
    const localAuctions = getLocalAuctions();
    const localIdx = localAuctions.findIndex(a => a.auctionId === auctionId);
    
    if (localIdx === -1) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Voluntary auction not found.' });
    }
    
    const auction = localAuctions[localIdx];
    
    if (auction.ownerAadhaar !== req.user.aadhaarNumber) {
      return res.status(403).json({ error: 'UNAUTHORIZED', message: 'Only the owner can close this auction.' });
    }

    if (!auction.bids || auction.bids.length === 0) {
      return res.status(400).json({ error: 'NO_BIDS', message: 'Cannot close without bids.' });
    }

    const highestBid = auction.bids.reduce((max, bid) => bid.amount > max.amount ? bid : max, auction.bids[0]);

    if (highestBid.amount < auction.reservePrice) {
      return res.status(400).json({ error: 'RESERVE_NOT_MET', message: 'Highest bid is below reserve price.' });
    }

    const payload = {
      dlpiId: auction.dlpiId,
      transferType: 'FULL_SALE',
      sellers: [{ name: auction.ownerName, aadhaarNumber: auction.ownerAadhaar, shareFraction: '1/1', shareDecimal: 1 }],
      buyers: [{ name: highestBid.bidderName, aadhaarNumber: highestBid.bidderHash, shareFraction: '1/1', shareDecimal: 1 }],
      buyerAadhaarNumber: highestBid.bidderHash,
      buyerName: highestBid.bidderName,
      encumbrances: [],
      declaredValueINR: highestBid.amount
    };

    const port = process.env.PORT || 4001;
    const authHeader = req.headers.authorization;
    const transferResponse = await axios.post(`http://localhost:${port}/api/transfer/initiate`, payload, {
      headers: { Authorization: authHeader }
    });

    auction.status = 'CLOSED';
    auction.winningBid = highestBid;
    saveLocalAuctions(localAuctions);

    res.json({ success: true, message: 'Auction closed and transfer initiated!', transferId: transferResponse.data.transferId });

  } catch (e) {
    res.status(500).json({ error: 'SERVER_ERROR', message: e.response ? e.response.data : e.message });
  }
});

module.exports = router;
