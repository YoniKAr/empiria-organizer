"use client";

import { useState } from "react";
import { Upload, LayoutGrid, MapPin, List } from "lucide-react";
import { Button } from "@/components/button";
import { Label } from "@/components/label";
import { SeatmapDesigner } from "./SeatmapDesigner";
import { SeatRangeEditor } from "./SeatRangeEditor";
import { ZoneListEditor } from "./ZoneListEditor";
import { useImageUpload } from "./useImageUpload";
import type { SeatingConfig, SeatingMode, ZoneDefinition } from "@/lib/seatmap-types";

interface StepSeatingProps {
  seatingType: SeatingMode;
  seatingConfig: SeatingConfig | null;
  onSeatingTypeChange: (type: SeatingMode) => void;
  onSeatingConfigChange: (config: SeatingConfig) => void;
  ticketTiers: Array<{ id: string; name: string }>;
  currency?: string;
}

const SEATING_OPTIONS: {
  value: SeatingMode;
  label: string;
  description: string;
  icon: typeof MapPin;
}[] = [
  {
    value: "general_admission",
    label: "General Admission",
    description: "No assigned seating. Customers buy tickets by tier.",
    icon: LayoutGrid,
  },
  {
    value: "assigned_seating",
    label: "Seat Based (No Map)",
    description:
      "Define seat ranges (A1-A19, B1-B12). Customers get specific named seats.",
    icon: List,
  },
  {
    value: "zone_admission",
    label: "Zone Based (No Map)",
    description:
      "Define named zones with capacity and pricing. No venue map needed.",
    icon: LayoutGrid,
  },
  {
    value: "zone_map",
    label: "Zone Based Map",
    description:
      "Draw zones on a venue image. Customers pick a zone on the map.",
    icon: MapPin,
  },
  {
    value: "seat_map",
    label: "Seat Selection Map",
    description:
      "Place individual seats on a venue image. Customers pick exact seats.",
    icon: MapPin,
  },
];

export function StepSeating({
  seatingType,
  seatingConfig,
  onSeatingTypeChange,
  onSeatingConfigChange,
  ticketTiers,
  currency = "cad",
}: StepSeatingProps) {
  const { uploading, error: uploadError, uploadImage } = useImageUpload();
  const [isDraggingVenue, setIsDraggingVenue] = useState(false);
  const [imageUrl, setImageUrl] = useState(seatingConfig?.image_url ?? null);
  const [imageWidth, setImageWidth] = useState(
    seatingConfig?.image_width ?? 0
  );
  const [imageHeight, setImageHeight] = useState(
    seatingConfig?.image_height ?? 0
  );

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadImage(file);
    if (result) {
      setImageUrl(result.url);
      setImageWidth(result.width);
      setImageHeight(result.height);
    }
  }

  async function handleVenueDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingVenue(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const result = await uploadImage(file);
    if (result) {
      setImageUrl(result.url);
      setImageWidth(result.width);
      setImageHeight(result.height);
    }
  }

  function handleZoneListChange(zones: ZoneDefinition[]) {
    const config: SeatingConfig = {
      image_url: null,
      image_width: 0,
      image_height: 0,
      view_mode: "schematic",
      zones,
    };
    onSeatingConfigChange(config);
  }

  const imageUploadBlock = (
    <div className="space-y-2">
      <Label>Venue Image</Label>
      {!imageUrl ? (
        <label
          className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDraggingVenue ? "border-primary bg-primary/10" : "hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingVenue(true); }}
          onDragEnter={(e) => { e.preventDefault(); setIsDraggingVenue(true); }}
          onDragLeave={() => setIsDraggingVenue(false)}
          onDrop={handleVenueDrop}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">
            {uploading ? "Uploading..." : isDraggingVenue ? "Drop image here" : "Drag & drop or click to upload venue image"}
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            PNG, JPG, or WebP (max 5MB)
          </span>
          <input
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageUpload}
            disabled={uploading}
          />
        </label>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <img
              src={imageUrl}
              alt="Venue"
              className="w-full h-40 object-cover rounded-lg"
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => {
                setImageUrl(null);
                setImageWidth(0);
                setImageHeight(0);
              }}
            >
              Change
            </Button>
          </div>
        </div>
      )}
      {uploadError && (
        <p className="text-xs text-destructive">{uploadError}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Seating Layout
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how customers will select their seats.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {SEATING_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-colors ${
              seatingType === opt.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => onSeatingTypeChange(opt.value)}
          >
            <opt.icon
              className={`h-5 w-5 mt-0.5 ${
                seatingType === opt.value
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            />
            <div>
              <div className="font-medium text-sm">{opt.label}</div>
              <div className="text-xs text-muted-foreground">
                {opt.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Assigned Seating — SeatRangeEditor (no canvas) */}
      {seatingType === "assigned_seating" && (
        <SeatRangeEditor
          tiers={ticketTiers}
          initialConfig={seatingConfig}
          onChange={onSeatingConfigChange}
        />
      )}

      {/* Zone Admission — ZoneListEditor (no map) */}
      {seatingType === "zone_admission" && (
        <ZoneListEditor
          zones={seatingConfig?.zones ?? []}
          onChange={handleZoneListChange}
          currency={currency}
        />
      )}

      {/* Zone Map — image upload + SeatmapDesigner in zone mode */}
      {seatingType === "zone_map" && (
        <>
          {imageUploadBlock}
          {imageUrl && (
            <SeatmapDesigner
              mode="zone"
              imageUrl={imageUrl}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              initialConfig={seatingConfig ?? undefined}
              onChange={onSeatingConfigChange}
            />
          )}
        </>
      )}

      {/* Seat Map — image upload + SeatmapDesigner in seat mode */}
      {seatingType === "seat_map" && (
        <>
          {imageUploadBlock}
          {imageUrl && (
            <SeatmapDesigner
              mode="seat"
              imageUrl={imageUrl}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              initialConfig={seatingConfig ?? undefined}
              onChange={onSeatingConfigChange}
            />
          )}
        </>
      )}
    </div>
  );
}
