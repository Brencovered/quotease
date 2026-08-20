"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  NumberField,
  SourceInline,
  ToolPanel,
  ToolResultRow,
} from "@/components/marketing/tools/ToolShell";

type Tab = "concrete" | "tiles" | "paint";

/** Standard AU 20 kg pre-mix yield (~0.009 m³ ≈ 108 bags per m³). */
const PREMIX_BAG_M3 = 0.009;
const PREMIX_BAG_KG = 20;
/** Wet concrete density used for DIY effort messaging. */
const CONCRETE_KG_PER_M3 = 2400;
/** Default paint coverage mid of 14-16 m²/L per coat. */
const DEFAULT_COVERAGE = 15;
const DOOR_M2 = 2;
const WINDOW_M2 = 1.5;
/** Cementitious grout bulk density (kg/m³). */
const GROUT_DENSITY = 1600;
/** Industry tile waste buffer (10%-15%; default mid-high). */
const TILE_WASTE = 1.15;

export default function DiyCalculators() {
  const [tab, setTab] = useState<Tab>("concrete");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["concrete", "Concrete volume"],
            ["paint", "Paint coverage"],
            ["tiles", "Tile & grout"],
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
      {tab === "paint" ? <PaintCalc /> : null}
      {tab === "tiles" ? <TileCalc /> : null}
    </div>
  );
}

function EffortHook({
  effort,
  cta,
  href,
}: {
  effort: string;
  cta: string;
  href: string;
}) {
  return (
    <aside className="mt-5 border-l-2 border-[#ffb400] pl-4">
      <p className="font-sans text-[14px] leading-[1.65] text-[#3d4a55] mb-3">{effort}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 font-sans text-[13.5px] font-extrabold text-[#071018] hover:text-[#b88400] transition-colors"
      >
        {cta} <ArrowRight size={14} aria-hidden />
      </Link>
    </aside>
  );
}

function ConcreteCalc() {
  const [length, setLength] = useState(6);
  const [width, setWidth] = useState(3);
  const [depthMm, setDepthMm] = useState(100);

  const result = useMemo(() => {
    const depthM = Math.max(depthMm, 0) / 1000;
    const volume = Math.max(length, 0) * Math.max(width, 0) * depthM;
    const withWaste = volume * 1.1;
    const bags = withWaste > 0 ? Math.ceil(withWaste / PREMIX_BAG_M3) : 0;
    const weightKg = withWaste * CONCRETE_KG_PER_M3;
    const bagWeightKg = bags * PREMIX_BAG_KG;
    return { volume, withWaste, bags, weightKg, bagWeightKg };
  }, [length, width, depthMm]);

  const heavy = result.weightKg >= 200;

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6">
        <ToolPanel title="Slab or path size">
          <div className="grid sm:grid-cols-3 gap-x-4">
            <NumberField label="Length" value={length} onChange={setLength} suffix="m" min={0} step={0.1} />
            <NumberField label="Width" value={width} onChange={setWidth} suffix="m" min={0} step={0.1} />
            <NumberField label="Depth" value={depthMm} onChange={setDepthMm} suffix="mm" min={0} step={5} />
          </div>
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78]">
            Guideline only. Includes an automatic 10% wastage buffer. Formulas follow the{" "}
            <SourceInline href="https://builtsimple.com.au/calculator/concrete-bags/">
              Built Simple Concrete Bag Calculator
            </SourceInline>{" "}
            (20 kg bag ≈ 0.009 m³, ~108 bags per m³).
          </p>
        </ToolPanel>
      </div>
      <div className="lg:col-span-6">
        <ToolPanel title="Concrete needed">
          <dl>
            <ToolResultRow label="Net volume" value={`${result.volume.toFixed(2)} m³`} />
            <ToolResultRow
              label="Order with 10% waste"
              value={`${result.withWaste.toFixed(2)} m³`}
              highlight
            />
            <ToolResultRow
              label="20 kg premix bags"
              value={`${result.bags}`}
              hint="≈ 0.009 m³ yield per bag (~108 bags / m³)"
            />
            <ToolResultRow
              label="Estimated wet weight"
              value={`${Math.round(result.weightKg).toLocaleString("en-AU")} kg`}
            />
          </dl>
          {heavy ? (
            <EffortHook
              effort={`This project needs about ${Math.round(result.weightKg).toLocaleString("en-AU")} kg of concrete (roughly ${result.bags} × 20 kg bags). Prefer to pass on the heavy lifting?`}
              cta="Find a local concreter in your suburb"
              href="/directory?trade=Concreter"
            />
          ) : (
            <EffortHook
              effort="Small pours are DIY-friendly. Larger slabs, mesh, and falls are usually faster with a concreter."
              cta="Browse concreters near you"
              href="/directory?trade=Concreter"
            />
          )}
        </ToolPanel>
      </div>
    </div>
  );
}

