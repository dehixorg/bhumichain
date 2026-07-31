'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import AppHeader from '@/components/dashboard/AppHeader';
import { getDemoToken } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Gavel, Clock, Shield, CheckCircle, AlertTriangle,
  Lock, ChevronRight, Info, Zap, X,
} from 'lucide-react';
import clsx from 'clsx';
import { format, formatDistanceToNow } from 'date-fns';

// ─── Demo auction data ─────────────────────────────────────────────────────────

const AUCTION_END = new Date(Date.now() + 3 * 60 * 60 * 1000 + 24 * 60 * 1000); // 3h 24m from now

const DEMO_AUCTIONS: DemoAuction[] = [
  {
    auctionId:       'AUC-DLPI-Bihar-PHU-00088-f1a2b3c4',
    dlpiId:          'DLPI-Bihar-PHU-00088',
    auctionType:     'COURT_ORDERED',
    title:           'Khesra 312/2A — Phulwari Sharif Anchal',
    description:     'Court-ordered sale pursuant to SBI loan foreclosure. Khesra 312/2A, village Dankaur, Phulwari Sharif anchal. Raiyati title.',
    ownerName:       'Rajan Mishra',
    khesraNo:        '312/2A',
    areaHectares:    0.25,
    landType:        'Raiyati',
    reservePrice:    2_500_000,
    currentBid:      2_750_000,
    totalBids:       4,
    auctionEnd:      AUCTION_END.toISOString(),
    status:          'ACTIVE',
    authorizedBy:    'Civil Judge (Sr. Div.), Patna — Order No. CS/2025/0471',
    caseRef:         'CS No. 2025/0471, GBN Civil Court',
    encumbranceSince:'2024-03-15',
    encumbranceType: 'MORTGAGE',
    lender:          'State Bank of India, Phulwari Sharif Branch',
    loanAmountINR:   2_200_000,
    cersaiRegNo:     'CERSAI-Bihar-PHU-2024-00781',
    isAntiCollude:   true,
    sealedBidReveal: AUCTION_END.toISOString(),
  },
  {
    auctionId:       'AUC-DLPI-Bihar-PHU-00115-g2b3c4d5',
    dlpiId:          'DLPI-Bihar-PHU-00115',
    auctionType:     'GOVT_DISPOSAL',
    title:           'Govt. Reserved — Plot 7, Sector 12, Phulwari Sharif',
    description:     'Bihar Government disposal of surplus agricultural land. Khesra 598, village Jewar, Phulwari Sharif anchal. Government Reserved parcel.',
    ownerName:       'Government of Bihar',
    khesraNo:        '598',
    areaHectares:    2.10,
    landType:        'Govt_Reserved',
    reservePrice:    8_500_000,
    currentBid:      null,
    totalBids:       0,
    auctionEnd:      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    status:          'UPCOMING',
    authorizedBy:    'District Collector, Patna — Order DM/2026/0234',
    caseRef:         'DM Order 2026/0234',
    encumbranceSince:null,
    encumbranceType: null,
    lender:          null,
    loanAmountINR:   null,
    cersaiRegNo:     null,
    isAntiCollude:   true,
    sealedBidReveal: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

interface DemoAuction {
  auctionId:        string;
  dlpiId:           string;
  auctionType:      'COURT_ORDERED' | 'GOVT_DISPOSAL';
  title:            string;
  description:      string;
  ownerName:        string;
  khesraNo:         string;
  areaHectares:     number;
  landType:         string;
  reservePrice:     number;
  currentBid:       number | null;
  totalBids:        number;
  auctionEnd:       string;
  status:           'ACTIVE' | 'UPCOMING' | 'CLOSED';
  authorizedBy:     string;
  caseRef:          string;
  encumbranceSince: string | null;
  encumbranceType:  string | null;
  lender:           string | null;
  loanAmountINR:    number | null;
  cersaiRegNo:      string | null;
  isAntiCollude:    boolean;
  sealedBidReveal:  string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuctionPage() {
  const [auctions, setAuctions]     = useState<DemoAuction[]>(DEMO_AUCTIONS);
  const [selected, setSelected]     = useState<DemoAuction>(DEMO_AUCTIONS[0]);
  const [showBidModal, setShowBid]  = useState(false);
  const [bids, setBids]             = useState<PlacedBid[]>([]);
  const [timeLeft, setTimeLeft]     = useState('');
  const [user, setUser]             = useState<any>(null);
  const [closing, setClosing]       = useState(false);

  useEffect(() => {
    import('@/lib/api').then(({ getAuctions }) => {
      getAuctions().then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAuctions(data);
          setSelected(data[0]);
        }
      }).catch(() => {});
    });
    getDemoToken('citizen', 'Demo Citizen').then(t => {
      if(t && t.user) setUser(t.user);
    }).catch(() => {});
  }, []);

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const end = new Date(selected.auctionEnd);
      const diff = end.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('CLOSED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [selected.auctionEnd]);

  const handleBidPlaced = (bid: PlacedBid) => {
    setBids((prev) => [bid, ...prev]);
    toast.success(`Sealed bid ₹${fmtINR(bid.amount)} recorded on BhumiChain`);
  };

  const handleCloseAuction = async () => {
    setClosing(true);
    try {
      const { closeAuction } = await import('@/lib/api');
      toast.loading('Closing auction and accepting highest bid...', { id: 'close-auction' });
      await closeAuction(selected.auctionId);
      toast.success('🎉 Auction closed! Transfer initiated to highest bidder.', { id: 'close-auction' });
      // Refresh
      const { getAuctions } = await import('@/lib/api');
      const data = await getAuctions();
      if (Array.isArray(data)) {
        setAuctions(data);
        const updated = data.find(a => a.auctionId === selected.auctionId);
        if (updated) setSelected(updated);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to close auction', { id: 'close-auction' });
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC]">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

      {showBidModal && (
        <BidModal
          auction={selected}
          user={user}
          onBid={handleBidPlaced}
          onClose={() => setShowBid(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Topbar */}
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-6 gap-3 shrink-0">
          <Gavel className="w-4 h-4 text-[#0F4C81]" />
          <span className="text-sm font-semibold text-gray-800">BhumiAuction</span>
          <span className="text-xs text-gray-500">— e-Auction Platform for Land Parcels</span>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-[#0F4C81]">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            {auctions.filter((a) => a.status === 'ACTIVE').length} Live Auction
          </div>
        </div>

        <div className="flex-1 flex gap-0 divide-x divide-gray-800">

          {/* ── Auction list ──────────────────────────────────────────── */}
          <div className="w-80 shrink-0 flex flex-col overflow-y-auto bg-white">
            <div className="p-4 border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Active &amp; Upcoming Auctions
              </div>
            </div>
            <div className="flex-1 p-3 space-y-2">
              {auctions.map((auction) => (
                <button
                  key={auction.auctionId}
                  onClick={() => setSelected(auction)}
                  className={clsx(
                    'w-full text-left rounded-xl p-3 border transition-colors',
                    selected.auctionId === auction.auctionId
                      ? 'bg-[#0F4C81]/5 border-[#0F4C81]/20'
                      : 'bg-gray-100 border-gray-200 hover:border-gray-300',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={auction.status} />
                    <span className="text-xs text-gray-500 ml-auto font-mono">{auction.khesraNo}</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 truncate">{auction.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">{auction.dlpiId}</div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-gray-500">
                      Reserve: <span className="text-gray-800 font-semibold">₹{fmtINR(auction.reservePrice)}</span>
                    </span>
                    {auction.currentBid && (
                      <span className="text-[#0F4C81] font-semibold">
                        Bid: ₹{fmtINR(auction.currentBid)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Detail panel ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-5">

              {/* Countdown header */}
              {selected.status === 'ACTIVE' && (
                <div className={clsx(
                  'flex items-center gap-4 border rounded-2xl px-5 py-4',
                  timeLeft === 'CLOSED'
                    ? 'bg-gray-100 border-gray-200'
                    : 'bg-amber-50 border-amber-200',
                )}>
                  <Clock className={clsx(
                    'w-8 h-8 shrink-0',
                    timeLeft === 'CLOSED' ? 'text-gray-500' : 'text-amber-700',
                  )} />
                  <div>
                    <div className="text-xs text-amber-500 font-semibold uppercase tracking-wider mb-1">
                      Time Remaining
                    </div>
                    <div className={clsx(
                      'text-3xl font-mono font-bold',
                      timeLeft === 'CLOSED' ? 'text-gray-500' : 'text-amber-700',
                    )}>
                      {timeLeft}
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xs text-gray-500 mb-1">Current Highest Bid</div>
                    <div className="text-2xl font-bold text-[#0F4C81]">
                      {selected.currentBid ? `₹${fmtINR(selected.currentBid)}` : '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {selected.totalBids + bids.length} sealed bids
                    </div>
                  </div>
                </div>
              )}

              {selected.status === 'UPCOMING' && (
                <div className="flex items-center gap-3 bg-gray-100 border border-gray-200 rounded-2xl px-5 py-4">
                  <Clock className="w-6 h-6 text-gray-500" />
                  <div>
                    <div className="text-gray-600 font-semibold">Auction Opens</div>
                    <div className="text-gray-500 text-sm">
                      {format(new Date(selected.auctionEnd), 'dd MMM yyyy, HH:mm')} (
                      {formatDistanceToNow(new Date(selected.auctionEnd), { addSuffix: true })})
                    </div>
                  </div>
                </div>
              )}

              {/* Parcel details */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Gavel className="w-4 h-4 text-[#0F4C81]" />
                  <span className="text-sm font-semibold text-gray-800">Parcel Details</span>
                  <TypeBadge type={selected.auctionType} />
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  <InfoRow label="DLPI"          value={selected.dlpiId} mono />
                  <InfoRow label="Khesra No."    value={selected.khesraNo} mono />
                  <InfoRow label="Land Type"     value={selected.landType} />
                  <InfoRow label="Area"          value={`${selected.areaHectares} Ha`} />
                  <InfoRow label="Current Owner" value={selected.ownerName} />
                  <InfoRow label="Reserve Price" value={`₹ ${fmtINR(selected.reservePrice)}`} />
                </div>
                <div className="mt-3 text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
                  {selected.description}
                </div>
              </div>

              {/* Legal authority */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-[#0F4C81]" />
                  <span className="text-sm font-semibold text-gray-800">Legal Authority</span>
                </div>
                <div className="space-y-2">
                  <InfoRow label="Authorized By" value={selected.authorizedBy} />
                  <InfoRow label="Case Ref."      value={selected.caseRef} mono />
                  {selected.lender && (
                    <InfoRow label="Lender"        value={selected.lender} />
                  )}
                  {selected.cersaiRegNo && (
                    <InfoRow label="CERSAI Reg."   value={selected.cersaiRegNo} mono />
                  )}
                  {selected.encumbranceType && (
                    <InfoRow label="Encumbrance"   value={`${selected.encumbranceType} since ${selected.encumbranceSince}`} />
                  )}
                </div>
              </div>

              {/* Anti-collude notice */}
              {selected.isAntiCollude && (
                <div className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                  <Lock className="w-4 h-4 text-purple-700 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-purple-700 font-semibold text-sm">Anti-Collusion: Sealed Bid Auction</div>
                    <div className="text-purple-600 text-xs mt-1 leading-relaxed">
                      All bids are sealed (encrypted hash stored on BhumiChain). Bids are revealed simultaneously
                      at auction close (<span className="font-mono">{format(new Date(selected.sealedBidReveal), 'dd MMM yyyy, HH:mm')}</span>).
                      No bidder knows other bid amounts until the reveal. Prevents bid-rigging and collusion.
                    </div>
                  </div>
                </div>
              )}

              {/* Placed bids by this session */}
              {bids.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-800 mb-3">Your Sealed Bids (this session)</div>
                  <div className="space-y-2">
                    {bids.map((bid, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-100 rounded-lg px-3 py-2.5 text-sm">
                        <CheckCircle className="w-4 h-4 text-[#0F4C81] shrink-0" />
                        <div>
                          <div className="text-gray-800 font-semibold">₹ {fmtINR(bid.amount)}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">{bid.txHash}</div>
                        </div>
                        <Lock className="w-3.5 h-3.5 text-gray-500 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              {selected.status === 'ACTIVE' && timeLeft !== 'CLOSED' && (
                <>
                  {user && user.aadhaarNumber === selected.ownerAadhaar ? (
                    <button
                      onClick={handleCloseAuction}
                      disabled={closing}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {closing ? 'Closing...' : 'Close Auction & Accept Highest Bid'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowBid(true)}
                      className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                    >
                      <Gavel className="w-5 h-5" />
                      Place Sealed Bid
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Right info ────────────────────────────────────────────── */}
          <div className="w-64 shrink-0 bg-white flex flex-col overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">How It Works</div>
            </div>
            <div className="p-4 space-y-4">
              <ol className="space-y-3 text-xs">
                {[
                  ['Register interest',    'Login with Aadhaar eSign'],
                  ['Place sealed bid',     'Bid hash stored on BhumiChain'],
                  ['Auction closes',       'All bids revealed simultaneously'],
                  ['Highest bid wins',     'Auto-verified against reserve'],
                  ['Stamp duty payment',   'UPI within 48 hours'],
                  ['Title transfer',       'DLPI updated on ledger'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 font-mono text-xs">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-gray-600 font-medium">{title}</div>
                      <div className="text-gray-600 mt-0.5">{desc}</div>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-700" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Why BhumiAuction?</span>
                </div>
                <div className="text-xs text-gray-500 space-y-1.5">
                  <p>Traditional e-auctions suffer from bid-rigging, last-second sniping, and opacity.</p>
                  <p>BhumiChain's <span className="text-[#0F4C81] font-medium">sealed bid + simultaneous reveal</span> eliminates all three.</p>
                  <p>Every bid is an immutable on-chain commitment — no retraction, no ghosting.</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-[#0F4C81]" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Eligibility</span>
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>• Indian citizen (KYC via Aadhaar)</p>
                  <p>• Non-NRI for tribal/Schedule V parcels</p>
                  <p>• Not a party to the foreclosure case</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Bid Modal ────────────────────────────────────────────────────────────────

interface PlacedBid { amount: number; txHash: string; at: string }

function BidModal({
  auction,
  user,
  onBid,
  onClose,
}: {
  auction: DemoAuction;
  user?: any;
  onBid: (b: PlacedBid) => void;
  onClose: () => void;
}) {
  const [amount, setAmount]     = useState('');
  const [aadhaar, setAadhaar]   = useState('');
  const [submitting, setSub]    = useState(false);

  const minBid = (auction.currentBid ?? auction.reservePrice) + 10000;

  const handleSubmit = async () => {
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsed) || parsed < minBid) {
      toast.error(`Minimum bid: ₹${fmtINR(minBid)}`);
      return;
    }
    if (aadhaar.length !== 12) {
      toast.error('Enter 12-digit Aadhaar number');
      return;
    }
    setSub(true);
    try {
      const { placeBid } = await import('@/lib/api');
      const res = await placeBid(auction.auctionId, {
        bidAmountINR: parsed,
        bidderAadhaarNumber: aadhaar,
        bidderName: user?.name || 'Demo Bidder'
      });
      const txHash = res.txHash || `bid-seal-${Date.now().toString(36).toUpperCase()}`;
      onBid({ amount: parsed, txHash, at: new Date().toISOString() });
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to place bid');
    } finally {
      setSub(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white border border-[#0F4C81]/20 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#0F4C81]/5 border-b border-[#0F4C81]/20 px-5 py-4 flex items-center gap-3">
          <Gavel className="w-5 h-5 text-[#0F4C81]" />
          <div>
            <div className="text-brand-200 font-bold text-sm">Place Sealed Bid</div>
            <div className="text-[#0F4C81] text-xs mt-0.5 font-mono">{auction.dlpiId}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-[#0F4C81] hover:text-[#0F4C81]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700 flex gap-2">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Your bid is sealed and stored on BhumiChain. It is revealed only at auction close along with all other bids simultaneously.
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Bid Amount (INR) — min ₹{fmtINR(minBid)}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(minBid)}
                className="w-full bg-gray-100 border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#0F4C81]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Aadhaar Number (for eSign)</label>
            <input
              type="text"
              maxLength={12}
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
              placeholder="999900010010"
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 font-mono focus:outline-none focus:border-[#0F4C81]"
            />
            <div className="text-xs text-gray-600 mt-1">Demo: use 999900010010</div>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 text-sm py-2.5">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Gavel className="w-4 h-4" />
                  Seal Bid on Chain
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components & helpers ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE:   'bg-[#0F4C81] text-[#0F4C81]',
    UPCOMING: 'bg-amber-50 text-amber-700',
    CLOSED:   'bg-gray-700 text-gray-500',
  };
  return (
    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', map[status] ?? 'bg-gray-700 text-gray-500')}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={clsx(
      'text-xs font-semibold px-2 py-0.5 rounded-full ml-auto',
      type === 'COURT_ORDERED' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-300',
    )}>
      {type === 'COURT_ORDERED' ? 'Court Order' : 'Govt. Disposal'}
    </span>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 text-sm shrink-0">{label}</span>
      <span className={clsx('text-gray-800 text-right text-sm break-all', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

function fmtINR(n: number): string {
  return n.toLocaleString('en-IN');
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
