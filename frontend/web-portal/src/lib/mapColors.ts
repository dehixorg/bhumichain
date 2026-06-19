import type { LandType, EncumbranceStatus } from '@/types';

// Fill colour by land type
export const LAND_TYPE_COLOR: Record<LandType, string> = {
  Bagayat:    '#22c55e',  // green — irrigated
  Jirayat:    '#a3e635',  // lime — rain-fed
  Kharaba:    '#6b7280',  // grey — barren
  Tribal_FRA: '#f59e0b',  // amber — tribal FRA protected
  Government: '#3b82f6',  // blue — government
  Forest:     '#065f46',  // dark green — forest
};

// Stroke (border) override when parcel has special status
export function getParcelStyle(properties: {
  landType: LandType;
  encumbranceStatus: EncumbranceStatus;
  isTribal: boolean;
  isCoparcenary: boolean;
  dlpiId: string;
  isSelected?: boolean;
  isHighlighted?: boolean;
}): L.PathOptions {
  const { landType, encumbranceStatus, isTribal, isSelected, isHighlighted, dlpiId } = properties;

  const fillColor = LAND_TYPE_COLOR[landType] || '#6b7280';

  // Demo parcels get special styling
  const isDemoParcel = dlpiId === 'DLPI-MH-SNN-00142' || dlpiId === 'DLPI-MH-IGT-T0023';

  let color = '#1f2937';      // default border — dark grey
  let weight = 0.8;
  let opacity = 1;
  let fillOpacity = 0.65;

  if (encumbranceStatus !== 'CLEAR') {
    color = '#ef4444';        // red border — encumbered
    weight = 1.5;
  }
  if (isTribal) {
    color = '#d97706';        // amber border — tribal
    weight = 1.5;
  }
  if (isDemoParcel) {
    weight = 2;
    fillOpacity = 0.85;
  }
  if (isSelected) {
    color = '#ffffff';
    weight = 3;
    fillOpacity = 0.95;
  }
  if (isHighlighted) {
    color = '#facc15';        // yellow pulse on WebSocket event
    weight = 3;
  }

  return { fillColor, color, weight, opacity, fillOpacity };
}

export const LAND_TYPE_LABELS: Record<LandType, string> = {
  Bagayat:    'Bagayat (Irrigated)',
  Jirayat:    'Jirayat (Rain-fed)',
  Kharaba:    'Kharaba (Barren)',
  Tribal_FRA: 'Tribal / FRA Protected',
  Government: 'Government Land',
  Forest:     'Forest Land',
};
