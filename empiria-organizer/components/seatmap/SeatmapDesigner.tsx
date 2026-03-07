"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Canvas,
  Polygon,
  Rect,
  Circle,
  FabricImage,
  FabricObject,
  Point,
  util,
  type TPointerEventInfo,
} from "fabric";
import { Toolbar } from "./Toolbar";
import { ZonePropertiesPanel } from "./ZonePropertiesPanel";
import { SeatPlacer } from "./SeatPlacer";
import type { DrawingTool } from "./types";
import type {
  SeatingConfig,
  ZoneDefinition,
  SectionDefinition,
  SeatDefinition,
} from "@/lib/seatmap-types";

// Fabric.js v6 supports a `data` property at runtime but doesn't include it in TS types.
interface ObjData {
  zoneId?: string;
  seatId?: string;
  sectionId?: string;
  label?: string;
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
}

interface ZoneState {
  id: string;
  name: string;
  color: string;
  seats: SeatDefinition[];
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const ZONE_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
];

export function SeatmapDesigner({
  mode,
  imageUrl,
  imageWidth,
  imageHeight,
  initialConfig,
  onChange,
}: SeatmapDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [zones, setZones] = useState<ZoneState[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
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

  // Sync canvas zones to SeatingConfig
  const syncConfig = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const currentZones = zonesRef.current;
    const objects = canvas.getObjects();
    const zoneDefs: ZoneDefinition[] = [];
    const sectionDefs: SectionDefinition[] = [];

    for (const obj of objects) {
      const d = getObjData(obj);
      if (!d?.zoneId) continue;
      const zone = currentZones.find((z) => z.id === d.zoneId);
      if (!zone) continue;

      let points: [number, number][] = [];

      if (obj instanceof Polygon) {
        const matrix = obj.calcTransformMatrix();
        points = (obj.points || []).map((p) => {
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
        points = [
          [left, top],
          [left + w, top],
          [left + w, top + h],
          [left, top + h],
        ];
      }

      if (mode === "zone") {
        zoneDefs.push({
          id: zone.id,
          tier_id: "",
          name: zone.name,
          color: zone.color,
          points,
        });
      } else {
        sectionDefs.push({
          id: zone.id,
          tier_id: "",
          name: zone.name,
          color: zone.color,
          points,
          seats: zone.seats,
        });
      }
    }

    const config: SeatingConfig = {
      image_url: imageUrl,
      image_width: imageWidth,
      image_height: imageHeight,
      view_mode: "image_overlay",
      zones: mode === "zone" ? zoneDefs : undefined,
      sections: mode === "seat" ? sectionDefs : undefined,
    };

    onChange(config);
  }, [imageUrl, imageWidth, imageHeight, mode, onChange]);

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
      if (d?.zoneId) {
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
      addRectangleZone(canvas, pointer.x, pointer.y);
    };

    canvas.on("mouse:down", handleMouseDown);
    return () => {
      canvas.off("mouse:down", handleMouseDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

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

      zoneCounterRef.current += 1;
      const id = crypto.randomUUID();
      const color =
        ZONE_COLORS[zoneCounterRef.current % ZONE_COLORS.length];

      const polygon = new Polygon(
        localPoints.map((p) => ({ x: p.x, y: p.y })),
        {
          fill: color + "40",
          stroke: color,
          strokeWidth: 2,
        }
      );
      setObjData(polygon, { zoneId: id });

      canvas.add(polygon);
      canvas.setActiveObject(polygon);
      canvas.renderAll();

      const newZone: ZoneState = {
        id,
        name: `Zone ${zoneCounterRef.current}`,
        color,
        seats: [],
      };

      setZones((prev) => [...prev, newZone]);
      setSelectedZoneId(id);
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
  }, [activeTool]);

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

  function addRectangleZone(canvas: Canvas, x: number, y: number) {
    zoneCounterRef.current += 1;
    const id = crypto.randomUUID();
    const color = ZONE_COLORS[zoneCounterRef.current % ZONE_COLORS.length];

    const rect = new Rect({
      left: x - 60,
      top: y - 40,
      width: 120,
      height: 80,
      fill: color + "40",
      stroke: color,
      strokeWidth: 2,
    });
    setObjData(rect, { zoneId: id });

    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.renderAll();

    const newZone: ZoneState = {
      id,
      name: `Zone ${zoneCounterRef.current}`,
      color,
      seats: [],
    };

    setZones((prev) => [...prev, newZone]);
    setSelectedZoneId(id);
    setActiveTool("select");
    syncConfig();
  }

  function handleUpdateZone(id: string, name: string, color: string) {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, name, color } : z))
    );

    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.forEachObject((obj) => {
      const d = getObjData(obj);
      if (d?.zoneId === id) {
        obj.set({ fill: color + "40", stroke: color });
      }
    });
    canvas.renderAll();
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

    // Also remove any seat circles belonging to this zone
    const toRemove = canvas.getObjects().filter((obj) => {
      const od = getObjData(obj);
      return od?.zoneId === zoneId || od?.sectionId === zoneId;
    });
    toRemove.forEach((obj) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();

    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    setSelectedZoneId(null);
    syncConfig();
  }

  function handleGenerateGrid(rows: number, cols: number, prefix: string) {
    if (!selectedZoneId) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Find the zone's fabric object to get its bounding box
    const allObjs = canvas.getObjects();
    const zoneObj = allObjs.find((obj) => {
      const d = getObjData(obj);
      return d?.zoneId === selectedZoneId;
    });
    if (!zoneObj) return;

    // Remove existing seat circles for this section
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
      }
    }

    canvas.renderAll();

    setZones((prev) =>
      prev.map((z) =>
        z.id === selectedZoneId ? { ...z, seats } : z
      )
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
      />

      <div className="flex">
        <div className="flex-1 overflow-auto">
          <canvas ref={canvasRef} />
        </div>

        <div className="w-64 border-l overflow-y-auto max-h-[600px]">
          <ZonePropertiesPanel
            selectedZoneId={selectedZoneId}
            zones={zones}
            onUpdateZone={handleUpdateZone}
          />

          {mode === "seat" && selectedZoneId && selectedZone && (
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
                  <button
                    key={z.id}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded flex items-center gap-2 ${
                      selectedZoneId === z.id
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                    onClick={() => {
                      setSelectedZoneId(z.id);
                      const canvas = fabricRef.current;
                      if (!canvas) return;
                      canvas.forEachObject((obj) => {
                        const d = getObjData(obj);
                        if (d?.zoneId === z.id) {
                          canvas.setActiveObject(obj);
                          canvas.renderAll();
                        }
                      });
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: z.color }}
                    />
                    <span className="truncate">{z.name}</span>
                    {mode === "seat" && z.seats.length > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {z.seats.length} seats
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
