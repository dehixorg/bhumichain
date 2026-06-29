import type { LandType, EncumbranceStatus } from '@/types';

// Fill colour by land type (UP primary + Maharashtra legacy)
export const LAND_TYPE_COLOR: Record<LandType, string> = {
  // UP types
  Bhumidhari:   '#22c55e',  // green — permanent occupancy
  Sirdar:       '#a3e635',  // lime — hereditary tenancy
  Asamiyadar:   '#84cc16',  // yellow-green — sub-tenancy
  Residential:  '#6366f1',  // indigo — residential
  Commercial:   '#f59e0b',  // amber — commercial
  Tribal_FRA:   '#d97706',  // deep amber — tribal FRA protected
  Govt_Reserved:'#3b82f6',  // blue — government
  // Maharashtra legacy
  Bagayat:      '#22c55e',
  Jirayat:      '#a3e635',
  Kharaba:      '#6b7280',
  Government:   '#3b82f6',
  Forest:       '#065f46',
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
  const isDemoParcel = dlpiId === 'DLPI-UP-DAD-00100' || dlpiId === 'DLPI-UP-DAD-00006';

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
  // UP types
  Bhumidhari:   'Bhumidhari (Permanent Occupancy)',
  Sirdar:       'Sirdar (Hereditary Tenancy)',
  Asamiyadar:   'Asamiyadar (Sub-tenancy)',
  Residential:  'Residential',
  Commercial:   'Commercial',
  Tribal_FRA:   'Tribal / FRA Protected',
  Govt_Reserved:'Government Reserved',
  // Maharashtra legacy
  Bagayat:      'Bagayat (Irrigated)',
  Jirayat:      'Jirayat (Rain-fed)',
  Kharaba:      'Kharaba (Barren)',
  Government:   'Government Land',
  Forest:       'Forest Land',
};
