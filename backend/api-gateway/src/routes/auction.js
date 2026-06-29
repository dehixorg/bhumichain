'use strict';

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { submit, evaluate } = require('../services/fabric');
const { authenticate, requireRole, ROLES } = require('../middleware/auth');

const router = Router();

const validate = (req, res, next) => {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
};

// GET /api/auction — list all auctions
router.get('/', authenticate, async (req, res) => {
  try {
    const list = await evaluate('bhumi-auction', 'GetAllAuctions', []);
    res.json(list || []);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// GET /api/auction/:auctionId
router.get('/:auctionId', authenticate, async (req, res) => {
  try {
    const auction = await evaluate('bhumi-auction', 'GetAuction', [req.params.auctionId]);
    if (!auction) return res.status(404).json({ error: 'AUCTION_NOT_FOUND' });
    res.json(auction);
  } catch (e) {
    res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
  }
});

// POST /api/auction/:auctionId/bid — sealed bid placement
router.post(
  '/:auctionId/bid',
  authenticate,
  body('bidAmountINR').isInt({ min: 1 }),
  body('bidderAadhaarHash').matches(/^sha256:[a-f0-9]{64}$/),
  validate,
  async (req, res) => {
    try {
      const { bidAmountINR, bidderAadhaarHash } = req.body;
      const result = await submit('bhumi-auction', 'PlaceSealedBid', [
        req.params.auctionId,
        String(bidAmountINR),
        bidderAadhaarHash,
      ]);
      res.status(201).json(result);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

// GET /api/auction/:auctionId/bids — officer view (reveals after close)
router.get(
  '/:auctionId/bids',
  authenticate,
  requireRole(ROLES.REVENUE_OFFICER, ROLES.COLLECTOR),
  async (req, res) => {
    try {
      const bids = await evaluate('bhumi-auction', 'GetAuctionBids', [req.params.auctionId]);
      res.json(bids || []);
    } catch (e) {
      res.status(500).json({ error: 'FABRIC_ERROR', message: e.message });
    }
  },
);

module.exports = router;
