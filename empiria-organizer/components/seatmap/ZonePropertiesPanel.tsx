"use client";

import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Plus, Trash2 } from "lucide-react";
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
  onAddZoneTier,
  onRemoveZoneTier,
  onUpdateZoneTier,
  seatMode = false,
}: ZonePropertiesPanelProps) {
  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  if (!selectedZone) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {zones.length === 0
          ? "Draw zones on the venue image using the polygon or rectangle tool. Each zone represents a physical area."
          : "Select a zone to edit its properties."}
      </div>
    );
  }

  const otherUsedColors = zones
    .filter((z) => z.id !== selectedZoneId)
    .map((z) => z.color);
  const totalTierQty = selectedZone.tiers.reduce((sum, t) => sum + t.initial_quantity, 0);

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-medium text-sm">Zone Properties</h3>

      {/* Zone Name */}
      <div className="space-y-2">
        <Label htmlFor="zone-name">Zone Name</Label>
        <Input
          id="zone-name"
          value={selectedZone.name}
          onChange={(e) =>
            onUpdateZone(selectedZone.id, { name: e.target.value })
          }
          placeholder="e.g. Front Section, Balcony"
        />
      </div>

      {/* Zone Color */}
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

      {/* Seat info */}
      {seatMode && selectedZone.seats.length > 0 && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {selectedZone.seats.length} seats placed in this zone
        </div>
      )}

      {/* Zone Tiers */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Ticket Tiers</Label>
          <button
            type="button"
            onClick={() => onAddZoneTier(selectedZone.id)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="size-3" />
            Add Tier
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug -mt-1">
          Define pricing tiers for this zone (e.g. Adult, Child, VIP).
        </p>

        {selectedZone.tiers.map((tier, idx) => (
          <div
            key={tier.id}
            className="rounded-lg border border-border bg-card p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Tier {idx + 1}
              </span>
              {selectedZone.tiers.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveZoneTier(selectedZone.id, tier.id)}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Remove tier"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>

            <Input
              value={tier.name}
              onChange={(e) =>
                onUpdateZoneTier(selectedZone.id, tier.id, { name: e.target.value })
              }
              placeholder="e.g. Adult, Child, VIP"
              className="h-8 text-sm"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">
                  Price ({tier.currency.toUpperCase()})
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.price}
                  onChange={(e) =>
                    onUpdateZoneTier(selectedZone.id, tier.id, {
                      price: e.target.value === "" ? 0 : parseFloat(e.target.value),
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">
                  Quantity
                </label>
                <Input
                  type="number"
                  min="1"
                  value={tier.initial_quantity}
                  onChange={(e) =>
                    onUpdateZoneTier(selectedZone.id, tier.id, {
                      initial_quantity: parseInt(e.target.value) || 0,
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">
                  Max Per Order
                </label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={tier.max_per_order}
                  onChange={(e) =>
                    onUpdateZoneTier(selectedZone.id, tier.id, {
                      max_per_order: parseInt(e.target.value) || 1,
                    })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">
                  Description
                </label>
                <Input
                  value={tier.description}
                  onChange={(e) =>
                    onUpdateZoneTier(selectedZone.id, tier.id, { description: e.target.value })
                  }
                  placeholder="Optional"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        ))}

        {/* Total capacity for this zone */}
        {selectedZone.tiers.length > 1 && (
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>Zone total capacity</span>
            <span className="font-medium text-foreground tabular-nums">
              {totalTierQty}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
