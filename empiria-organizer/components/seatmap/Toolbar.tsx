"use client";

import {
  MousePointer2,
  Pentagon,
  Square,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
  CircleDot,
  X,
} from "lucide-react";
import { Button } from "@/components/button";
import type { ToolbarProps, DrawingTool } from "./types";

const TOOLS: { id: DrawingTool; icon: typeof MousePointer2; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "polygon", icon: Pentagon, label: "Draw Polygon" },
  { id: "rectangle", icon: Square, label: "Draw Rectangle" },
  { id: "seat-place", icon: CircleDot, label: "Place Seats" },
  { id: "pan", icon: Hand, label: "Pan" },
];

export function Toolbar({
  activeTool,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onResetView,
  onDeleteSelected,
  hasSelection,
  addingToZoneName,
  onCancelAddToZone,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 p-2 border-b bg-background">
      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        {TOOLS.map((tool) => (
          <Button
            key={tool.id}
            variant={activeTool === tool.id ? "default" : "ghost"}
            size="sm"
            onClick={() => onToolChange(tool.id)}
            title={tool.label}
          >
            <tool.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1 border-r pr-2 mr-2">
        <Button variant="ghost" size="sm" onClick={onZoomIn} title="Zoom In">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onResetView} title="Reset View">
          <Maximize className="h-4 w-4" />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        title="Delete Selected"
        className="text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* "Adding to zone" badge */}
      {addingToZoneName && (
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <span>Adding to: {addingToZoneName}</span>
          <button
            onClick={onCancelAddToZone}
            className="hover:bg-primary/20 rounded-full p-0.5"
            title="Cancel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
