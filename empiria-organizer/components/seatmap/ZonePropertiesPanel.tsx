"use client";

import { Input } from "@/components/input";
import { Label } from "@/components/label";

const ZONE_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

interface ZonePropertiesPanelProps {
  selectedZoneId: string | null;
  zones: Array<{ id: string; name: string; color: string }>;
  onUpdateZone: (id: string, name: string, color: string) => void;
}

export function ZonePropertiesPanel({
  selectedZoneId,
  zones,
  onUpdateZone,
}: ZonePropertiesPanelProps) {
  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  if (!selectedZone) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {zones.length === 0
          ? "Draw zones on the venue image using the polygon or rectangle tool."
          : "Select a zone to edit its properties."}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-medium text-sm">Zone Properties</h3>
      <div className="space-y-2">
        <Label htmlFor="zone-name">Name</Label>
        <Input
          id="zone-name"
          value={selectedZone.name}
          onChange={(e) =>
            onUpdateZone(selectedZone.id, e.target.value, selectedZone.color)
          }
          placeholder="e.g. VIP Section"
        />
      </div>
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {ZONE_COLORS.map((color) => (
            <button
              key={color}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                selectedZone.color === color
                  ? "border-foreground scale-110"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
              onClick={() =>
                onUpdateZone(selectedZone.id, selectedZone.name, color)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
