"use client";

import { useState } from "react";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Button } from "@/components/button";
import type { SeatDefinition } from "@/lib/seatmap-types";

interface SeatPlacerProps {
  sectionId: string;
  polygonId: string | null;
  seats: SeatDefinition[];
  polygonSeatCount: number;
  totalPolygons: number;
  onGenerateGrid: (rows: number, cols: number, prefix: string) => void;
  onClearSeats: () => void;
  seatCountWarning?: string | null;
}

export function SeatPlacer({
  sectionId,
  polygonId,
  seats,
  polygonSeatCount,
  totalPolygons,
  onGenerateGrid,
  onClearSeats,
  seatCountWarning,
}: SeatPlacerProps) {
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(10);
  const [prefix, setPrefix] = useState("");

  return (
    <div className="p-4 space-y-4 border-t">
      <h3 className="font-medium text-sm">Seat Placement</h3>

      {!polygonId ? (
        <p className="text-xs text-muted-foreground">
          Select a polygon on the canvas to place seats in it.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Generate a grid of seats inside the selected polygon, or use
            the <strong>Place Seats</strong> tool (crosshair icon) to
            click-place individual seats.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Rows</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seats/Row</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={cols}
                onChange={(e) => setCols(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Starting Row Letter (optional)</Label>
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. A (rows: A, B, C...)"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Rows are labeled top-to-bottom, seats left-to-right.
              {prefix
                ? ` Starting from "${prefix.toUpperCase()}".`
                : " Defaults to A, B, C..."}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            {rows * cols} seats will be generated
          </p>

          <Button
            size="sm"
            className="w-full"
            onClick={() => onGenerateGrid(rows, cols, prefix)}
          >
            Generate {rows * cols} Seats
          </Button>

          {polygonSeatCount > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                This polygon: {polygonSeatCount} seats
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-destructive hover:bg-destructive/10"
                onClick={onClearSeats}
              >
                Clear Seats
              </Button>
            </div>
          )}

          {seats.length > 0 && totalPolygons > 1 && (
            <p className="text-xs text-muted-foreground">
              Zone total: {seats.length} seats across {totalPolygons}{" "}
              polygon{totalPolygons !== 1 ? "s" : ""}
            </p>
          )}
          {seats.length > 0 && totalPolygons <= 1 && (
            <p className="text-xs text-muted-foreground">
              {seats.length} seats placed
            </p>
          )}

          {seatCountWarning && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {seatCountWarning}
            </div>
          )}
        </>
      )}
    </div>
  );
}
