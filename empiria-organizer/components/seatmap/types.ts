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

export interface ZonePropertiesPanelProps {
  selectedZoneId: string | null;
  zones: Array<{ id: string; name: string; color: string }>;
  onUpdateZone: (id: string, name: string, color: string) => void;
}
