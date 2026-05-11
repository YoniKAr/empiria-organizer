export type DrawingTool = "select" | "polygon" | "rectangle" | "pan" | "seat-place";

export interface ToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  addingToZoneName?: string;
  onCancelAddToZone?: () => void;
}

export interface ZoneTierItem {
  id: string;
  name: string;
  price: number;
  initial_quantity: number;
  max_per_order: number;
  description: string;
  currency: string;
}

export interface ZonePropertiesPanelProps {
  selectedZoneId: string | null;
  zones: Array<{
    id: string;
    name: string;
    color: string;
    tiers: ZoneTierItem[];
    seats: Array<{ id: string; label: string; x: number; y: number }>;
    polygons: Array<{ id: string; seats: Array<{ id: string; label: string; x: number; y: number }> }>;
  }>;
  usedColors: string[];
  onUpdateZone: (id: string, updates: Record<string, unknown>) => void;
  onAddZoneTier: (zoneId: string) => void;
  onRemoveZoneTier: (zoneId: string, tierId: string) => void;
  onUpdateZoneTier: (zoneId: string, tierId: string, updates: Record<string, string | number>) => void;
  seatMode?: boolean;
}
