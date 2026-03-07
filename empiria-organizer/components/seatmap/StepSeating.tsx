"use client";

import { useState } from "react";
import { Upload, LayoutGrid, MapPin } from "lucide-react";
import { Button } from "@/components/button";
import { Label } from "@/components/label";
import { SeatmapDesigner } from "./SeatmapDesigner";
import { useImageUpload } from "./useImageUpload";
import type { SeatingConfig, SeatingMode } from "@/lib/seatmap-types";

interface StepSeatingProps {
  seatingType: SeatingMode;
  seatingConfig: SeatingConfig | null;
  onSeatingTypeChange: (type: SeatingMode) => void;
  onSeatingConfigChange: (config: SeatingConfig) => void;
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
    value: "reserved_seating_list",
    label: "Zone Map",
    description:
      "Draw zones on a venue image. Customers pick a zone and quantity.",
    icon: MapPin,
  },
  {
    value: "seatmap_pro",
    label: "Seat Map",
    description:
      "Place individual seats in sections. Customers pick exact seats on a map.",
    icon: LayoutGrid,
  },
];

export function StepSeating({
  seatingType,
  seatingConfig,
  onSeatingTypeChange,
  onSeatingConfigChange,
}: StepSeatingProps) {
  const { uploading, error: uploadError, uploadImage } = useImageUpload();
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

      {seatingType !== "general_admission" && (
        <>
          <div className="space-y-2">
            <Label>Venue Image</Label>
            {!imageUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? "Uploading..." : "Click to upload venue image"}
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

          {imageUrl && (
            <SeatmapDesigner
              mode={
                seatingType === "reserved_seating_list" ? "zone" : "seat"
              }
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