function PaintCalc() {
  const [wallL, setWallL] = useState(14);
  const [wallH, setWallH] = useState(2.7);
  const [doors, setDoors] = useState(2);
  const [windows, setWindows] = useState(3);
  const [coverage, setCoverage] = useState(DEFAULT_COVERAGE);

  const result = useMemo(() => {
    const gross = Math.max(wallL, 0) * Math.max(wallH, 0);
    const openings =
      Math.max(doors, 0) * DOOR_M2 + Math.max(windows, 0) * WINDOW_M2;
    const wallArea = Math.max(gross - openings, 0);
    const cov = Math.min(Math.max(coverage, 10), 18);
    const primerL = wallArea / cov;
    const topcoatL = (wallArea * 2) / cov;
    const totalL = primerL + topcoatL;
    return { wallArea, primerL, topcoatL, totalL, cov };
  }, [wallL, wallH, doors, windows, coverage]);

  const bigJob = result.totalL >= 20;

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6">
        <ToolPanel title="Walls and openings">
          <div className="grid sm:grid-cols-2 gap-x-4">
            <NumberField
              label="Total wall length"
              value={wallL}
              onChange={setWallL}
              suffix="m"
              min={0}
              step={0.1}
            />
            <NumberField
              label="Ceiling height"
              value={wallH}
              onChange={setWallH}
              suffix="m"
              min={0}
              step={0.1}
            />
            <NumberField label="Doors" value={doors} onChange={setDoors} min={0} step={1} />
            <NumberField label="Windows" value={windows} onChange={setWindows} min={0} step={1} />
            <NumberField
              label="Coverage rate"
              value={coverage}
              onChange={setCoverage}
              suffix="m²/L"
              min={10}
              step={0.5}
            />
          </div>
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78]">
            Guideline only. Australian interior acrylics often cover about 14-16 m²/L per coat - see the{" "}
            <SourceInline href="https://www.dulux.com.au/paint/wash-and-wear/">
              Dulux Wash&Wear coverage guide
            </SourceInline>{" "}
            and{" "}
            <SourceInline href="https://builtsimple.com.au/calculator/paint/">
              Built Simple Paint Calculator
            </SourceInline>
            . Doors count as ~{DOOR_M2} m² and windows ~{WINDOW_M2} m² each. Primer plus two topcoats is
            assumed.
          </p>
        </ToolPanel>
      </div>
      <div className="lg:col-span-6">
        <ToolPanel title="Paint needed">
          <dl>
            <ToolResultRow label="Paintable wall area" value={`${result.wallArea.toFixed(1)} m²`} />
            <ToolResultRow label="Primer" value={`${Math.ceil(result.primerL)} L`} />
            <ToolResultRow
              label="Topcoat (2 coats)"
              value={`${Math.ceil(result.topcoatL)} L`}
            />
            <ToolResultRow
              label="Total to buy"
              value={`${Math.ceil(result.totalL)} L`}
              highlight
              hint={`At ${result.cov} m²/L coverage`}
            />
          </dl>
          {bigJob ? (
            <EffortHook
              effort={`You are looking at roughly ${Math.ceil(result.totalL)} litres of paint across primer and two topcoats - plus masking, cutting-in, and ladder time. Prefer a pro finish?`}
              cta="Find a local painter in your suburb"
              href="/directory?trade=Painter"
            />
          ) : (
            <EffortHook
              effort="Manageable DIY volume. Ceilings, feature walls, and high prep jobs still eat a weekend fast."
              cta="Browse painters near you"
              href="/directory?trade=Painter"
            />
          )}
        </ToolPanel>
      </div>
    </div>
  );
}

