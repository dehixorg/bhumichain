'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { Users, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TreeMember {
  memberId: string;
  name: string;
  relation: string;
  gender: string;
  dob: string;
  isAlive: boolean;
  isAdult: boolean;
  share?: string;
  shareDecimal?: number;
  legalNote?: string;
  hasConsented: boolean;
  hasObjected: boolean;
  notifiedAt?: string;
}

interface Patriarch {
  name: string;
  dob: string;
  dod?: string;
  isAlive: boolean;
}

interface Props {
  patriarch: Patriarch;
  members: TreeMember[];
  applicableLaw: string;
  successionStatus?: string;
  caseId?: string;
  onConsentClick?: (member: TreeMember) => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W = 160;
const NODE_H = 110;
const H_GAP  = 24;
const V_GAP  = 80;
const PAT_Y  = 20;
const HEIR_Y = PAT_Y + NODE_H + V_GAP;

// ─── Component ────────────────────────────────────────────────────────────────

export default function FamilyTree({
  patriarch, members, applicableLaw, successionStatus, caseId, onConsentClick,
}: Props) {
  const heirs = members.filter((m) => m.isAlive);
  const n = heirs.length;

  // SVG dimensions
  const totalW = Math.max(n * (NODE_W + H_GAP) - H_GAP, NODE_W + 40);
  const totalH = HEIR_Y + NODE_H + 20;
  const svgW   = totalW + 40;
  const svgH   = totalH + 20;

  // Patriarch centre
  const patX   = svgW / 2 - NODE_W / 2;
  const patCX  = patX + NODE_W / 2;
  const patBY  = PAT_Y + NODE_H;          // bottom-centre of patriarch box

  // Heir positions
  const heirPositions = useMemo(() => {
    const startX = (svgW - (n * NODE_W + (n - 1) * H_GAP)) / 2;
    return heirs.map((_, i) => ({
      x: startX + i * (NODE_W + H_GAP),
      cx: startX + i * (NODE_W + H_GAP) + NODE_W / 2,
    }));
  }, [heirs, n, svgW]);

  // Connector line midpoint Y
  const midY = patBY + V_GAP / 2;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="block mx-auto"
      >
        {/* ── Connector lines ──────────────────────────────────────────── */}
        {/* Vertical drop from patriarch */}
        {n > 0 && (
          <line
            x1={patCX} y1={patBY}
            x2={patCX} y2={midY}
            stroke="#374151" strokeWidth={1.5} strokeDasharray="4 3"
          />
        )}
        {/* Horizontal bus */}
        {n > 1 && (
          <line
            x1={heirPositions[0].cx} y1={midY}
            x2={heirPositions[n - 1].cx} y2={midY}
            stroke="#374151" strokeWidth={1.5} strokeDasharray="4 3"
          />
        )}
        {/* Drop to each heir */}
        {heirPositions.map(({ cx }, i) => (
          <line
            key={i}
            x1={cx} y1={midY}
            x2={cx} y2={HEIR_Y}
            stroke="#374151" strokeWidth={1.5} strokeDasharray="4 3"
          />
        ))}

        {/* ── Patriarch node ───────────────────────────────────────────── */}
        <foreignObject x={patX} y={PAT_Y} width={NODE_W} height={NODE_H}>
          <PatriarchNode patriarch={patriarch} />
        </foreignObject>

        {/* ── Heir nodes ───────────────────────────────────────────────── */}
        {heirs.map((heir, i) => (
          <foreignObject
            key={heir.memberId}
            x={heirPositions[i].x}
            y={HEIR_Y}
            width={NODE_W}
            height={NODE_H}
          >
            <HeirNode
              heir={heir}
              onClick={() => onConsentClick?.(heir)}
            />
          </foreignObject>
        ))}
      </svg>

      {/* ── Legend / status ───────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500 px-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3 text-brand-400" /> Consented
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-amber-400" /> Awaiting consent
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-red-400" /> Objected
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-purple-400" /> HSA 2005 ★ daughter's equal right
        </div>
        <div className="ml-auto text-gray-600">{applicableLaw}</div>
      </div>

      {caseId && (
        <div className="mt-2 text-xs text-gray-600 px-2">
          Case ID: <span className="font-mono text-gray-400">{caseId}</span>
          {successionStatus && (
            <span className={clsx(
              'ml-3 px-2 py-0.5 rounded-full text-xs font-semibold',
              successionStatus === 'AUTO_MUTATED'       && 'bg-brand-900 text-brand-300',
              successionStatus === 'AWAITING_CONSENTS'  && 'bg-amber-900 text-amber-300',
              successionStatus === 'COURT_REFERRED'     && 'bg-red-900 text-red-300',
              successionStatus === 'HEIRS_IDENTIFIED'   && 'bg-blue-900 text-blue-300',
            )}>
              {successionStatus.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-nodes ────────────────────────────────────────────────────────────────

function PatriarchNode({ patriarch }: { patriarch: Patriarch }) {
  const isDead = !patriarch.isAlive;
  return (
    // @ts-ignore — xmlns needed inside foreignObject
    <div xmlns="http://www.w3.org/1999/xhtml"
      className={clsx(
        'w-full h-full rounded-xl border-2 flex flex-col items-center justify-center p-2 text-center',
        isDead
          ? 'bg-gray-800 border-gray-600'
          : 'bg-brand-900 border-brand-700',
      )}
    >
      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center mb-1',
        isDead ? 'bg-gray-700' : 'bg-brand-700')}>
        <Users className={clsx('w-4 h-4', isDead ? 'text-gray-400' : 'text-brand-200')} />
      </div>
      <div className="text-xs font-semibold text-gray-200 leading-tight">{patriarch.name}</div>
      <div className="text-xs text-gray-500 mt-0.5">
        {patriarch.dob?.slice(0, 4)}
        {isDead && patriarch.dod && ` – ${patriarch.dod.slice(0, 4)}`}
      </div>
      {isDead && (
        <div className="mt-1 text-xs font-semibold text-red-400">Deceased</div>
      )}
    </div>
  );
}

function HeirNode({ heir, onClick }: { heir: TreeMember; onClick: () => void }) {
  const isDaughter = heir.relation === 'Daughter';
  const consentDone = heir.hasConsented;
  const objected = heir.hasObjected;

  let borderColor = 'border-gray-700';
  let bgColor = 'bg-gray-800';
  if (consentDone)  { borderColor = 'border-brand-600'; bgColor = 'bg-brand-950'; }
  if (objected)     { borderColor = 'border-red-600';   bgColor = 'bg-red-950'; }

  return (
    // @ts-ignore
    <div xmlns="http://www.w3.org/1999/xhtml"
      onClick={onClick}
      className={clsx(
        'w-full h-full rounded-xl border-2 p-2 flex flex-col cursor-pointer transition-colors',
        borderColor, bgColor,
        !consentDone && !objected && 'hover:border-amber-600',
      )}
    >
      {/* Status icon */}
      <div className="flex items-start justify-between mb-1">
        <span className={clsx(
          'text-xs font-medium',
          heir.gender === 'F' ? 'text-purple-400' : 'text-blue-400',
        )}>
          {heir.relation}
          {isDaughter && <span className="ml-1 text-purple-300">★</span>}
        </span>
        {consentDone  && <CheckCircle className="w-3.5 h-3.5 text-brand-400 shrink-0" />}
        {objected     && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
        {!consentDone && !objected && <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
      </div>

      {/* Name */}
      <div className="text-xs font-semibold text-gray-200 leading-tight flex-1">{heir.name}</div>
      <div className="text-xs text-gray-500">{heir.dob?.slice(0, 4)}</div>

      {/* Share badge */}
      {heir.share && (
        <div className="mt-1.5 bg-gray-900 rounded-md px-2 py-0.5 text-center">
          <span className="font-mono text-sm font-bold text-brand-300">{heir.share}</span>
          <span className="text-gray-600 text-xs ml-1">share</span>
        </div>
      )}

      {/* Legal note chip */}
      {heir.legalNote && (
        <div className="mt-1 flex items-center gap-1">
          <Shield className="w-2.5 h-2.5 text-purple-400 shrink-0" />
          <span className="text-purple-400 text-xs truncate">HSA 2005</span>
        </div>
      )}

      {/* Click hint */}
      {!consentDone && !objected && (
        <div className="mt-1 text-xs text-amber-500 text-center">click to consent</div>
      )}
    </div>
  );
}
