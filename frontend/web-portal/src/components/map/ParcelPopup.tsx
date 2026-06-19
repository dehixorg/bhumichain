'use client';

import React from 'react';
import type { Parcel } from '@/types';
import { LAND_TYPE_LABELS } from '@/lib/mapColors';
import { Shield, AlertTriangle, Users, MapPin, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  parcel: Parcel;
  onViewFull?: (dlpiId: string) => void;
}

export default function ParcelPopup({ parcel, onViewFull }: Props) {
  const isDemo = parcel.dlpiId === 'DLPI-MH-SNN-00142' || parcel.dlpiId === 'DLPI-MH-IGT-T0023';

  return (
    <div className="min-w-[280px] max-w-[340px] text-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-mono text-xs text-brand-400 mb-0.5">{parcel.dlpiId}</div>
          <div className="font-semibold text-gray-100 text-base leading-tight">{parcel.owner.name}</div>
          <div className="text-gray-400 text-xs mt-0.5">
            Survey No. {parcel.surveyNumber} · {parcel.tehsil} Tehsil
          </div>
        </div>
        {isDemo && (
          <span className="shrink-0 ml-2 bg-saffron-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            DEMO
          </span>
        )}
      </div>

      {/* Land Info */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <div className="text-gray-400 text-xs">Land Type</div>
          <div className="text-gray-100 font-medium text-xs mt-0.5">
            {LAND_TYPE_LABELS[parcel.landType]}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <div className="text-gray-400 text-xs">Area</div>
          <div className="text-gray-100 font-medium text-xs mt-0.5">
            {parcel.areaHectares.toFixed(2)} Ha
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {parcel.encumbranceStatus === 'CLEAR' ? (
          <span className="badge-clear flex items-center gap-1">
            <Shield className="w-3 h-3" /> Clear Title
          </span>
        ) : (
          <span className="badge-encumbered flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {parcel.encumbranceStatus}
          </span>
        )}
        {parcel.isTribal && (
          <span className="badge-tribal flex items-center gap-1">
            <Shield className="w-3 h-3" /> Schedule V Protected
          </span>
        )}
        {parcel.isCoparcenary && (
          <span className="badge-coparcenary flex items-center gap-1">
            <Users className="w-3 h-3" /> Coparcenary
          </span>
        )}
      </div>

      {/* Coparcenary heirs */}
      {parcel.isCoparcenary && parcel.coparcenary && (
        <div className="bg-gray-800 rounded-lg p-2.5 mb-3">
          <div className="text-gray-400 text-xs mb-1.5 flex items-center gap-1">
            <Users className="w-3 h-3" /> Heirs ({parcel.coparcenary.heirs.length})
          </div>
          {parcel.coparcenary.heirs.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-0.5">
              <span className="text-gray-300">{h.name}</span>
              <span className="flex items-center gap-1">
                <span className="text-gray-400">{h.relation}</span>
                <span className="font-mono text-brand-400">{h.share}</span>
                {h.relation === 'Daughter' && (
                  <span className="text-purple-400 font-bold" title="HSA 2005 S.6(3)">★</span>
                )}
              </span>
            </div>
          ))}
          <div className="text-gray-500 text-xs mt-1.5 pt-1.5 border-t border-gray-700">
            {parcel.coparcenary.applicableLaw}
          </div>
        </div>
      )}

      {/* Valuation */}
      {parcel.valuation && (
        <div className="flex items-center justify-between text-xs mb-3">
          <span className="text-gray-400">Circle Rate Value</span>
          <span className="text-gray-100 font-mono">
            ₹{(parcel.valuation.estimatedValueINR / 100000).toFixed(1)}L
          </span>
        </div>
      )}

      {/* Location */}
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
        <MapPin className="w-3 h-3" />
        {parcel.location?.villageName || parcel.tehsil}, {parcel.district}
      </div>

      {/* Registered */}
      {parcel.createdAt && (
        <div className="text-xs text-gray-600 mb-3">
          Registered: {format(new Date(parcel.createdAt), 'dd MMM yyyy')}
        </div>
      )}

      {/* IPFS CID */}
      {parcel.ipfsCID && (
        <div className="flex items-center gap-1 text-xs text-gray-600 mb-3 font-mono truncate">
          IPFS: {parcel.ipfsCID}
        </div>
      )}

      {/* Action button */}
      {onViewFull && (
        <button
          onClick={() => onViewFull(parcel.dlpiId)}
          className="w-full flex items-center justify-center gap-1.5 btn-primary text-xs py-1.5"
        >
          <ExternalLink className="w-3 h-3" />
          View Full Record
        </button>
      )}
    </div>
  );
}
