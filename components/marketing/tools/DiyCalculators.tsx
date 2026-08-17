"use client";

import { useMemo, useState } from "react";
import {
  NumberField,
  ToolPanel,
  ToolResultRow,
} from "@/components/marketing/tools/ToolShell";

type Tab = "concrete" | "tiles" | "paint";

export default function DiyCalculators() {
  const [tab, setTab] = useState<Tab>("concrete");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["concrete", "Concrete volume"],
            ["tiles", "Tile boxes"],
            ["paint", "Paint litres"],
          ] as const
        ).map(([key, label]) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "px-4 py-2.5 font-sans text-[14px] font-bold border transition-colors",
                on
                  ? "bg-[#071018] text-white border-[#071018]"
                  : "bg-white text-[#071018] border-[#e4e8ec] hover:border-[#071018]",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "concrete" ? <ConcreteCalc /> : null}
      {tab === "tiles" ? <TileCalc /> : null}
      {tab === "paint" ? <PaintCalc /> : null}
    </div>
  );
}

function ConcreteCalc() {
  const [length, setLength] = useState(6);
  const [width, setWidth] = useState(3);
  const [depthMm, setDepthMm] = useState(100);

  const m3 = useMemo(() => {
    const depthM = Math.max(depthMm, 0) / 1000;
    return Math.max(length, 0) * Math.max(width, 0) * depthM;
  }, [length, width, depthMm]);

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6">
        <ToolPanel title="Slab or path size">
          <div className="grid sm:grid-cols-3 gap-x-4">
            <NumberField label="Length" value={length} onChange={setLength} suffix="m" min={0} step={0.1} />
            <NumberField label="Width" value={width} onChange={setWidth} suffix="m" min={0} step={0.1} />
            <NumberField label="Depth" value={depthMm} onChange={setDepthMm} suffix="mm" min={0} step={5} />
          </div>
        </ToolPanel>
      </div>
      <div className="lg:col-span-6">
        <ToolPanel title="Concrete needed">
          <dl>
            <ToolResultRow label="Volume" value={`${m3.toFixed(2)} m³`} highlight />
            <ToolResultRow
              label="Order with 10% waste"
              value={`${(m3 * 1.1).toFixed(2)} m³`}
            />
          </dl>
        </ToolPanel>
      </div>
    </div>
  );
}

function TileCalc() {
  const [roomL, setRoomL] = useState(3.2);
  const [roomW, setRoomW] = useState(2.4);
  const [tileMm, setTileMm] = useState(300);
  const [boxCoverage, setBoxCoverage] = useState(1.44);

  const result = useMemo(() => {
    const area = Math.max(roomL, 0) * Math.max(roomW, 0);
    const withWaste = area * 1.1;
    const tileM = Math.max(tileMm, 1) / 1000;
    const tilesNeeded = tileM > 0 ? withWaste / (tileM * tileM) : 0;
    const boxes = boxCoverage > 0 ? withWaste / boxCoverage : 0;
    return { area, withWaste, tilesNeeded, boxes };
  }, [roomL, roomW, tileMm, boxCoverage]);

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6">
        <ToolPanel title="Floor and tile">
          <div className="grid sm:grid-cols-2 gap-x-4">
            <NumberField label="Room length" value={roomL} onChange={setRoomL} suffix="m" min={0} step={0.1} />
            <NumberField label="Room width" value={roomW} onChange={setRoomW} suffix="m" min={0} step={0.1} />
            <NumberField label="Tile size" value={tileMm} onChange={setTileMm} suffix="mm" min={50} step={10} />
            <NumberField label="Coverage per box" value={boxCoverage} onChange={setBoxCoverage} suffix="m²" min={0.1} step={0.01} />
          </div>
        </ToolPanel>
      </div>
      <div className="lg:col-span-6">
        <ToolPanel title="Tiles to buy">
          <dl>
            <ToolResultRow label="Floor area" value={`${result.area.toFixed(2)} m²`} />
            <ToolResultRow label="With 10% wastage" value={`${result.withWaste.toFixed(2)} m²`} />
            <ToolResultRow label="Approx tiles" value={`${Math.ceil(result.tilesNeeded)}`} />
            <ToolResultRow label="Boxes to buy" value={`${Math.ceil(result.boxes)}`} highlight />
          </dl>
        </ToolPanel>
      </div>
    </div>
  );
}

function PaintCalc() {
  const [wallH, setWallH] = useState(2.7);
  const [wallL, setWallL] = useState(14);
  const [coats, setCoats] = useState(2);
  const [coverage, setCoverage] = useState(14);

  const result = useMemo(() => {
    const area = Math.max(wallH, 0) * Math.max(wallL, 0) * Math.max(coats, 1);
    const litres = coverage > 0 ? area / coverage : 0;
    return { area, litres };
  }, [wallH, wallL, coats, coverage]);

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6">
        <ToolPanel title="Walls">
          <div className="grid sm:grid-cols-2 gap-x-4">
            <NumberField label="Wall height" value={wallH} onChange={setWallH} suffix="m" min={0} step={0.1} />
            <NumberField label="Total wall length" value={wallL} onChange={setWallL} suffix="m" min={0} step={0.1} />
            <NumberField label="Coats" value={coats} onChange={setCoats} min={1} step={1} />
            <NumberField label="Coverage" value={coverage} onChange={setCoverage} suffix="m²/L" min={1} step={0.5} />
          </div>
          <p className="font-sans text-[13px] text-[#5a6a78]">
            Add up the length of every wall you are painting. Doors and windows usually offset a bit of waste.
          </p>
        </ToolPanel>
      </div>
      <div className="lg:col-span-6">
        <ToolPanel title="Paint needed">
          <dl>
            <ToolResultRow label="Paintable area (all coats)" value={`${result.area.toFixed(1)} m²`} />
            <ToolResultRow label="Litres to buy" value={`${Math.ceil(result.litres)} L`} highlight />
          </dl>
        </ToolPanel>
      </div>
    </div>
  );
}
