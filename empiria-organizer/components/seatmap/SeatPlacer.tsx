"use client";

import { useState } from "react";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Button } from "@/components/button";
import type { SeatDefinition } from "@/lib/seatmap-types";

interface SeatPlacerProps {
  sectionId: string;
  seats: SeatDefinition[];
  onGenerateGrid: (rows: number, cols: number, prefix: string) => void;
}

export function SeatPlacer({ sectionId, seats, onGenerateGrid }: SeatPlacerProps) {
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(10);
  const [prefix, setPrefix] = useState("");

  return (
    <div className="p-4 space-y-4 border-t">
      <h3 className="font-medium text-sm">Seat Grid Generator</h3>
      <p className="text-xs text-muted-foreground">
        Auto-generate a grid of seats inside this section.
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
        <Label className="text-xs">Row Prefix (optional)</Label>
        <Input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="e.g. A (generates A1, A2...)"
        />
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

      {seats.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Current: {seats.length} seats placed
        </p>
      )}
    </div>
  );
}
