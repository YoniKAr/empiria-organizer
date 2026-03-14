"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Canvas,
  Polygon,
  Rect,
  Circle,
  FabricImage,
  FabricObject,
  FabricText,
  Point,
  util,
  type TPointerEventInfo,
} from "fabric";
import { Toolbar } from "./Toolbar";
import { ZonePropertiesPanel, ZONE_COLORS } from "./ZonePropertiesPanel";
import { SeatPlacer } from "./SeatPlacer";
import type { DrawingTool } from "./types";
import type {
  SeatingConfig,
  ZoneDefinition,
  ZonePolygon,
  ZoneTier,
  SectionDefinition,
  SeatDefinition,
  MapSubMode,
} from "@/lib/seatmap-types";

// Fabric.js v6 supports a `data` property at runtime but doesn't include it in TS types.
interface ObjData {
  zoneId?: string;
  polygonId?: string;
  seatId?: string;
  sectionId?: string;
  label?: string;
  isSeatLabel?: boolean;
}

function getObjData(obj: FabricObject): ObjData | undefined {
  return (obj as FabricObject & { data?: ObjData }).data;
}

function setObjData(obj: FabricObject, data: ObjData) {
  (obj as FabricObject & { data?: ObjData }).data = data;
}

interface SeatmapDesignerProps {
  mode: "zone" | "seat";
  imageUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  initialConfig?: SeatingConfig;
  onChange: (config: SeatingConfig) => void;
  currency?: string;
  showSeatPlacer?: boolean;
  mapSubMode?: MapSubMode;
}

interface PolygonState {
  id: string;
  seats: SeatDefinition[];
}

interface ZoneTierState {
  id: string;
  name: string;
  price: number;
  initial_quantity: number;
  max_per_order: number;
  description: string;
  currency: string;
}

interface ZoneState {
  id: string;
  name: string;
  color: string;
  polygons: PolygonState[];
  seats: SeatDefinition[]; // aggregated across all polygons
  tiers: ZoneTierState[];
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function getNextAvailableColor(usedColors: string[]): string {
  const available = ZONE_COLORS.filter((c) => !usedColors.includes(c));
  if (available.length > 0) return available[0];
  // Fallback: random hex
  return "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
}

export function SeatmapDesigner({
  mode,
  imageUrl,
  imageWidth,
  imageHeight,
  initialConfig,
  onChange,
  currency = "cad",
  showSeatPlacer = false,
  mapSubMode,
}: SeatmapDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [zones, setZones] = useState<ZoneState[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [addingToZoneId, setAddingToZoneId] = useState<string | null>(null);
  const zoneCounterRef = useRef(0);
  const zonesRef = useRef<ZoneState[]>([]);

  // Keep zonesRef in sync
  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: "#f1f5f9",
      selection: true,
    });

    fabricRef.current = canvas;

