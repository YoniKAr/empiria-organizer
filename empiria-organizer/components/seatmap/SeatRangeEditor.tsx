"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import type { SeatRange, SeatingConfig } from "@/lib/seatmap-types";

interface TicketTierOption {
  id: string;
  name: string;
}

interface SeatRangeEditorProps {
  tiers: TicketTierOption[];
  initialConfig: SeatingConfig | null;
  onChange: (config: SeatingConfig) => void;
}

export function SeatRangeEditor({
  tiers,
  initialConfig,
  onChange,
}: SeatRangeEditorProps) {
  const [ranges, setRanges] = useState<SeatRange[]>(
    initialConfig?.seat_ranges ?? []
  );
  const [allowChoice, setAllowChoice] = useState(
    initialConfig?.allow_seat_choice ?? false
  );

  function emitChange(
    updatedRanges: SeatRange[],
    updatedAllowChoice: boolean
  ) {
    const config: SeatingConfig = {
      image_url: null,
      image_width: 0,
      image_height: 0,
      view_mode: "schematic",
      seat_ranges: updatedRanges,
      allow_seat_choice: updatedAllowChoice,
    };
    onChange(config);
  }

  function addRange() {
    const newRange: SeatRange = {
      id: crypto.randomUUID(),
      prefix: String.fromCharCode(65 + ranges.length), // A, B, C, ...
      start: 1,
      end: 20,
      tier_id: tiers[0]?.id ?? "",
    };
    const updated = [...ranges, newRange];
    setRanges(updated);
    emitChange(updated, allowChoice);
  }

  function removeRange(id: string) {
    const updated = ranges.filter((r) => r.id !== id);
    setRanges(updated);
    emitChange(updated, allowChoice);
  }

  function updateRange(id: string, field: keyof SeatRange, value: string | number) {
    const updated = ranges.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    setRanges(updated);
    emitChange(updated, allowChoice);
  }

  function handleAllowChoiceChange(checked: boolean) {
    setAllowChoice(checked);
    emitChange(ranges, checked);
  }

  const totalSeats = ranges.reduce(
    (sum, r) => sum + Math.max(0, r.end - r.start + 1),
    0
  );

  // Generate preview labels
  const previewLabels = ranges.flatMap((r) => {
    const labels: string[] = [];
    for (let i = r.start; i <= r.end && labels.length < 50; i++) {
      labels.push(`${r.prefix}${i}`);
    }
    if (r.end - r.start + 1 > 50) labels.push("...");
    return labels;
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium text-sm text-foreground">
          Define Seat Ranges
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Define rows or sections of seats by prefix and number range.
          Customers will be assigned specific seats (e.g., A1, A2, B5).
        </p>
      </div>

      {/* Ranges table */}
      {ranges.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Prefix
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Start
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  End
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Tier
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Seats
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {ranges.map((range) => (
                <tr key={range.id} className="border-t">
                  <td className="px-3 py-2">
                    <Input
                      value={range.prefix}
                      onChange={(e) =>
                        updateRange(range.id, "prefix", e.target.value)
                      }
                      placeholder="A"
                      className="w-24 h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      value={range.start}
                      onChange={(e) =>
                        updateRange(range.id, "start", Number(e.target.value))
                      }
                      className="w-20 h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={range.start}
                      value={range.end}
                      onChange={(e) =>
                        updateRange(range.id, "end", Number(e.target.value))
                      }
                      className="w-20 h-8 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={range.tier_id}
                      onChange={(e) =>
                        updateRange(range.id, "tier_id", e.target.value)
                      }
                      className="w-full h-8 text-sm border rounded-md px-2 bg-background"
                    >
                      <option value="">Select tier</option>
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">
                    {Math.max(0, range.end - range.start + 1)}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRange(range.id)}
                      className="h-8 w-8 p-0 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={addRange}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Add Range
      </Button>

      {/* Allow seat choice toggle */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          role="switch"
          aria-checked={allowChoice}
          onClick={() => handleAllowChoiceChange(!allowChoice)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            allowChoice ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              allowChoice ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <div>
          <Label className="text-sm font-medium cursor-pointer">
            Allow customers to choose their seat
          </Label>
          <p className="text-xs text-muted-foreground">
            {allowChoice
              ? "Customers will pick specific seats during checkout"
              : "Seats will be auto-assigned at checkout"}
          </p>
        </div>
      </div>

      {/* Summary */}
      {ranges.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total Seats</span>
            <span className="text-sm font-bold tabular-nums">{totalSeats}</span>
          </div>

          {/* Preview */}
          {previewLabels.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Preview:</p>
              <div className="flex flex-wrap gap-1">
                {previewLabels.slice(0, 60).map((label, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-background border"
                  >
                    {label}
                  </span>
                ))}
                {previewLabels.length > 60 && (
                  <span className="text-xs text-muted-foreground self-center">
                    ...and {totalSeats - 60} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
