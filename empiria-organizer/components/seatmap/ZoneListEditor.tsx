"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import type { ZoneDefinition, ZoneTier } from "@/lib/seatmap-types";

const ZONE_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

function makeDefaultTier(currency: string): ZoneTier {
  return {
    id: crypto.randomUUID(),
    name: "Adult",
    price: 0,
    initial_quantity: 100,
    max_per_order: 10,
    description: "",
    currency,
  };
}

function makeDefaultZone(usedColors: string[], currency: string): ZoneDefinition {
  const availableColor = ZONE_COLORS.find((c) => !usedColors.includes(c))
    ?? "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
  return {
    id: crypto.randomUUID(),
    tier_id: "",
    name: "",
    color: availableColor,
    polygons: [],
    tiers: [makeDefaultTier(currency)],
  };
}

interface ZoneListEditorProps {
  zones: ZoneDefinition[];
  onChange: (zones: ZoneDefinition[]) => void;
  currency?: string;
}

export function ZoneListEditor({
  zones,
  onChange,
  currency = "cad",
}: ZoneListEditorProps) {
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(
    zones[0]?.id ?? null
  );

  function emitChange(updatedZones: ZoneDefinition[]) {
    onChange(updatedZones);
  }

  function addZone() {
    const usedColors = zones.map((z) => z.color);
    const newZone = makeDefaultZone(usedColors, currency);
    const updated = [...zones, newZone];
    setExpandedZoneId(newZone.id);
    emitChange(updated);
  }

  function removeZone(zoneId: string) {
    const updated = zones.filter((z) => z.id !== zoneId);
    if (expandedZoneId === zoneId) {
      setExpandedZoneId(updated[0]?.id ?? null);
    }
    emitChange(updated);
  }

  function updateZone(zoneId: string, fields: Partial<ZoneDefinition>) {
    const updated = zones.map((z) =>
      z.id === zoneId ? { ...z, ...fields } : z
    );
    emitChange(updated);
  }

  function updateZoneColor(zoneId: string, color: string) {
    updateZone(zoneId, { color });
  }

  function addTier(zoneId: string) {
    const updated = zones.map((z) => {
      if (z.id !== zoneId) return z;
      const tiers = [...(z.tiers || []), makeDefaultTier(currency)];
      return { ...z, tiers };
    });
    emitChange(updated);
  }

  function removeTier(zoneId: string, tierId: string) {
    const updated = zones.map((z) => {
      if (z.id !== zoneId) return z;
      const tiers = (z.tiers || []).filter((t) => t.id !== tierId);
      return { ...z, tiers };
    });
    emitChange(updated);
  }

  function updateTier(zoneId: string, tierId: string, fields: Partial<ZoneTier>) {
    const updated = zones.map((z) => {
      if (z.id !== zoneId) return z;
      const tiers = (z.tiers || []).map((t) =>
        t.id === tierId ? { ...t, ...fields } : t
      );
      return { ...z, tiers };
    });
    emitChange(updated);
  }

  const totalCapacity = zones.reduce((sum, z) => {
    const zoneTiers = z.tiers && z.tiers.length > 0 ? z.tiers : [];
    return sum + zoneTiers.reduce((s, t) => s + t.initial_quantity, 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium text-sm text-foreground">
          Define Zones
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Create named zones with pricing tiers. Each zone can have multiple
          ticket types (e.g. Adult, Child, VIP) with independent pricing and
          capacity.
        </p>
      </div>

      {/* Zone list */}
      <div className="space-y-3">
        {zones.map((zone) => {
          const isExpanded = expandedZoneId === zone.id;
          const zoneTiers = zone.tiers && zone.tiers.length > 0 ? zone.tiers : [];
          const zoneCapacity = zoneTiers.reduce((s, t) => s + t.initial_quantity, 0);
          const otherUsedColors = zones
            .filter((z) => z.id !== zone.id)
            .map((z) => z.color);

          return (
            <div
              key={zone.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              {/* Zone header */}
              <button
                type="button"
                className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                onClick={() =>
                  setExpandedZoneId(isExpanded ? null : zone.id)
                }
              >
                <div
                  className="size-4 rounded-full shrink-0 border border-border"
                  style={{ backgroundColor: zone.color }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate block">
                    {zone.name || "Unnamed Zone"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {zoneTiers.length} tier{zoneTiers.length !== 1 ? "s" : ""} · {zoneCapacity} capacity
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeZone(zone.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                {isExpanded ? (
                  <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Zone body (expanded) */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border">
                  {/* Zone name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Zone Name</Label>
                    <Input
                      value={zone.name}
                      onChange={(e) =>
                        updateZone(zone.id, { name: e.target.value })
                      }
                      placeholder="e.g. Front Section, Balcony, VIP Area"
                      className="h-9 text-sm"
                    />
                  </div>

                  {/* Zone color */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {ZONE_COLORS.map((color) => {
                        const isUsedByOther = otherUsedColors.includes(color);
                        const isSelected = zone.color === color;
                        return (
                          <button
                            key={color}
                            type="button"
                            disabled={isUsedByOther}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              isSelected
                                ? "border-foreground scale-110"
                                : isUsedByOther
                                  ? "border-transparent opacity-30 cursor-not-allowed"
                                  : "border-transparent hover:scale-105"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => updateZoneColor(zone.id, color)}
                          />
                        );
                      })}
                      <label
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer overflow-hidden relative transition-transform ${
                          !ZONE_COLORS.includes(zone.color)
                            ? "border-foreground scale-110"
                            : "border-dashed border-muted-foreground"
                        }`}
                        style={{
                          backgroundColor: !ZONE_COLORS.includes(zone.color)
                            ? zone.color
                            : undefined,
                        }}
                        title="Custom color"
                      >
                        <input
                          type="color"
                          value={zone.color}
                          onChange={(e) => updateZoneColor(zone.id, e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        {ZONE_COLORS.includes(zone.color) && (
                          <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-bold">
                            +
                          </span>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Tiers */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Pricing Tiers</Label>
                      <button
                        type="button"
                        onClick={() => addTier(zone.id)}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Plus className="size-3" />
                        Add Tier
                      </button>
                    </div>

                    {zoneTiers.map((tier, idx) => (
                      <div
                        key={tier.id}
                        className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                            Tier {idx + 1}
                          </span>
                          {zoneTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeTier(zone.id, tier.id)}
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
                            updateTier(zone.id, tier.id, { name: e.target.value })
                          }
                          placeholder="e.g. Adult, Child, VIP"
                          className="h-8 text-sm"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground">
                              Price ({(tier.currency || currency).toUpperCase()})
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tier.price}
                              onChange={(e) =>
                                updateTier(zone.id, tier.id, {
                                  price: e.target.value === "" ? 0 : parseFloat(e.target.value),
                                })
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground">
                              Capacity
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={tier.initial_quantity}
                              onChange={(e) =>
                                updateTier(zone.id, tier.id, {
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
                                updateTier(zone.id, tier.id, {
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
                                updateTier(zone.id, tier.id, { description: e.target.value })
                              }
                              placeholder="Optional"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Zone total capacity */}
                    {zoneTiers.length > 1 && (
                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>Zone total capacity</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {zoneCapacity}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addZone}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Add Zone
      </Button>

      {/* Summary */}
      {zones.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Capacity (all zones)</span>
            <span className="text-sm font-bold tabular-nums">{totalCapacity}</span>
          </div>
        </div>
      )}
    </div>
  );
}