    // Load background image if provided
    if (imageUrl) {
      FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" }).then(
        (img) => {
          const scale = Math.min(
            CANVAS_WIDTH / (img.width || 1),
            CANVAS_HEIGHT / (img.height || 1)
          );
          img.scaleX = scale;
          img.scaleY = scale;
          img.set({
            left: (CANVAS_WIDTH - (img.width || 0) * scale) / 2,
            top: (CANVAS_HEIGHT - (img.height || 0) * scale) / 2,
            selectable: false,
            evented: false,
          });
          canvas.backgroundImage = img;
          canvas.renderAll();
        }
      );
    }

    // Selection events
    canvas.on("selection:created", (e) => {
      const obj = e.selected?.[0];
      if (obj) {
        const d = getObjData(obj);
        if (d?.zoneId) setSelectedZoneId(d.zoneId);
      }
    });

    canvas.on("selection:cleared", () => {
      setSelectedZoneId(null);
    });

    canvas.on("selection:updated", (e) => {
      const obj = e.selected?.[0];
      if (obj) {
        const d = getObjData(obj);
        if (d?.zoneId) setSelectedZoneId(d.zoneId);
      }
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Extract points from a fabric object (Polygon or Rect)
  function extractPoints(obj: FabricObject): [number, number][] {
    if (obj instanceof Polygon) {
      const matrix = obj.calcTransformMatrix();
      return (obj.points || []).map((p) => {
        const transformed = util.transformPoint(
          new Point(
            p.x - (obj.pathOffset?.x || 0),
            p.y - (obj.pathOffset?.y || 0)
          ),
          matrix
        );
        return [transformed.x, transformed.y] as [number, number];
      });
    } else if (obj instanceof Rect) {
      const left = obj.left || 0;
      const top = obj.top || 0;
      const w = (obj.width || 0) * (obj.scaleX || 1);
      const h = (obj.height || 0) * (obj.scaleY || 1);
      return [
        [left, top],
        [left + w, top],
        [left + w, top + h],
        [left, top + h],
      ];
    }
    return [];
  }

  // Sync canvas zones to SeatingConfig
  const syncConfig = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const currentZones = zonesRef.current;
    const objects = canvas.getObjects();

    if (mode === "zone") {
      // Build multi-polygon zone definitions
      const zonePolygonsMap = new Map<string, ZonePolygon[]>();

      for (const obj of objects) {
        const d = getObjData(obj);
        if (!d?.zoneId || !d?.polygonId) continue;
        if (d.isSeatLabel || d.seatId) continue;

        const points = extractPoints(obj);
        if (points.length < 3) continue;

        if (!zonePolygonsMap.has(d.zoneId)) {
          zonePolygonsMap.set(d.zoneId, []);
        }

        // Find seats for this polygon from zone state
        const zone = currentZones.find((z) => z.id === d.zoneId);
        const polygonSeats = zone?.polygons.find((p) => p.id === d.polygonId)?.seats || [];

        zonePolygonsMap.get(d.zoneId)!.push({
          id: d.polygonId,
          points,
          seats: polygonSeats.length > 0 ? polygonSeats : undefined,
        });
      }

      const zoneDefs: ZoneDefinition[] = currentZones
        .filter((z) => zonePolygonsMap.has(z.id))
        .map((z) => {
          const tiers: ZoneTier[] = z.tiers.map((t) => ({
            id: t.id,
            name: t.name,
            price: t.price,
            initial_quantity: t.initial_quantity,
            max_per_order: t.max_per_order,
            description: t.description,
            currency: t.currency,
          }));
          // Use first tier as legacy fallback fields
          const firstTier = z.tiers[0];
          return {
            id: z.id,
            tier_id: firstTier?.id ?? z.id,
            name: z.name,
            color: z.color,
            polygons: zonePolygonsMap.get(z.id) || [],
            tiers,
            price: firstTier?.price ?? 0,
            initial_quantity: z.tiers.reduce((sum, t) => sum + t.initial_quantity, 0),
            max_per_order: firstTier?.max_per_order ?? 10,
            description: firstTier?.description ?? "",
            currency: firstTier?.currency ?? "cad",
          };
        });

      onChange({
        image_url: imageUrl,
        image_width: imageWidth,
        image_height: imageHeight,
        view_mode: "image_overlay",
        map_sub_mode: mapSubMode,
        zones: zoneDefs,
      });
    } else {
      // Seat mode — use sections (backward compatible flat format)
      const sectionDefs: SectionDefinition[] = [];

      for (const obj of objects) {
        const d = getObjData(obj);
        if (!d?.zoneId || d.seatId || d.isSeatLabel) continue;
        if (!d.polygonId) continue;

        const zone = currentZones.find((z) => z.id === d.zoneId);
        if (!zone) continue;

        const points = extractPoints(obj);
        if (points.length < 3) continue;

        sectionDefs.push({
          id: zone.id,
          tier_id: "",
          name: zone.name,
          color: zone.color,
          points,
          seats: zone.seats,
        });
      }

      onChange({
        image_url: imageUrl,
        image_width: imageWidth,
        image_height: imageHeight,
        view_mode: "image_overlay",
        sections: sectionDefs,
      });
    }
  }, [imageUrl, imageWidth, imageHeight, mode, mapSubMode, onChange]);

  // Listen for object modifications to sync config
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleModified = () => syncConfig();
    canvas.on("object:modified", handleModified);

    return () => {
      canvas.off("object:modified", handleModified);
    };
  }, [syncConfig]);

  // Handle tool changes - update canvas cursor and selection mode
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.selection = activeTool === "select";
    canvas.forEachObject((obj) => {
      const d = getObjData(obj);
      if (d?.zoneId && !d.seatId && !d.isSeatLabel) {
        obj.selectable = activeTool === "select";
        obj.evented = activeTool === "select";
      }
    });
    canvas.defaultCursor =
      activeTool === "polygon" ||
      activeTool === "rectangle" ||
      activeTool === "seat-place"
        ? "crosshair"
        : activeTool === "pan"
          ? "grab"
          : "default";
    canvas.renderAll();
  }, [activeTool]);

  // Rectangle tool: click to place
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || activeTool !== "rectangle") return;

    const handleMouseDown = (e: TPointerEventInfo) => {
      const pointer = e.scenePoint;
      addShape(canvas, "rectangle", pointer.x, pointer.y);
    };

    canvas.on("mouse:down", handleMouseDown);
    return () => {
      canvas.off("mouse:down", handleMouseDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, addingToZoneId]);

  // Polygon tool: click to add points, double-click to close
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || activeTool !== "polygon") return;

    let localPoints: Point[] = [];
    const localDots: Circle[] = [];

    const handleClick = (e: TPointerEventInfo) => {
      const pointer = e.scenePoint;
      localPoints.push(new Point(pointer.x, pointer.y));

      const dot = new Circle({
        left: pointer.x - 4,
        top: pointer.y - 4,
        radius: 4,
        fill: "#3b82f6",
        selectable: false,
        evented: false,
      });
      canvas.add(dot);
      localDots.push(dot);
      canvas.renderAll();
    };

    const handleDblClick = () => {
      if (localPoints.length < 3) return;

      // Remove temp dots
      localDots.forEach((d) => canvas.remove(d));
      localDots.length = 0;

      const polygonId = crypto.randomUUID();

      const polygon = new Polygon(
        localPoints.map((p) => ({ x: p.x, y: p.y })),
        {
          fill: "",
          stroke: "",
          strokeWidth: 2,
        }
      );

      if (addingToZoneId) {
        // Add polygon to existing zone
        const existingZone = zonesRef.current.find((z) => z.id === addingToZoneId);
        if (existingZone) {
          polygon.set({
            fill: existingZone.color + "40",
            stroke: existingZone.color,
          });
          setObjData(polygon, { zoneId: addingToZoneId, polygonId });

          canvas.add(polygon);
          canvas.setActiveObject(polygon);
          canvas.renderAll();

          setZones((prev) =>
            prev.map((z) =>
              z.id === addingToZoneId
                ? { ...z, polygons: [...z.polygons, { id: polygonId, seats: [] }] }
                : z
            )
          );
          setSelectedZoneId(addingToZoneId);
        }
      } else {
        // Create new zone
        zoneCounterRef.current += 1;
        const id = crypto.randomUUID();
        const usedColors = zonesRef.current.map((z) => z.color);
        const color = getNextAvailableColor(usedColors);

        polygon.set({
          fill: color + "40",
          stroke: color,
        });
        setObjData(polygon, { zoneId: id, polygonId });

        canvas.add(polygon);
        canvas.setActiveObject(polygon);
        canvas.renderAll();

        const newZone: ZoneState = {
          id,
          name: `Zone ${zoneCounterRef.current}`,
          color,
          polygons: [{ id: polygonId, seats: [] }],
          seats: [],
          tiers: [{
            id: crypto.randomUUID(),
            name: "General",
            price: 0,
            initial_quantity: 100,
            max_per_order: 10,
            description: "",
            currency,
          }],
        };

        setZones((prev) => [...prev, newZone]);
        setSelectedZoneId(id);
      }

      localPoints = [];
      setActiveTool("select");
      syncConfig();
    };

    canvas.on("mouse:down", handleClick);
    canvas.on("mouse:dblclick", handleDblClick);

    return () => {
      canvas.off("mouse:down", handleClick);
      canvas.off("mouse:dblclick", handleDblClick);
      localDots.forEach((d) => canvas.remove(d));
      localDots.length = 0;
      canvas.renderAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, addingToZoneId]);

  // Pan tool
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || activeTool !== "pan") return;

    let isPanning = false;
    let lastPos = { x: 0, y: 0 };

    const handleDown = (e: TPointerEventInfo) => {
      isPanning = true;
      lastPos = { x: e.viewportPoint.x, y: e.viewportPoint.y };
      canvas.defaultCursor = "grabbing";
    };

    const handleMove = (e: TPointerEventInfo) => {
      if (!isPanning) return;
      const vpt = canvas.viewportTransform;
      if (!vpt) return;
      vpt[4] += e.viewportPoint.x - lastPos.x;
      vpt[5] += e.viewportPoint.y - lastPos.y;
      lastPos = { x: e.viewportPoint.x, y: e.viewportPoint.y };
      canvas.requestRenderAll();
    };

    const handleUp = () => {
      isPanning = false;
      canvas.defaultCursor = "grab";
    };

    canvas.on("mouse:down", handleDown);
    canvas.on("mouse:move", handleMove);
    canvas.on("mouse:up", handleUp);

    return () => {
      canvas.off("mouse:down", handleDown);
      canvas.off("mouse:move", handleMove);
      canvas.off("mouse:up", handleUp);
    };
  }, [activeTool]);

  function addShape(canvas: Canvas, shape: "rectangle", x: number, y: number) {
    const polygonId = crypto.randomUUID();

    const rect = new Rect({
      left: x - 60,
      top: y - 40,
      width: 120,
      height: 80,
      fill: "",
      stroke: "",
      strokeWidth: 2,
    });

    if (addingToZoneId) {
      const existingZone = zonesRef.current.find((z) => z.id === addingToZoneId);
      if (existingZone) {
        rect.set({
          fill: existingZone.color + "40",
          stroke: existingZone.color,
        });
        setObjData(rect, { zoneId: addingToZoneId, polygonId });

        canvas.add(rect);
        canvas.setActiveObject(rect);
        canvas.renderAll();

        setZones((prev) =>
          prev.map((z) =>
            z.id === addingToZoneId
              ? { ...z, polygons: [...z.polygons, { id: polygonId, seats: [] }] }
              : z
          )
        );
        setSelectedZoneId(addingToZoneId);
      }
    } else {
      zoneCounterRef.current += 1;
      const id = crypto.randomUUID();
      const usedColors = zonesRef.current.map((z) => z.color);
      const color = getNextAvailableColor(usedColors);

      rect.set({
        fill: color + "40",
        stroke: color,
      });
      setObjData(rect, { zoneId: id, polygonId });

      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();

      const newZone: ZoneState = {
        id,
        name: `Zone ${zoneCounterRef.current}`,
        color,
        polygons: [{ id: polygonId, seats: [] }],
        seats: [],
        tiers: [{
          id: crypto.randomUUID(),
          name: "General",
          price: 0,
          initial_quantity: 100,
          max_per_order: 10,
          description: "",
          currency,
        }],
      };

      setZones((prev) => [...prev, newZone]);
      setSelectedZoneId(id);
    }

    setActiveTool("select");
    syncConfig();
  }

  function handleUpdateZone(id: string, updates: Record<string, unknown>) {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, ...updates } : z))
    );

    // If color changed, update canvas objects
    if (updates.color) {
      const canvas = fabricRef.current;
      if (canvas) {
        const newColor = updates.color as string;
        canvas.forEachObject((obj) => {
          const d = getObjData(obj);
          if (d?.zoneId === id && !d.seatId && !d.isSeatLabel) {
            obj.set({ fill: newColor + "40", stroke: newColor });
          }
        });
        canvas.renderAll();
      }
    }

    syncConfig();
  }

  function handleAddZoneTier(zoneId: string) {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== zoneId) return z;
        const newTier: ZoneTierState = {
          id: crypto.randomUUID(),
          name: "",
          price: 0,
          initial_quantity: 50,
          max_per_order: 10,
          description: "",
          currency: z.tiers[0]?.currency || currency,
        };
        return { ...z, tiers: [...z.tiers, newTier] };
      })
    );
    syncConfig();
  }

  function handleRemoveZoneTier(zoneId: string, tierId: string) {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== zoneId) return z;
        if (z.tiers.length <= 1) return z; // always keep at least one
        return { ...z, tiers: z.tiers.filter((t) => t.id !== tierId) };
      })
    );
    syncConfig();
  }

  function handleUpdateZoneTier(zoneId: string, tierId: string, updates: Record<string, string | number>) {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== zoneId) return z;
        return {
          ...z,
          tiers: z.tiers.map((t) =>
            t.id === tierId ? { ...t, ...updates } : t
          ),
        };
      })
    );
    syncConfig();
  }

  function handleDeleteSelected() {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const active = canvas.getActiveObject();
    if (!active) return;
    const d = getObjData(active);
    if (!d?.zoneId) return;

    const zoneId = d.zoneId;
    const polygonId = d.polygonId;

    // Check how many polygons the zone has
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;

    if (zone.polygons.length <= 1) {
      // Deleting last polygon — remove the whole zone
      const toRemove = canvas.getObjects().filter((obj) => {
        const od = getObjData(obj);
        return od?.zoneId === zoneId || od?.sectionId === zoneId;
      });
      toRemove.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.renderAll();

      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      setSelectedZoneId(null);
    } else {
      // Remove just this polygon from the zone
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();

      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? {
                ...z,
                polygons: z.polygons.filter((p) => p.id !== polygonId),
              }
            : z
        )
      );
    }

    syncConfig();
  }

  function handleGenerateGrid(rows: number, cols: number, prefix: string) {
    if (!selectedZoneId) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Find the zone's fabric objects to get bounding box (use first polygon)
    const allObjs = canvas.getObjects();
    const zoneObj = allObjs.find((obj) => {
      const d = getObjData(obj);
      return d?.zoneId === selectedZoneId && !d.seatId && !d.isSeatLabel;
    });
    if (!zoneObj) return;

    // Remove existing seat circles and labels for this section
    const existingSeats = allObjs.filter((obj) => {
      const od = getObjData(obj);
      return od?.sectionId === selectedZoneId;
    });
    existingSeats.forEach((obj) => canvas.remove(obj));

    // Get bounding box
    const bound = zoneObj.getBoundingRect();
    const padX = 15;
    const padY = 15;
    const innerW = bound.width - padX * 2;
    const innerH = bound.height - padY * 2;

    const seats: SeatDefinition[] = [];
    const spacingX = cols > 1 ? innerW / (cols - 1) : 0;
    const spacingY = rows > 1 ? innerH / (rows - 1) : 0;

    const zone = zones.find((z) => z.id === selectedZoneId);
    const color = zone?.color || "#3b82f6";

    for (let r = 0; r < rows; r++) {
      const rowLetter = prefix || String.fromCharCode(65 + (r % 26));
      for (let c = 0; c < cols; c++) {
        const seatId = crypto.randomUUID();
        const label = `${rowLetter}${c + 1}`;
        const x =
          bound.left + padX + (cols > 1 ? c * spacingX : innerW / 2);
        const y =
          bound.top + padY + (rows > 1 ? r * spacingY : innerH / 2);

        seats.push({ id: seatId, label, x, y });

        // Seat circle
        const circle = new Circle({
          left: x - 6,
          top: y - 6,
          radius: 6,
          fill: color,
          stroke: "#fff",
          strokeWidth: 1,
          selectable: false,
          evented: false,
        });
        setObjData(circle, {
          seatId,
          sectionId: selectedZoneId,
          label,
        });
        canvas.add(circle);

        // Seat label text
        const seatLabel = new FabricText(label, {
          left: x,
          top: y,
          fontSize: 7,
          fontFamily: "system-ui, sans-serif",
          fill: "#ffffff",
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
        });
        setObjData(seatLabel, {
          sectionId: selectedZoneId,
          isSeatLabel: true,
        });
        canvas.add(seatLabel);
      }
    }

    canvas.renderAll();

    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== selectedZoneId) return z;
        // Store seats in the first polygon
        const updatedPolygons = z.polygons.map((p, i) =>
          i === 0 ? { ...p, seats } : p
        );
        // Distribute seat count across tiers (set total on first tier if single tier)
        const updatedTiers = z.tiers.length === 1
          ? z.tiers.map((t) => ({ ...t, initial_quantity: seats.length }))
          : z.tiers;
        return { ...z, seats, polygons: updatedPolygons, tiers: updatedTiers };
      })
    );
    syncConfig();
  }

  function handleZoomIn() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const zoom = Math.min(canvas.getZoom() * 1.2, 5);
    canvas.zoomToPoint(
      new Point(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      zoom
    );
  }

  function handleZoomOut() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const zoom = Math.max(canvas.getZoom() / 1.2, 0.3);
    canvas.zoomToPoint(
      new Point(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2),
      zoom
    );
  }

  function handleResetView() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  }

  function handleStartAddingToZone(zoneId: string) {
    setAddingToZoneId(zoneId);
    setSelectedZoneId(zoneId);
  }

  function handleStopAddingToZone() {
    setAddingToZoneId(null);
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onDeleteSelected={handleDeleteSelected}
        hasSelection={selectedZoneId !== null}
        addingToZoneName={
          addingToZoneId
            ? zones.find((z) => z.id === addingToZoneId)?.name
            : undefined
        }
        onCancelAddToZone={handleStopAddingToZone}
      />

      <div className="flex">
        <div className="flex-1 overflow-auto">
          <canvas ref={canvasRef} />
        </div>

        <div className="w-64 border-l overflow-y-auto max-h-[600px]">
          <ZonePropertiesPanel
            selectedZoneId={selectedZoneId}
            zones={zones}
            usedColors={zones.map((z) => z.color)}
            onUpdateZone={handleUpdateZone}
            onAddZoneTier={handleAddZoneTier}
            onRemoveZoneTier={handleRemoveZoneTier}
            onUpdateZoneTier={handleUpdateZoneTier}
            seatMode={showSeatPlacer}
          />

          {(mode === "seat" || showSeatPlacer) && selectedZoneId && selectedZone && (
            <SeatPlacer
              sectionId={selectedZoneId}
              seats={selectedZone.seats}
              onGenerateGrid={handleGenerateGrid}
            />
          )}

          {zones.length > 0 && (
            <div className="p-4 border-t">
              <h3 className="font-medium text-sm mb-2">
                All {mode === "zone" ? "Zones" : "Sections"} (
                {zones.length})
              </h3>
              <div className="space-y-1">
                {zones.map((z) => (
                  <div key={z.id} className="flex items-center gap-1">
                    <button
                      className={`flex-1 text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 ${
                        selectedZoneId === z.id
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      }`}
                      onClick={() => {
                        setSelectedZoneId(z.id);
                        setAddingToZoneId(null);
                        const canvas = fabricRef.current;
                        if (!canvas) return;
                        // Select the first polygon of this zone
                        canvas.forEachObject((obj) => {
                          const d = getObjData(obj);
                          if (d?.zoneId === z.id && !d.seatId && !d.isSeatLabel) {
                            canvas.setActiveObject(obj);
                            canvas.renderAll();
                            return;
                          }
                        });
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: z.color }}
                      />
                      <span className="truncate">{z.name}</span>
                      {z.polygons.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          ({z.polygons.length})
                        </span>
                      )}
                      {z.tiers.length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {z.tiers.length}T
                        </span>
                      )}
                      {(mode === "seat" || showSeatPlacer) && z.seats.length > 0 && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {z.seats.length} seats
                        </span>
                      )}
                    </button>
                    {mode === "zone" && (
                      <button
                        title="Add polygon to this zone"
                        className={`shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs ${
                          addingToZoneId === z.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent text-muted-foreground"
                        }`}
                        onClick={() => {
                          if (addingToZoneId === z.id) {
                            handleStopAddingToZone();
                          } else {
                            handleStartAddingToZone(z.id);
                          }
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
