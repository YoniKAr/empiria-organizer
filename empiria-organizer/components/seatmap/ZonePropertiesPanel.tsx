"use client";

import { Input } from "@/components/input";
import { Label } from "@/components/label";
import type { ZonePropertiesPanelProps } from "./types";

const ZONE_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

export { ZONE_COLORS };

export function ZonePropertiesPanel({
  selectedZoneId,
  zones,
  usedColors,
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

  // Colors used by OTHER zones (not the currently selected one)
  const otherUsedColors = usedColors.filter((c) => c !== selectedZone.color);

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-medium text-sm">Zone Properties</h3>
      <div className="space-y-2">
        <Label htmlFor="zone-name">Name</Label>
        <Input
          id="zone-name"
          value={selectedZone.name}
          onChange={(e) =>
            onUpdateZone(selectedZone.id, { name: e.target.value })
          }
          placeholder="e.g. VIP Section"
        />
      </div>
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {ZONE_COLORS.map((color) => {
            const isUsedByOther = otherUsedColors.includes(color);
            const isSelected = selectedZone.color === color;
            return (
              <button
                key={color}
                disabled={isUsedByOther}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  isSelected
                    ? "border-foreground scale-110"
                    : isUsedByOther
                      ? "border-transparent opacity-30 cursor-not-allowed"
                      : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
                onClick={() =>
                  onUpdateZone(selectedZone.id, { color })
                }
              />
            );
          })}
          {/* Custom color picker */}
          <label
            className={`w-8 h-8 rounded-full border-2 cursor-pointer overflow-hidden relative transition-transform ${
              !ZONE_COLORS.includes(selectedZone.color)
                ? "border-foreground scale-110"
                : "border-dashed border-muted-foreground"
            }`}
            style={{
              backgroundColor: !ZONE_COLORS.includes(selectedZone.color)
                ? selectedZone.color
                : undefined,
            }}
            title="Custom color"
          >
            <input
              type="color"
              value={selectedZone.color}
              onChange={(e) =>
                onUpdateZone(selectedZone.id, { color: e.target.value })
              }
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {ZONE_COLORS.includes(selectedZone.color) && (
              <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-bold">
                +
              </span>
            )}
          </label>
        </div>
      </div>

      {/* Pricing fields */}
      <div className="space-y-2">
        <Label htmlFor="zone-price">Price ({selectedZone.currency.toUpperCase()})</Label>
        <Input
          id="zone-price"
          type="number"
          min="0"
          step="0.01"
          value={selectedZone.price}
          onChange={(e) =>
            onUpdateZone(selectedZone.id, {
              price: e.target.value === "" ? 0 : parseFloat(e.target.value),
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="zone-qty">Quantity</Label>
        <Input
          id="zone-qty"
          type="number"
          min="1"
          value={selectedZone.initial_quantity}
          onChange={(e) =>
            onUpdateZone(selectedZone.id, {
              initial_quantity: parseInt(e.target.value) || 0,
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="zone-max">Max Per Order</Label>
        <Input
          id="zone-max"
          type="number"
          min="1"
          max="50"
          value={selectedZone.max_per_order}
          onChange={(e) =>
            onUpdateZone(selectedZone.id, {
              max_per_order: parseInt(e.target.value) || 1,
            })
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="zone-desc">Description</Label>
        <Input
          id="zone-desc"
          value={selectedZone.description}
          onChange={(e) =>
            onUpdateZone(selectedZone.id, { description: e.target.value })
          }
          placeholder="e.g. Front row seats with best view"
        />
      </div>
    </div>
  );
}