function TileCalc() {
  const [area, setArea] = useState(7.7);
  const [tileL, setTileL] = useState(300);
  const [tileW, setTileW] = useState(300);
  const [jointMm, setJointMm] = useState(3);
  const [boxCoverage, setBoxCoverage] = useState(1.44);
  const [groutDepthMm, setGroutDepthMm] = useState(8);

  const result = useMemo(() => {
    const surface = Math.max(area, 0);
    const withWaste = surface * TILE_WASTE;
    const boxes = boxCoverage > 0 ? withWaste / boxCoverage : 0;

    const tL = Math.max(tileL, 1) / 1000;
    const tW = Math.max(tileW, 1) / 1000;
    const joint = Math.max(jointMm, 0) / 1000;
    const depth = Math.max(groutDepthMm, 1) / 1000;
    const tileArea = tL * tW;
    const moduleArea = (tL + joint) * (tW + joint);
    const groutFraction = moduleArea > 0 ? Math.max(moduleArea - tileArea, 0) / moduleArea : 0;
    const groutVolumeM3 = withWaste * groutFraction * depth;
    const groutKg = groutVolumeM3 * GROUT_DENSITY;
    const tilesApprox = tileArea > 0 ? withWaste / tileArea : 0;

    return { surface, withWaste, boxes, groutKg, tilesApprox };
  }, [area, tileL, tileW, jointMm, boxCoverage, groutDepthMm]);

  const bigJob = result.surface >= 8;

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-6">
        <ToolPanel title="Surface and tile">
          <div className="grid sm:grid-cols-2 gap-x-4">
            <NumberField
              label="Floor / wall area"
              value={area}
              onChange={setArea}
              suffix="m²"
              min={0}
              step={0.1}
            />
            <NumberField
              label="Coverage per box"
              value={boxCoverage}
              onChange={setBoxCoverage}
              suffix="m²"
              min={0.1}
              step={0.01}
            />
            <NumberField label="Tile length" value={tileL} onChange={setTileL} suffix="mm" min={50} step={10} />
            <NumberField label="Tile width" value={tileW} onChange={setTileW} suffix="mm" min={50} step={10} />
            <NumberField
              label="Joint width"
              value={jointMm}
              onChange={setJointMm}
              suffix="mm"
              min={1}
              step={0.5}
            />
            <NumberField
              label="Grout depth"
              value={groutDepthMm}
              onChange={setGroutDepthMm}
              suffix="mm"
              min={2}
              step={1}
            />
          </div>
          <p className="font-sans text-[13px] leading-[1.6] text-[#5a6a78]">
            Guideline only. Box count includes a 15% allowance (industry practice is typically 10%-15%
            for cuts and breakage) - see the{" "}
            <SourceInline href="https://www.beaumont-tiles.com.au/blogs/how-to-measure-your-floor-for-tiling">
              Beaumont Tiles measuring guide
            </SourceInline>{" "}
            and{" "}
            <SourceInline href="https://showtile.com.au/tile-calculator/">
              Showtile Tile Calculator Guide
            </SourceInline>
            . Grout weight is an estimate from tile size, joint width, and depth.
          </p>
        </ToolPanel>
      </div>
      <div className="lg:col-span-6">
        <ToolPanel title="Tiles and grout">
          <dl>
            <ToolResultRow label="Surface area" value={`${result.surface.toFixed(2)} m²`} />
            <ToolResultRow label="With 15% allowance" value={`${result.withWaste.toFixed(2)} m²`} hint="10%-15% buffer is typical" />
            <ToolResultRow label="Approx tiles" value={`${Math.ceil(result.tilesApprox)}`} />
            <ToolResultRow
              label="Boxes to buy"
              value={`${Math.ceil(result.boxes)}`}
              highlight
            />
            <ToolResultRow
              label="Grout required"
              value={`${Math.max(result.groutKg, 0).toFixed(1)} kg`}
            />
          </dl>
          {bigJob ? (
            <EffortHook
              effort={`About ${Math.ceil(result.boxes)} boxes plus ~${result.groutKg.toFixed(1)} kg of grout - and a lot of cutting, levelling, and curing time. Prefer to hand it over?`}
              cta="Find a local tiler in your suburb"
              href="/directory?trade=Tiler"
            />
          ) : (
            <EffortHook
              effort="Small areas are DIY-friendly. Wet-area falls and waterproofing are where most weekends go wrong."
              cta="Browse tilers near you"
              href="/directory?trade=Tiler"
            />
          )}
        </ToolPanel>
      </div>
    </div>
  );
}
